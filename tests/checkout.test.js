import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCartItem, cartReducer, persistCart, CART_STORAGE_KEY } from '../src/utils/cart.js';
import { accessDecision, GUEST_IDENTITY, identityDestination, normalizeIdentity, safeReturnPath } from '../src/utils/identity.js';
import { CHECKOUT_SERVICE, checkoutAvailable, checkoutCartKey, checkoutReviewKey, checkoutTotals, createCheckoutClient, createCheckoutSession, parseDropoffs, parseQuote, reviewCheckoutCatalog, validateDelivery } from '../src/utils/checkout.js';
import { createDemoCheckoutService } from './fixtures/checkout-service.js';

const student = (status = 'verified', id = 'synthetic-checkout-student') => normalizeIdentity({ role: 'student', user: { id, campusId: 'aau-4k' }, verification: { status } });
const identity = student();
const cart = () => addCartItem(null, { restaurantId: 'demo-acacia-kitchen', campusId: 'aau-4k', itemId: 'acacia-shiro', quantity: 2 }).cart;
const details = (dropoffId = 'synthetic-aau-4k-a') => ({ recipientName: 'Synthetic Recipient', contactPhone: '000 000 0000', dropoffId, handoffInstructions: 'Fictional handoff only' });
const ready = async (service = createDemoCheckoutService(), options = {}) => {
  const session = createCheckoutSession(service, options), currentCart = cart();
  const dropoffs = await session.client.listDropoffs(identity, currentCart);
  const quote = await session.client.quote(identity, currentCart, dropoffs[0].id);
  return { service, session, input: { identity, cart: currentCart, revision: 4, delivery: details(dropoffs[0].id), dropoffs, quote,
    reviewKey: checkoutReviewKey(quote, currentCart), isCurrent: () => true } };
};

test('checkout role gate fails closed for guests, unverified students, staff, admins and unknown/loading identities', () => {
  assert.equal(accessDecision('checkout', GUEST_IDENTITY), 'login-required');
  for (const status of ['not-submitted', 'pending', 'rejected']) assert.equal(accessDecision('checkout', student(status)), 'verification-required');
  for (const value of [{ role: 'admin', user: { id: 'a' } }, { role: 'restaurant-staff', user: { id: 'r' }, restaurantId: 'assigned' }]) assert.equal(accessDecision('checkout', normalizeIdentity(value)), 'denied');
  assert.equal(accessDecision('checkout', { status: 'loading' }), 'loading');
  for (const value of [null, {}, { status: 'ready', role: 'student', user: { id: 'x' }, verification: { status: 'verified' } }]) assert.equal(accessDecision('checkout', value), 'unavailable');
  assert.equal(accessDecision('checkout', identity), 'allowed');
});

test('checkout return links are internal, strip sensitive queries, and require verification before a future destination', () => {
  assert.equal(safeReturnPath('/checkout?phone=0000000000&role=admin#secret'), '/checkout');
  assert.equal(safeReturnPath('//outside.invalid/checkout'), '/browse');
  assert.equal(identityDestination(identity, '/checkout'), '/checkout');
  assert.equal(identityDestination(student('pending'), '/checkout'), '/account');
});

test('normal and non-synthetic checkout adapters stay unavailable and denied roles make zero service calls', async () => {
  assert.equal(checkoutAvailable(CHECKOUT_SERVICE), false);
  await assert.rejects(createCheckoutClient().listDropoffs(identity, cart()), /unavailable/);
  const fixture = createDemoCheckoutService();
  const client = createCheckoutClient(fixture);
  for (const actor of [GUEST_IDENTITY, student('pending'), normalizeIdentity({ role: 'admin', user: { id: 'a' } })]) {
    await assert.rejects(client.listDropoffs(actor, cart()), /verified/);
    await assert.rejects(client.quote(actor, cart(), details().dropoffId), /verified/);
    await assert.rejects(client.review(actor, cart()), /verified/);
    await assert.rejects(client.submit(actor, {}), /verified/);
    await assert.rejects(client.lookup(actor, 'operation'), /verified/);
  }
  assert.deepEqual(fixture.requests, []);
  assert.equal(checkoutAvailable({ ...fixture, synthetic: false }), false);
});

