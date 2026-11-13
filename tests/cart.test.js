import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_RESTAURANTS } from '../src/data/demoRestaurants.js';
import { addCartItem, CART_STORAGE_KEY, cartReducer, cartTotals, formatETB, loadCart, parseQuantity, persistCart, reconcileCart, restoreCart, setCartQuantity, toMinorUnits } from '../src/utils/cart.js';

const acacia = { restaurantId: 'demo-acacia-kitchen', campusId: 'aau-4k', itemId: 'acacia-shiro' };
const courtyard = { restaurantId: 'demo-courtyard-cafe', campusId: 'aau-4k', itemId: 'courtyard-tea' };
const add = (cart = null, selection = acacia, options) => addCartItem(cart, selection, options).cart;
const stateFor = (cart = null) => ({ cart, context: null, notices: [], revision: 0, pending: null, feedback: '', error: '', storageWarning: '', readFailed: false });
const saved = (overrides = {}) => ({ version: 1, restaurantId: acacia.restaurantId, campusId: acacia.campusId,
  items: [{ itemId: acacia.itemId, name: 'Shiro with injera', quantity: 2, unitPriceMinor: 11000 }], ...overrides });

test('quantities must be positive safe integers; invalid user drafts cannot become quantities', () => {
  for (const value of [1, 2, '3']) assert.equal(parseQuantity(value), Number(value));
  for (const value of ['', ' ', null, true, undefined, 0, -1, 1.5, '2.5', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseQuantity(value), /positive whole-number/);
});

test('ETB prices convert to integer minor units without decimal multiplication errors', () => {
  for (const [price, expected] of [[0, 0], [0.1, 10], [0.2, 20], [0.29, 29], [1.99, 199], [110, 11000]]) assert.equal(toMinorUnits(price), expected);
  for (const price of [NaN, Infinity, -1, '110', null, true, 1.001, 0.0001, 1e21]) assert.throws(() => toMinorUnits(price), /price|currency/);
});

test('line and subtotal arithmetic stay in minor units, including free items and mixed decimals', () => {
  const cart = { items: [{ quantity: 3, unitPriceMinor: toMinorUnits(0.29) }, { quantity: 2, unitPriceMinor: toMinorUnits(0.1) }, { quantity: 4, unitPriceMinor: 0 }] };
  assert.deepEqual(cartTotals(cart), { quantity: 9, subtotalMinor: 107 });
  assert.equal(formatETB(107), '1.07 ETB');
  assert.equal(formatETB(Number.MAX_SAFE_INTEGER), '90,071,992,547,409.91 ETB');
  assert.deepEqual(cartTotals(null), { quantity: 0, subtotalMinor: 0 });
});

test('unsafe line totals, subtotals, or total item quantities are rejected', () => {
  for (const items of [
    [{ quantity: 2, unitPriceMinor: Number.MAX_SAFE_INTEGER }],
    [{ quantity: 1, unitPriceMinor: Number.MAX_SAFE_INTEGER }, { quantity: 1, unitPriceMinor: 1 }],
    [{ quantity: Number.MAX_SAFE_INTEGER, unitPriceMinor: 0 }, { quantity: 1, unitPriceMinor: 0 }],
  ]) assert.throws(() => cartTotals({ items }), /supported cart total/);
});

test('same item IDs merge quantities and different foods remain separate', () => {
  const first = add();
  const second = add(first);
  const third = add(second, { ...acacia, itemId: 'acacia-vegetable-plate' });
  assert.equal(second.items[0].quantity, 2);
  assert.equal(first.items[0].quantity, 1);
  assert.equal(third.items.length, 2);
  assert.deepEqual(cartTotals(third), { quantity: 3, subtotalMinor: 35500 });
});

test('caller-supplied names/prices/availability cannot override current catalog data', () => {
  const cart = add(null, { ...acacia, name: 'Forged', price: 0, unitPriceMinor: 0, available: true });
  assert.equal(cart.items[0].name, 'Shiro with injera');
  assert.equal(cart.items[0].unitPriceMinor, 11000);
});

test('unavailable/missing foods, unavailable menus, invalid campuses and unsupported combinations cannot be added', () => {
  for (const selection of [
    { ...acacia, itemId: 'acacia-sambusa', available: true }, { ...acacia, itemId: 'missing' },
    { ...acacia, campusId: 'aau-6k' }, { ...acacia, campusId: 'bad' }, { ...acacia, restaurantId: 'missing' },
    { restaurantId: 'demo-hilltop-canteen', campusId: 'aau-4k', itemId: 'anything' },
  ]) assert.throws(() => add(null, selection), /unavailable/);
});

for (const [name, selection] of [['restaurant', courtyard], ['campus', { ...acacia, campusId: 'aau-5k' }]]) {
  test(`a different ${name} requires confirmation and cancellation preserves the original cart/revision`, () => {
    const cart = add();
    const result = addCartItem(cart, selection);
    assert.equal(result.type, 'replace-required'); assert.equal(result.cart, cart);
    const pending = cartReducer(stateFor(cart), { type: 'ADD', selection });
    assert.equal(pending.cart, cart); assert.equal(pending.revision, 0);
    const cancelled = cartReducer(pending, { type: 'CANCEL' });
    assert.equal(cancelled.cart, cart); assert.equal(cancelled.pending, null); assert.equal(cancelled.revision, 0);
  });
  test(`confirming ${name} replacement replaces all items and adds the selected food exactly once`, () => {
    const pending = cartReducer(stateFor(add()), { type: 'ADD', selection });
    const confirmed = cartReducer(pending, { type: 'CONFIRM' });
    assert.equal(confirmed.cart.restaurantId, selection.restaurantId);
    assert.equal(confirmed.cart.campusId, selection.campusId);
    assert.deepEqual(confirmed.cart.items.map((entry) => [entry.itemId, entry.quantity]), [[selection.itemId, 1]]);
    assert.equal(cartReducer(confirmed, { type: 'CONFIRM' }), confirmed);
  });
}

test('replacement revalidates the selected item at confirmation; failure preserves the original cart', () => {
  const original = add();
  const pending = cartReducer(stateFor(original), { type: 'ADD', selection: courtyard });
  const catalog = structuredClone(DEMO_RESTAURANTS);
  catalog.find((entry) => entry.id === courtyard.restaurantId).items.find((entry) => entry.id === courtyard.itemId).available = false;
  const result = cartReducer(pending, { type: 'CONFIRM' }, catalog);
  assert.equal(result.cart, original); assert.ok(result.pending); assert.match(result.error, /unavailable/);
});

test('additional add attempts cannot replace a pending decision', () => {
  const pending = cartReducer(stateFor(add()), { type: 'ADD', selection: courtyard });
  assert.equal(cartReducer(pending, { type: 'ADD', selection: { ...acacia, campusId: 'aau-5k' } }), pending);
});

test('quantity updates recompute totals and reject invalid or overflowing changes without altering the cart', () => {
  const cart = add();
  assert.deepEqual(cartTotals(setCartQuantity(cart, acacia.itemId, '3').cart), { quantity: 3, subtotalMinor: 33000 });
  for (const quantity of [0, -1, 0.5, '', Number.MAX_SAFE_INTEGER]) {
    const result = cartReducer(stateFor(cart), { type: 'QUANTITY', itemId: acacia.itemId, quantity });
    assert.equal(result.cart, cart); assert.ok(result.error); assert.equal(result.revision, 0);
  }
});

test('removal keeps other items and removing the last item yields a valid empty cart', () => {
  let state = stateFor(add(add(), { ...acacia, itemId: 'acacia-vegetable-plate' }));
  state = cartReducer(state, { type: 'REMOVE', itemId: acacia.itemId });
  assert.equal(state.cart.items.length, 1);
  state = cartReducer(state, { type: 'REMOVE', itemId: 'acacia-vegetable-plate' });
  assert.equal(state.cart, null); assert.equal(cartTotals(state.cart).quantity, 0);
});

test('clearing requires confirmation; cancellation preserves items and confirmation empties them', () => {
  const initial = stateFor(add());
  const pending = cartReducer(initial, { type: 'CLEAR' });
  assert.equal(pending.cart, initial.cart);
  assert.equal(cartReducer(pending, { type: 'CANCEL' }).cart, initial.cart);
  const cleared = cartReducer(pending, { type: 'CONFIRM' });
  assert.equal(cleared.cart, null); assert.equal(cleared.pending, null); assert.equal(cleared.context, initial.context);
});

test('a valid saved cart is rehydrated using catalog names, images, and prices', () => {
  const restored = restoreCart(JSON.stringify(saved()));
  assert.deepEqual(restored.notices, []);
  assert.equal(restored.cart.items[0].quantity, 2);
  assert.equal(restored.cart.items[0].image, '/demo/bowl.svg');
  assert.equal(restored.context.campusId, 'aau-4k');
});

test('malformed JSON, schemas and unsupported versions produce explicit empty-cart notices', () => {
  for (const raw of ['{bad', '[]', '123', '"cart"', JSON.stringify({ ...saved(), version: 2 }), JSON.stringify({ ...saved(), items: {} })]) {
    const result = restoreCart(raw);
    assert.equal(result.cart, null); assert.ok(result.notices.length > 0);
  }
  assert.deepEqual(restoreCart(null), { cart: null, notices: [], context: null });
});

test('invalid, duplicate, unavailable and missing saved items are removed with explanations', () => {
  const base = saved().items[0];
  const result = reconcileCart(saved({ items: [base, base, base, { ...base, quantity: 0 }, { ...base, itemId: 'acacia-sambusa' }, { ...base, itemId: 'removed-food', name: 'Removed sample food' }] }));
  assert.equal(result.cart.items.length, 1);
  assert.equal(result.cart.items[0].quantity, 2);
  assert.equal(new Set(result.notices).size, result.notices.length);
  for (const pattern of [/duplicate/, /invalid/, /unavailable/, /no longer/]) assert.ok(result.notices.some((message) => pattern.test(message)));
});

test('restoration rejects string/fractional quantities and non-finite, negative or missing stored prices', () => {
  for (const overrides of [{ quantity: '2' }, { quantity: 1.5 }, { quantity: Number.MAX_SAFE_INTEGER }, { unitPriceMinor: -1 }, { unitPriceMinor: NaN }, { unitPriceMinor: undefined }, { unitPriceMinor: 1.5 }]) {
    const result = reconcileCart(saved({ items: [{ ...saved().items[0], ...overrides }] }));
    assert.equal(result.cart, null); assert.ok(result.notices.length > 0);
  }
});

test('repriced catalog items replace saved prices with a clear before/after notice and new subtotal', () => {
  const catalog = structuredClone(DEMO_RESTAURANTS); catalog[0].items[0].price = 125.29;
  const result = restoreCart(JSON.stringify(saved()), catalog);
  assert.equal(result.cart.items[0].unitPriceMinor, 12529);
  assert.equal(cartTotals(result.cart).subtotalMinor, 25058);
  assert.match(result.notices[0], /110\.00 ETB to 125\.29 ETB/);
});

test('catalog availability, menu, coverage and restaurant removals invalidate stale saved data honestly', () => {
  for (const alter of [
    (catalog) => { catalog[0].items[0].available = false; }, (catalog) => { catalog[0].items = []; },
    (catalog) => { catalog[0].menuAvailable = false; }, (catalog) => { catalog[0].campusIds = ['aau-5k']; },
    (catalog) => { catalog.shift(); }, (catalog) => { catalog[0].items[0].price = Infinity; },
  ]) {
    const catalog = structuredClone(DEMO_RESTAURANTS); alter(catalog);
    const result = reconcileCart(saved(), catalog);
    assert.equal(result.cart, null); assert.ok(result.notices.length > 0);
  }
  assert.equal(reconcileCart(saved({ campusId: 'unknown' })).cart, null);
});

test('catalog rechecks are idempotent and report a changed subtotal without reusing stale prices', () => {
  const state = stateFor(add());
  assert.equal(cartReducer(state, { type: 'RECHECK' }), state);
  const catalog = structuredClone(DEMO_RESTAURANTS); catalog[0].items[0].price = 120;
  const changed = cartReducer(state, { type: 'RECHECK' }, catalog);
  assert.equal(changed.cart.items[0].unitPriceMinor, 12000); assert.ok(changed.notices.length);
  assert.equal(cartReducer(changed, { type: 'RECHECK' }, catalog), changed);
});

test('storage reads handle blocked getters and read errors without writing unknown saved data', () => {
  for (const getter of [() => { throw new Error('Blocked'); }, () => ({ getItem: () => { throw new Error('Blocked'); } })]) {
    const state = loadCart(getter);
    assert.equal(state.cart, null); assert.equal(state.readFailed, true); assert.equal(state.revision, 0); assert.match(state.storageWarning, /in-memory/);
  }
});

test('storage failures keep the in-memory cart usable and explain uncertain persistence on save/clear', () => {
  const cart = add();
  const getter = () => ({ setItem: () => { throw new Error('Quota'); }, removeItem: () => { throw new Error('Blocked'); } });
  assert.match(persistCart(cart, getter), /older cart/);
  assert.match(persistCart(null, getter), /older cart/);
  assert.equal(cartTotals(cart).quantity, 1);
});

test('persistence whitelists non-sensitive cart fields and never touches unrelated storage keys', () => {
  const values = new Map([['unrelated', 'keep']]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const cart = { ...add(), password: 'fixture-must-not-be-saved', token: 'fixture-must-not-be-saved' };
  cart.items[0].extra = 'not-a-cart-field';
  assert.equal(persistCart(cart, () => storage), '');
  const raw = values.get(CART_STORAGE_KEY);
  assert.ok(!raw.includes('fixture-must-not-be-saved') && !raw.includes('not-a-cart-field') && !raw.includes('image'));
  assert.equal(loadCart(() => storage).cart.items[0].quantity, 1);
  persistCart(null, () => storage);
  assert.equal(values.has(CART_STORAGE_KEY), false); assert.equal(values.get('unrelated'), 'keep');
});
