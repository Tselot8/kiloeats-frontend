import { cartTotals, reconcileCart } from './cart.js';
import { accessDecision } from './identity.js';

// A frontend adapter boundary, not a proposed HTTP endpoint. The operational
// implementation is injected ONLY by tests/fixtures/roles-harness.jsx.
export const CHECKOUT_SERVICE = Object.freeze({ available: false });
const methods = ['listDropoffs', 'quote', 'readCatalog', 'submit', 'lookup'];
export const checkoutAvailable = (service = CHECKOUT_SERVICE) => service?.available === true && service.synthetic === true
  && methods.every((method) => typeof service[method] === 'function');
const text = (value) => typeof value === 'string' ? value.trim() : '';
const minor = (value) => Number.isSafeInteger(value) && value >= 0;
const failure = (code, message) => Object.assign(new Error(message), { code });
const requireAccess = (identity, service) => {
  if (accessDecision('checkout', identity) !== 'allowed') throw failure('ACCESS', 'A verified student identity is required for demo checkout.');
  if (!checkoutAvailable(service)) throw failure('UNAVAILABLE', 'Live checkout is unavailable. No order was sent.');
};

export const checkoutCartKey = (cart) => {
  if (!cart || !text(cart.restaurantId) || !text(cart.campusId) || !Array.isArray(cart.items) || !cart.items.length
    || cart.items.some((item) => !item || !text(item.itemId) || typeof item.quantity !== 'number') || new Set(cart.items.map((item) => item.itemId)).size !== cart.items.length) {
    throw failure('CART', 'Review a non-empty demo cart before checkout.');
  }
  cartTotals(cart);
  return JSON.stringify([cart.restaurantId, cart.campusId,
    cart.items.map(({ itemId, quantity, unitPriceMinor }) => [itemId, quantity, unitPriceMinor]).sort((a, b) => a[0].localeCompare(b[0]))]);
};

export const checkoutTotals = (cart, deliveryFeeMinor) => {
  if (!minor(deliveryFeeMinor) || deliveryFeeMinor >= 10000) throw failure('QUOTE', 'The demo delivery fee must be non-negative and strictly below 100 ETB.');
  const { subtotalMinor, quantity } = cartTotals(cart);
  const totalMinor = subtotalMinor + deliveryFeeMinor;
  if (!minor(totalMinor)) throw failure('TOTAL', 'The final amount is outside the supported currency range.');
  return { subtotalMinor, quantity, deliveryFeeMinor, totalMinor };
};

export const parseDropoffs = (data, campusId) => {
  if (!Array.isArray(data) || data.some((entry) => !entry || !text(entry.id) || !text(entry.name) || entry.campusId !== campusId)
    || new Set(data.map((entry) => entry.id)).size !== data.length) {
    throw failure('DROPOFFS', 'The demo drop-off response was malformed. No destination was selected.');
  }
  return data.map(({ id, name, campusId }) => ({ id, name, campusId }));
};

export const validateDelivery = (values, dropoffs, campusId) => {
  const delivery = { recipientName: text(values?.recipientName), contactPhone: text(values?.contactPhone),
    dropoffId: text(values?.dropoffId), handoffInstructions: text(values?.handoffInstructions) };
  const errors = {};
  if (!delivery.recipientName || delivery.recipientName.length > 120) errors.recipientName = 'Enter a recipient name, up to 120 characters.';
  const digits = delivery.contactPhone.replace(/\D/g, '');
  if (!/^\+?[\d ()-]+$/.test(delivery.contactPhone) || digits.length < 7 || digits.length > 15 || delivery.contactPhone.length > 40) {
    errors.contactPhone = 'Enter a phone number with 7–15 digits; spaces, +, brackets and hyphens are allowed.';
  }
  if (!dropoffs.some((entry) => entry.id === delivery.dropoffId && entry.campusId === campusId)) errors.dropoffId = 'Choose a supported synthetic drop-off for this cart’s campus.';
  delivery.dropoffName = dropoffs.find((entry) => entry.id === delivery.dropoffId && entry.campusId === campusId)?.name || '';
  if (delivery.handoffInstructions.length > 500) errors.handoffInstructions = 'Keep handoff instructions within 500 characters.';
  return { delivery, errors };
};

