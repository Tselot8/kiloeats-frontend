import { DEMO_RESTAURANTS } from '../../src/data/demoRestaurants.js';
import { CAMPUSES } from '../../src/utils/studentBrowsing.js';
import { accessDecision } from '../../src/utils/identity.js';
import { checkoutCartKey, checkoutTotals, parseQuote, reviewCheckoutCatalog, validateDelivery } from '../../src/utils/checkout.js';
import { STUDENT_ORDER_TRANSITIONS } from '../../src/utils/studentOrders.js';

// SYNTHETIC_CHECKOUT_M12: imported only by the isolated role fixture / Node tests.
// No fetch, storage, merchant integration, real addresses or distance formula.
export const createDemoCheckoutService = ({ now = Date.now, before = async () => {}, quoteLifetime = () => 60000 } = {}) => {
  const catalog = structuredClone(DEMO_RESTAURANTS);
  const dropoffs = CAMPUSES.flatMap((campus) => ['A', 'B'].map((label) => ({ id: `synthetic-${campus.id}-${label.toLowerCase()}`,
    name: `Fictional ${campus.name} handoff ${label}`, campusId: campus.id })));
  const quotes = new Map(), operations = new Map(), orders = [], requests = [];
  const cancellationOperations = new Map();
  let quoteNumber = 0;
  const guard = (identity) => { if (accessDecision('checkout', identity) !== 'allowed') throw new Error('Synthetic checkout requires a verified student.'); };
  const record = (operation, operationId) => requests.push({ operation, ...(operationId ? { operationId } : {}), isolated: true });
  const locations = (cart) => dropoffs.filter((entry) => entry.campusId === cart.campusId);
  const studentGuard = (identity) => { if (accessDecision('student', identity) !== 'allowed') throw new Error('Student order access requires a student identity.'); };
  const owned = (identity, reference) => orders.find((order) => order.reference === reference && order.studentId === identity.user.id);
  const orderRequest = (operation, reference, operationId) => requests.push({ operation, ...(reference ? { reference } : {}), ...(operationId ? { operationId } : {}), isolated: true });
  const service = {
    available: true, synthetic: true, catalog, orders, requests,
    async listDropoffs({ identity, restaurantId, campusId }) {
      guard(identity); record('dropoffs');
      const override = await before('dropoffs');
      if (override !== undefined) return override;
      if (!catalog.some((entry) => entry.id === restaurantId && entry.campusIds.includes(campusId))) throw new Error('Unsupported synthetic restaurant/campus.');
      return structuredClone(dropoffs.filter((entry) => entry.campusId === campusId));
    },
    async quote({ identity, cart, dropoffId }) {
      guard(identity); record('quote');
      const override = await before('quote');
      if (override !== undefined) return override;
      if (!locations(cart).some((entry) => entry.id === dropoffId)) throw new Error('Unsupported fictional drop-off.');
      const data = { id: `synthetic-quote-${++quoteNumber}`, studentId: identity.user.id, cartKey: checkoutCartKey(cart), dropoffId,
        deliveryFeeMinor: dropoffId.endsWith('-a') ? 4250 : 6500, expiresAt: now() + quoteLifetime() };
      quotes.set(data.id, structuredClone(data));
      return data;
    },
    async readCatalog({ identity }) {
      guard(identity); record('catalog');
      const override = await before('catalog');
      return override !== undefined ? override : structuredClone(catalog);
    },
    submit({ identity, operationId, cart, quoteId, delivery }) {
      guard(identity); record('submit', operationId);
      if (typeof operationId !== 'string' || !operationId.trim()) return Promise.resolve({ outcome: 'rejected' });
      const binding = JSON.stringify([identity.user.id, cart, quoteId, delivery]);
      const previous = operations.get(operationId);
      if (previous) return previous.binding !== binding ? Promise.resolve({ outcome: 'unknown' })
        : previous.receipt ? Promise.resolve({ outcome: 'confirmed', receipt: structuredClone(previous.receipt) }) : previous.promise;
      const entry = { binding, studentId: identity.user.id };
      // Reserve the operation synchronously, before any deferred fixture work.
      operations.set(operationId, entry);
      entry.promise = Promise.resolve().then(async () => {
        let recorded = false;
        try {
          const override = await before('submit-before');
          if (override !== undefined) { operations.delete(operationId); return override; }
          guard(identity);
          const review = reviewCheckoutCatalog(cart, catalog);
          if (review.changed) { operations.delete(operationId); return { outcome: 'catalog-changed', catalog: structuredClone(catalog) }; }
          const validation = validateDelivery(delivery, locations(cart), cart.campusId);
          if (Object.keys(validation.errors).length) { operations.delete(operationId); return { outcome: 'rejected' }; }
          let quote;
          try { quote = parseQuote(quotes.get(quoteId), { identity, cart, dropoffId: delivery.dropoffId, now: now() }); }
          catch { operations.delete(operationId); return { outcome: 'rejected', code: 'QUOTE_EXPIRED' }; }
          const totals = checkoutTotals(cart, quote.deliveryFeeMinor);
          const receipt = { reference: `DEMO-${String(orders.length + 1).padStart(4, '0')}`, operationId, studentId: identity.user.id,
            restaurantId: cart.restaurantId, campusId: cart.campusId, quoteId, ...totals,
            items: cart.items.map(({ itemId, quantity, unitPriceMinor }) => ({ itemId, quantity, unitPriceMinor })), confirmedAt: now() };
          entry.receipt = structuredClone(receipt);
          orders.push({ ...structuredClone(receipt), restaurantName: cart.restaurantName,
            items: structuredClone(cart.items), delivery: validation.delivery, paymentMethod: 'cash-on-delivery',
            status: 'Pending', version: 1, statusEvents: [{ status: 'Pending', at: receipt.confirmedAt }] });
          recorded = true;
          const after = await before('submit-after');
          return after !== undefined ? after : { outcome: 'confirmed', receipt: structuredClone(receipt) };
        } catch (error) {
          // Unknown outcomes still reserve the same ID; callers cannot start
          // another attempt. A post-commit response loss retains its receipt.
          if (!recorded) entry.unknown = true;
          throw error;
        }
      });
      return entry.promise;
    },
    async lookup({ identity, operationId }) {
      guard(identity); record('lookup', operationId);
      const override = await before('lookup');
      if (override !== undefined) return override;
      const entry = operations.get(operationId);
      if (!entry || entry.studentId !== identity.user.id) return { outcome: 'not-found' };
      return entry.receipt ? { outcome: 'confirmed', receipt: structuredClone(entry.receipt) } : { outcome: 'unknown' };
    },
    async listOrders({ identity, signal }) {
      studentGuard(identity); signal?.throwIfAborted(); orderRequest('order-list');
      const override = await before('order-list'); signal?.throwIfAborted();
      if (override !== undefined) return Array.isArray(override)
        ? structuredClone(override.filter((order) => !order || typeof order.studentId !== 'string' || order.studentId === identity.user.id)) : override;
      return structuredClone(orders.filter((order) => order.studentId === identity.user.id).slice().reverse());
    },
    async readOrder({ identity, reference, signal }) {
      studentGuard(identity); signal?.throwIfAborted(); orderRequest('order-read', reference);
      const override = await before('order-read'); signal?.throwIfAborted();
      const order = owned(identity, reference);
      if (!order || (override?.studentId && override.studentId !== identity.user.id)) return { outcome: 'not-found' };
      return override !== undefined ? override : structuredClone(order);
    },
    cancelOrder({ identity, reference, version, operationId }) {
      studentGuard(identity); orderRequest('cancel', reference, operationId);
      if (!owned(identity, reference)) return Promise.resolve({ outcome: 'not-found', operationId });
      if (!Number.isSafeInteger(version) || version < 1 || typeof operationId !== 'string' || !operationId.trim()) return Promise.resolve({ outcome: 'unknown', operationId });
      const binding = JSON.stringify([identity.user.id, reference, version]);
      const previous = cancellationOperations.get(operationId);
      if (previous) return previous.binding !== binding ? Promise.resolve({ outcome: 'unknown', operationId })
        : previous.result ? Promise.resolve(structuredClone(previous.result)) : previous.promise;
      const entry = { binding, studentId: identity.user.id, reference };
      cancellationOperations.set(operationId, entry);
      entry.promise = Promise.resolve().then(async () => {
        const override = await before('cancel-before', { reference, version });
        if (override !== undefined) {
          if (override?.outcome === 'rejected' && override.code === 'FAILED') {
            cancellationOperations.delete(operationId);
            return { outcome: 'rejected', code: 'FAILED', operationId, order: structuredClone(owned(identity, reference)) };
          }
          return override;
        }
        // Atomic comparison after any deferred work: acceptance and cancellation
        // can never both win against the same Pending version.
        const current = owned(identity, reference);
        if (!current) return { outcome: 'not-found', operationId };
        if (current.version !== version || current.status !== 'Pending') {
          entry.result = { outcome: 'rejected', code: current.version !== version ? 'STALE' : 'NOT_PENDING', operationId, order: structuredClone(current) };
          return structuredClone(entry.result);
        }
        const updated = { ...current, status: 'Cancelled', version: current.version + 1,
          statusEvents: [...current.statusEvents, { status: 'Cancelled', at: now() }] };
        orders[orders.indexOf(current)] = updated;
        entry.result = { outcome: 'cancelled', operationId, order: structuredClone(updated) };
        const after = await before('cancel-after');
        return after !== undefined ? after : structuredClone(entry.result);
      });
      return entry.promise;
    },
    async lookupCancellation({ identity, reference, operationId }) {
      studentGuard(identity); orderRequest('cancel-lookup', reference, operationId);
      await before('cancel-lookup');
      const entry = cancellationOperations.get(operationId);
      if (!owned(identity, reference) || !entry || entry.studentId !== identity.user.id || entry.reference !== reference) return { outcome: 'not-found', operationId };
      return entry.result ? structuredClone(entry.result) : { outcome: 'unknown', operationId };
    },
    // SYNTHETIC_STUDENT_ORDERS_M13: explicit, harness-only restaurant simulation.
    // This changes the SAME records created by submit(), never merchant APIs.
    simulateOrderStatus(reference, status) {
      const current = orders.find((order) => order.reference === reference);
      if (!current || status === 'Cancelled' || !STUDENT_ORDER_TRANSITIONS[current.status].includes(status)) throw new Error('Unsupported synthetic transition. Cancel through the student action while Pending.');
      const updated = { ...current, status, version: current.version + 1, statusEvents: [...current.statusEvents, { status, at: now() }] };
      orders[orders.indexOf(current)] = updated;
      return structuredClone(updated);
    },
  };
  return service;
};
