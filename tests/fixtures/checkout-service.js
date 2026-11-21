import { DEMO_RESTAURANTS } from '../../src/data/demoRestaurants.js';
import { CAMPUSES } from '../../src/utils/studentBrowsing.js';
import { accessDecision } from '../../src/utils/identity.js';
import { checkoutCartKey, checkoutTotals, parseQuote, reviewCheckoutCatalog, validateDelivery } from '../../src/utils/checkout.js';

// SYNTHETIC_CHECKOUT_M12: imported only by the isolated role fixture / Node tests.
// No fetch, storage, merchant integration, real addresses or distance formula.
export const createDemoCheckoutService = ({ now = Date.now, before = async () => {}, quoteLifetime = () => 60000 } = {}) => {
  const catalog = structuredClone(DEMO_RESTAURANTS);
  const dropoffs = CAMPUSES.flatMap((campus) => ['A', 'B'].map((label) => ({ id: `synthetic-${campus.id}-${label.toLowerCase()}`,
    name: `Fictional ${campus.name} handoff ${label}`, campusId: campus.id })));
  const quotes = new Map(), operations = new Map(), orders = [], requests = [];
  let quoteNumber = 0;
  const guard = (identity) => { if (accessDecision('checkout', identity) !== 'allowed') throw new Error('Synthetic checkout requires a verified student.'); };
  const record = (operation, operationId) => requests.push({ operation, ...(operationId ? { operationId } : {}), isolated: true });
  const locations = (cart) => dropoffs.filter((entry) => entry.campusId === cart.campusId);
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
          orders.push({ ...structuredClone(receipt), delivery: validation.delivery });
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
  };
  return service;
};