test('drop-offs distinguish valid empty data from malformed, duplicate and wrong-campus responses', () => {
  assert.deepEqual(parseDropoffs([], 'aau-4k'), []);
  const entry = { id: 'fictional', name: 'Fictional location', campusId: 'aau-4k' };
  assert.deepEqual(parseDropoffs([entry], 'aau-4k'), [entry]);
  for (const value of [null, {}, [null], [{ ...entry, name: '' }], [entry, entry], [{ ...entry, campusId: 'aau-5k' }]]) assert.throws(() => parseDropoffs(value, 'aau-4k'), /malformed/);
});

test('all four campus carts receive only their own explicitly fictional drop-offs and valid synthetic quotes', async () => {
  const service = createDemoCheckoutService(), client = createCheckoutClient(service);
  for (const campusId of ['aau-4k', 'aau-5k', 'aau-6k', 'yared-music-school']) {
    const restaurant = service.catalog.find((entry) => entry.campusIds.includes(campusId) && entry.menuAvailable && entry.items.some((item) => item.available));
    const item = restaurant.items.find((entry) => entry.available);
    const current = addCartItem(null, { restaurantId: restaurant.id, campusId, itemId: item.id }, { catalog: service.catalog }).cart;
    const dropoffs = await client.listDropoffs(identity, current);
    assert.equal(dropoffs.length, 2); assert.ok(dropoffs.every((entry) => entry.campusId === campusId && entry.name.startsWith('Fictional ')));
    for (const entry of dropoffs) {
      const quote = await client.quote(identity, current, entry.id);
      assert.ok(quote.deliveryFeeMinor >= 0 && quote.deliveryFeeMinor < 10000);
    }
    await assert.rejects(client.quote(identity, current, 'unsupported-campus-dropoff'), /Unsupported fictional/);
  }
  assert.equal(service.orders.length, 0);
});

test('delivery validation requires supported destinations, a name and a plausible phone without storing extra input fields', () => {
  const dropoffs = [{ id: details().dropoffId, name: 'Fictional handoff', campusId: 'aau-4k' }];
  const valid = validateDelivery({ ...details(), role: 'admin', password: 'never-forward' }, dropoffs, 'aau-4k');
  assert.deepEqual(valid.errors, {}); assert.equal(valid.delivery.dropoffName, 'Fictional handoff');
  assert.equal('role' in valid.delivery, false); assert.equal('password' in valid.delivery, false);
  for (const phone of ['123', 'abc0000000', '+000000000000000000', '']) assert.ok(validateDelivery({ ...details(), contactPhone: phone }, dropoffs, 'aau-4k').errors.contactPhone);
  assert.ok(validateDelivery({ ...details(), recipientName: ' ', handoffInstructions: 'x'.repeat(501) }, dropoffs, 'aau-4k').errors.recipientName);
  assert.ok(validateDelivery(details('unsupported'), dropoffs, 'aau-4k').errors.dropoffId);
  assert.ok(validateDelivery(details(), dropoffs, 'aau-5k').errors.dropoffId);
});

test('checkout totals use safe integer minor units and allow zero through 99.99 ETB, excluding 100 ETB', () => {
  const current = { items: [{ quantity: 3, unitPriceMinor: 29 }] };
  assert.deepEqual(checkoutTotals(current, 0), { quantity: 3, subtotalMinor: 87, deliveryFeeMinor: 0, totalMinor: 87 });
  assert.equal(checkoutTotals(current, 9999).totalMinor, 10086);
  for (const fee of [-1, 10000, 10001, 1.5, NaN, Infinity, '4250', null]) assert.throws(() => checkoutTotals(current, fee), /below 100/);
  assert.throws(() => checkoutTotals({ items: [{ quantity: 1, unitPriceMinor: Number.MAX_SAFE_INTEGER }] }, 1), /supported currency/);
});