export const parseQuote = (data, { identity, cart, dropoffId, now = Date.now() }) => {
  const cartKey = checkoutCartKey(cart);
  if (!data || !text(data.id) || data.studentId !== identity.user.id || data.cartKey !== cartKey || data.dropoffId !== dropoffId
    || !Number.isSafeInteger(data.expiresAt)) throw failure('QUOTE', 'The demo quote did not match this student, cart and drop-off. Request a new quote.');
  checkoutTotals(cart, data.deliveryFeeMinor);
  if (data.expiresAt <= now) throw failure('EXPIRED', 'The demo quote has expired. Request a new quote and review the total.');
  return { id: data.id, studentId: data.studentId, cartKey, dropoffId, expiresAt: data.expiresAt, deliveryFeeMinor: data.deliveryFeeMinor };
};

export const checkoutReviewKey = (quote, cart) => JSON.stringify([checkoutCartKey(cart), quote.id, quote.studentId, quote.dropoffId, quote.deliveryFeeMinor, quote.expiresAt]);

export const reviewCheckoutCatalog = (cart, catalog) => {
  if (!Array.isArray(catalog) || new Set(catalog.map((entry) => entry?.id)).size !== catalog.length || catalog.some((entry) => !entry || !text(entry.id) || !text(entry.name) || !Array.isArray(entry.campusIds)
    || typeof entry.menuAvailable !== 'boolean' || !Array.isArray(entry.items)
    || new Set(entry.items.map((item) => item?.id)).size !== entry.items.length
    || entry.items.some((item) => !item || !text(item.id) || !text(item.name) || typeof item.available !== 'boolean'))) {
    throw failure('CATALOG', 'The current demo menu could not be checked because its response was malformed. No order was submitted.');
  }
  const result = reconcileCart(cart, catalog);
  return { ...result, changed: !result.cart || checkoutCartKey(result.cart) !== checkoutCartKey(cart) || result.notices.length > 0 };
};

export const createCheckoutClient = (service = CHECKOUT_SERVICE, { now = Date.now } = {}) => ({
  available: checkoutAvailable(service),
  async listDropoffs(identity, cart) {
    requireAccess(identity, service); checkoutCartKey(cart);
    return parseDropoffs(await service.listDropoffs({ identity, restaurantId: cart.restaurantId, campusId: cart.campusId }), cart.campusId);
  },
  async quote(identity, cart, dropoffId) {
    requireAccess(identity, service); checkoutCartKey(cart);
    return parseQuote(await service.quote({ identity, cart: structuredClone(cart), dropoffId }), { identity, cart, dropoffId, now: now() });
  },
  async review(identity, cart) {
    requireAccess(identity, service); checkoutCartKey(cart);
    const catalog = await service.readCatalog({ identity, restaurantId: cart.restaurantId, campusId: cart.campusId });
    return { ...reviewCheckoutCatalog(cart, catalog), catalog };
  },
  async submit(identity, attempt) {
    requireAccess(identity, service);
    return service.submit({ identity, operationId: attempt.operationId, cart: structuredClone(attempt.cart),
      quoteId: attempt.quote.id, delivery: structuredClone(attempt.delivery) });
  },
  async lookup(identity, operationId) {
    requireAccess(identity, service);
    return service.lookup({ identity, operationId });
  },
});

const receiptFor = (data, attempt) => {
  const { totals, cart, quote, studentId, operationId } = attempt;
  if (!data || !/^DEMO-[A-Z0-9-]+$/.test(data.reference || '') || data.operationId !== operationId || data.studentId !== studentId
    || data.quoteId !== quote.id || data.restaurantId !== cart.restaurantId || data.campusId !== cart.campusId
    || data.subtotalMinor !== totals.subtotalMinor || data.deliveryFeeMinor !== totals.deliveryFeeMinor || data.totalMinor !== totals.totalMinor
    || !Number.isSafeInteger(data.confirmedAt) || !Array.isArray(data.items)
    || JSON.stringify(data.items) !== JSON.stringify(cart.items.map(({ itemId, quantity, unitPriceMinor }) => ({ itemId, quantity, unitPriceMinor })))) {
    throw failure('RECEIPT', 'The demo receipt did not confirm the submitted items and amounts.');
  }
  return { reference: data.reference, confirmedAt: data.confirmedAt, ...structuredClone(attempt) };
};