test('quotes are bound to the student, current cart/prices/quantities and destination, with valid expiry and fee', async () => {
  const { input } = await ready();
  const context = { identity, cart: input.cart, dropoffId: input.delivery.dropoffId };
  assert.equal(parseQuote(input.quote, context).id, input.quote.id);
  for (const quote of [null, {}, { ...input.quote, deliveryFeeMinor: 10000 }, { ...input.quote, deliveryFeeMinor: -1 }, { ...input.quote, expiresAt: Date.now() - 1 }, { ...input.quote, expiresAt: NaN }, { ...input.quote, studentId: 'other' }, { ...input.quote, dropoffId: 'other' }]) assert.throws(() => parseQuote(quote, context));
  for (const patch of [{ quantity: 3 }, { unitPriceMinor: 11100 }]) {
    const changed = { ...input.cart, items: [{ ...input.cart.items[0], ...patch }] };
    assert.throws(() => parseQuote(input.quote, { ...context, cart: changed }), /did not match/);
  }
});

test('cart fingerprints use stable item IDs and reject malformed or empty carts', () => {
  assert.equal(checkoutCartKey(cart()), checkoutCartKey(structuredClone(cart())));
  for (const current of [null, { ...cart(), items: [] }, { ...cart(), items: [null] }, { ...cart(), items: [{ ...cart().items[0], quantity: '2' }] }]) assert.throws(() => checkoutCartKey(current));
});

test('a missing review or refreshed/changed quote cannot submit even when all form data is valid', async () => {
  const { session, service, input } = await ready();
  await session.submit({ ...input, reviewKey: '' });
  assert.equal(session.getSnapshot().phase, 'failed'); assert.equal(service.orders.length, 0);
  assert.match(session.getSnapshot().error, /Review the current/);
  const nextQuote = await session.client.quote(identity, input.cart, input.delivery.dropoffId);
  await session.submit({ ...input, quote: nextQuote });
  assert.equal(service.orders.length, 0);
  assert.notEqual(checkoutReviewKey(nextQuote, input.cart), input.reviewKey);
});

test('expired quotes after asynchronous catalog recheck are blocked before any write', async () => {
  let clock = 1000;
  const service = createDemoCheckoutService({ now: () => clock, quoteLifetime: () => 100, before: async (operation) => { if (operation === 'catalog') clock += 101; } });
  const { session, input } = await ready(service, { now: () => clock });
  await session.submit(input);
  assert.equal(service.requests.filter((entry) => entry.operation === 'submit').length, 0);
  assert.match(session.getSnapshot().error, /expired/);
});

test('current catalog repricing requires renewed review and sends no order', async () => {
  const { service, session, input } = await ready();
  service.catalog[0].items[0].price = 125;
  await session.submit(input);
  const state = session.getSnapshot();
  assert.equal(state.phase, 'review-required'); assert.match(state.notices.join(), /changed from/);
  assert.equal(service.orders.length, 0);
  const review = reviewCheckoutCatalog(input.cart, state.catalog);
  assert.equal(review.cart.items[0].unitPriceMinor, 12500);
  assert.throws(() => parseQuote(input.quote, { identity, cart: review.cart, dropoffId: input.delivery.dropoffId }), /did not match/);
});

test('unavailable, missing items, missing restaurants and malformed catalogs never become a silently submitted altered cart', async () => {
  for (const change of [(catalog) => { catalog[0].items[0].available = false; }, (catalog) => { catalog[0].items = []; }, (catalog) => { catalog.splice(0, 1); }]) {
    const { service, session, input } = await ready(); change(service.catalog);
    await session.submit(input); assert.equal(session.getSnapshot().phase, 'review-required'); assert.equal(service.orders.length, 0);
  }
  for (const response of [null, {}, [{ id: 'bad' }]]) assert.throws(() => reviewCheckoutCatalog(cart(), response), /malformed/);
});

test('catalog read failure retains the snapshot and never makes a submission request', async () => {
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'catalog') throw new Error('Synthetic read failure'); } });
  const { session, input } = await ready(service);
  const original = structuredClone({ delivery: input.delivery, cart: input.cart });
  await session.submit(input);
  assert.equal(session.getSnapshot().phase, 'failed'); assert.match(session.getSnapshot().error, /No order was submitted/);
  assert.equal(service.requests.filter((entry) => entry.operation === 'submit').length, 0);
  assert.deepEqual(input.delivery, original.delivery); assert.deepEqual(input.cart, original.cart);
});

test('concurrent duplicate submissions share one operation, one catalog read and one simulated write', async () => {
  let release;
  const deferred = new Promise((resolve) => { release = resolve; });
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'catalog') await deferred; } });
  const { session, input } = await ready(service);
  const first = session.submit(input), second = session.submit(input);
  assert.equal(first, second); release(); await Promise.all([first, second]);
  assert.equal(service.orders.length, 1); assert.equal(service.requests.filter((entry) => entry.operation === 'catalog').length, 1);
  assert.equal(service.requests.filter((entry) => entry.operation === 'submit').length, 1);
  assert.equal(session.getSnapshot().phase, 'confirmed');
  await session.submit(input); assert.equal(service.orders.length, 1);
});

test('cart/destination/identity changes during a read block the pending submission', async () => {
  const { service, session, input } = await ready();
  await session.submit({ ...input, isCurrent: () => false });
  assert.equal(service.orders.length, 0); assert.match(session.getSnapshot().error, /changed/);
});

test('confirmed failures preserve details and retry the same unchanged operation ID only on explicit submission', async () => {
  let reject = true;
  const service = createDemoCheckoutService({ before: async (operation) => operation === 'submit-before' && reject ? { outcome: 'rejected' } : undefined });
  const { session, input } = await ready(service);
  await session.submit(input); const first = session.getSnapshot();
  assert.equal(first.phase, 'failed'); assert.equal(service.orders.length, 0);
  assert.equal(first.attempt.delivery.recipientName, input.delivery.recipientName);
  reject = false;
  await session.submit(input);
  assert.equal(session.getSnapshot().receipt.operationId, first.attempt.operationId); assert.equal(service.orders.length, 1);
});

test('an outcome lost after recording recovers by read-only lookup and cannot submit a duplicate', async () => {
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'submit-after') throw new Error('Synthetic lost response'); } });
  const { session, input } = await ready(service);
  await session.submit(input); const attempt = session.getSnapshot().attempt;
  assert.equal(session.getSnapshot().phase, 'uncertain'); assert.equal(service.orders.length, 1);
  await session.submit(input); assert.equal(service.requests.filter((entry) => entry.operation === 'submit').length, 1);
  await session.recover(identity);
  assert.equal(session.getSnapshot().phase, 'confirmed'); assert.equal(session.getSnapshot().receipt.operationId, attempt.operationId);
  assert.equal(service.orders.length, 1); assert.equal(service.requests.at(-1).operation, 'lookup');
});

test('an unknown pre-recording outcome and failed lookup remain uncertain without any repeat writes', async () => {
  let lookupFails = true;
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'submit-before' || (operation === 'lookup' && lookupFails)) throw new Error('Synthetic uncertain network'); } });
  const { session, input } = await ready(service);
  await session.submit(input); assert.equal(session.getSnapshot().phase, 'uncertain');
  await session.recover(identity); assert.match(session.getSnapshot().error, /could not be checked/);
  lookupFails = false; await session.recover(identity); assert.match(session.getSnapshot().error, /does not prove/);
  await session.submit(input);
  assert.equal(service.orders.length, 0); assert.equal(service.requests.filter((entry) => entry.operation === 'submit').length, 1);
});

test('malformed and mismatched post-write receipts are uncertain, never falsely successful', async () => {
  for (const response of [{ malformed: true }, { outcome: 'confirmed', receipt: { reference: 'DEMO-FAKE', totalMinor: 0 } }]) {
    const service = createDemoCheckoutService({ before: async (operation) => operation === 'submit-after' ? response : undefined });
    const { session, input } = await ready(service); await session.submit(input);
    assert.equal(session.getSnapshot().phase, 'uncertain'); assert.equal(service.orders.length, 1);
    await session.recover(identity); assert.equal(session.getSnapshot().phase, 'confirmed');
  }
});