// Lives above the route so an uncertain or pending operation cannot be replaced
// with a fresh ID by navigating away/back. No draft, operation or receipt storage.
export const createCheckoutSession = (service = CHECKOUT_SERVICE, { now = Date.now, makeId = () => globalThis.crypto.randomUUID() } = {}) => {
  const client = createCheckoutClient(service, { now });
  let state = { phase: 'idle', attempt: null, error: '' }, busy = null;
  const listeners = new Set();
  const publish = (next) => { state = next; listeners.forEach((listener) => listener()); return state; };
  const outcome = (response, attempt) => {
    if (response?.outcome === 'confirmed') return publish({ phase: 'confirmed', attempt, receipt: receiptFor(response.receipt, attempt), error: '' });
    if (response?.outcome === 'rejected') return publish({ phase: 'failed', attempt,
      error: response.code === 'QUOTE_EXPIRED' ? 'The demo quote expired before acceptance. No demo order was recorded. Request a new quote.' : 'The demo service rejected the submission. No demo order was recorded. Your cart and delivery details are retained.' });
    if (response?.outcome === 'catalog-changed') {
      const review = reviewCheckoutCatalog(attempt.cart, response.catalog);
      return publish({ phase: 'review-required', attempt: null, cart: attempt.cart, revision: attempt.revision, catalog: response.catalog, notices: review.notices,
        error: 'The demo menu changed before acceptance. No order was recorded. Review the updated cart and request a new quote.' });
    }
    return publish({ phase: 'uncertain', attempt, error: 'The demo order outcome is uncertain. Do not submit again. Check this operation’s outcome; no write will be retried automatically.' });
  };
  return {
    client,
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    submit(input) {
      if (busy) return busy;
      if (['confirmed', 'uncertain', 'recovering'].includes(state.phase)) return Promise.resolve(state);
      const previous = state.attempt;
      publish({ phase: 'checking', attempt: previous, error: '' });
      // Schedule after assigning busy: even synchronous callers share one run.
      busy = Promise.resolve().then(async () => {
        let attempt, writing = false;
        try {
          requireAccess(input.identity, service);
          const { delivery, errors } = validateDelivery(input.delivery, input.dropoffs, input.cart.campusId);
          if (Object.keys(errors).length) throw failure('VALIDATION', 'Correct the highlighted delivery fields before submitting.');
          const review = await client.review(input.identity, input.cart);
          if (!input.isCurrent()) throw failure('CHANGED', 'The cart, destination or identity changed. No order was submitted. Review checkout again.');
          if (review.changed) return publish({ phase: 'review-required', attempt: null, cart: input.cart, revision: input.revision, catalog: review.catalog, notices: review.notices,
            error: 'The demo menu changed. No order was submitted. Review the updated cart and request a new quote.' });
          const quote = parseQuote(input.quote, { identity: input.identity, cart: input.cart, dropoffId: delivery.dropoffId, now: now() });
          if (input.reviewKey !== checkoutReviewKey(quote, input.cart)) throw failure('REVIEW', 'Review the current items, delivery fee and final total before submitting.');
          const binding = JSON.stringify([input.identity.user.id, input.revision, checkoutCartKey(input.cart), quote, delivery]);
          attempt = { operationId: previous?.binding === binding ? previous.operationId : makeId(), binding, studentId: input.identity.user.id,
            revision: input.revision, cart: structuredClone(input.cart), quote, delivery, totals: checkoutTotals(input.cart, quote.deliveryFeeMinor) };
          publish({ phase: 'submitting', attempt, error: '' });
          writing = true;
          return outcome(await client.submit(input.identity, attempt), attempt);
        } catch (error) {
          return publish({ phase: writing ? 'uncertain' : 'failed', attempt: writing ? attempt : null,
            error: writing ? 'The demo submission could not be confirmed. It may have been recorded. Check the same operation’s outcome; no write will be repeated automatically.'
              : ['ACCESS', 'UNAVAILABLE', 'QUOTE', 'EXPIRED', 'CATALOG', 'VALIDATION', 'CHANGED', 'CART', 'TOTAL', 'REVIEW'].includes(error.code) ? error.message
                : 'The current demo menu could not be checked. No order was submitted. Your cart and delivery details are retained.' });
        }
      }).finally(() => { busy = null; });
      return busy;
    },
    recover(identity) {
      if (busy) return busy;
      if (state.phase !== 'uncertain' || state.attempt?.studentId !== identity?.user?.id) return Promise.resolve(state);
      const attempt = state.attempt;
      publish({ phase: 'recovering', attempt, error: '' });
      busy = Promise.resolve().then(async () => {
        try {
          const response = await client.lookup(identity, attempt.operationId);
          if (response?.outcome === 'confirmed') return outcome(response, attempt);
          return publish({ phase: 'uncertain', attempt, error: 'No confirmed outcome is available for this operation. This does not prove that no order was recorded. No repeat write was sent.' });
        } catch {
          return publish({ phase: 'uncertain', attempt, error: 'The demo outcome could not be checked. Keep this operation reference; no repeat write was sent.' });
        }
      }).finally(() => { busy = null; });
      return busy;
    },
  };
};