test('synthetic service is idempotent for repeated operation IDs and rejects changed payload reuse without another order', async () => {
  const { service, session, input } = await ready();
  await session.submit(input); const attempt = session.getSnapshot().attempt;
  const request = { identity, operationId: attempt.operationId, cart: attempt.cart, quoteId: attempt.quote.id, delivery: attempt.delivery };
  const duplicate = await service.submit(request);
  assert.equal(duplicate.receipt.reference, session.getSnapshot().receipt.reference); assert.equal(service.orders.length, 1);
  assert.equal((await service.submit({ ...request, delivery: { ...attempt.delivery, recipientName: 'Another synthetic recipient' } })).outcome, 'unknown');
  assert.equal(service.orders.length, 1);
  assert.equal((await service.lookup({ identity: student('verified', 'other-student'), operationId: attempt.operationId })).outcome, 'not-found');
});

test('the service rechecks catalog atomically if it changes after client review but before recording', async () => {
  let service;
  service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'submit-before') service.catalog[0].items[0].price += 1; } });
  const { session, input } = await ready(service); await session.submit(input);
  assert.equal(session.getSnapshot().phase, 'review-required'); assert.equal(service.orders.length, 0);
});

test('a fee change invalidates prior review even if a broken adapter reused its quote ID', async () => {
  const { session, service, input } = await ready();
  await session.submit({ ...input, quote: { ...input.quote, deliveryFeeMinor: input.quote.deliveryFeeMinor + 1 } });
  assert.equal(session.getSnapshot().phase, 'failed'); assert.match(session.getSnapshot().error, /Review the current/);
  assert.equal(service.orders.length, 0);
});

test('the synthetic service rejects a quote that expires after client recheck but before recording', async () => {
  let clock = 1000;
  const service = createDemoCheckoutService({ now: () => clock, quoteLifetime: () => 100, before: async (operation) => { if (operation === 'submit-before') clock += 101; } });
  const { session, input } = await ready(service, { now: () => clock }); await session.submit(input);
  assert.equal(session.getSnapshot().phase, 'failed'); assert.match(session.getSnapshot().error, /expired/);
  assert.equal(service.orders.length, 0);
});

test('duplicate catalog IDs are malformed data, not a valid empty or altered checkout', async () => {
  const service = createDemoCheckoutService();
  const copy = structuredClone(service.catalog);
  copy[0].items.push(structuredClone(copy[0].items[0]));
  assert.throws(() => reviewCheckoutCatalog(cart(), copy), /malformed/);
  assert.throws(() => reviewCheckoutCatalog(cart(), [...service.catalog, service.catalog[0]]), /malformed/);
});

test('only the exact submitted cart revision is cleared; newer and even changed-back carts survive', () => {
  const original = cart();
  const initial = { cart: original, revision: 4, context: null, notices: [], feedback: '', error: '', pending: null };
  assert.equal(cartReducer(initial, { type: 'CHECKOUT_CONFIRMED', revision: 4, cart: original }).cart, null);
  for (const revision of [5, 6]) {
    const newer = { ...initial, revision };
    assert.deepEqual(cartReducer(newer, { type: 'CHECKOUT_CONFIRMED', revision: 4, cart: original }).cart, original);
  }
  const changed = { ...initial, cart: { ...original, items: [{ ...original.items[0], quantity: 3 }] } };
  assert.deepEqual(cartReducer(changed, { type: 'CHECKOUT_CONFIRMED', revision: 4, cart: original }).cart, changed.cart);
});

test('catalog review cannot overwrite a newer cart revision', async () => {
  const { service } = await ready(); service.catalog[0].items[0].price += 1;
  const initial = { cart: cart(), revision: 5, pending: null, notices: [] };
  assert.equal(cartReducer(initial, { type: 'CHECKOUT_REVIEW', revision: 4, catalog: service.catalog }), initial);
  assert.equal(cartReducer(initial, { type: 'CHECKOUT_REVIEW', revision: 5, catalog: service.catalog }).cart.items[0].unitPriceMinor, 11100);
});

test('normal cart persistence excludes recipient details, quotes, receipts and operation identifiers', async () => {
  const { session, input } = await ready(); await session.submit(input);
  const writes = [];
  persistCart({ ...input.cart, delivery: input.delivery, receipt: session.getSnapshot().receipt }, () => ({ setItem(key, value) { writes.push([key, value]); } }));
  assert.equal(writes[0][0], CART_STORAGE_KEY);
  assert.equal(/Synthetic Recipient|000 000 0000|handoffInstructions|operationId|quoteId|DEMO-/.test(writes[0][1]), false);
});
