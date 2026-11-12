import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { changeOrderStatus, deleteOrder, fetchOrders } from '../src/utils/api.js';
import { canChangeOrderStatus, orderStatus, parseOrders } from '../src/utils/orders.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const initial = [
  { id: 1, items: ['Pancakes', 'Tea'], totalPrice: 65.5, status: 'Pending' },
  { id: '2', items: ['Stew'], totalPrice: '90', status: 'Accepted' },
];

// All reads and writes are isolated fixtures, never requests to the live service.
const mockService = ({ readStatus = 200, writeStatus = 200, apply = true, failNetwork = false, badReadback = false, items = initial } = {}) => {
  let orders = structuredClone(items);
  let wrote = false;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    requests.push({ url, method, body: options.body && JSON.parse(options.body) });
    if (method === 'GET') {
      assert.equal(url, 'https://kilo-eats-backend.onrender.com/orders');
      return Response.json(wrote && badReadback ? { unexpected: true } : { orders }, { status: readStatus });
    }
    if (failNetwork) throw new TypeError('Simulated connection loss');
    if (writeStatus >= 400) return Response.json({ error: 'Simulated failure' }, { status: writeStatus });
    const id = decodeURIComponent(url.split('/').at(-1));
    if (apply) orders = method === 'DELETE'
      ? orders.filter(order => String(order.id) !== id)
      : orders.map(order => String(order.id) === id ? { ...order, ...JSON.parse(options.body) } : order);
    wrote = true;
    return new Response(null, { status: 204 });
  };
  return { requests, getOrders: () => orders };
};

test('reads the existing wrapped contract, including string totals and genuinely empty lists', async () => {
  mockService();
  assert.deepEqual(await fetchOrders(), initial);
  mockService({ items: [] });
  assert.deepEqual(await fetchOrders(), []);
});

test('failed reads reject instead of becoming an empty orders list', async () => {
  mockService({ readStatus: 503 });
  await assert.rejects(fetchOrders(), /HTTP 503/);
  globalThis.fetch = async () => { throw new TypeError('Offline fixture'); };
  await assert.rejects(fetchOrders(), /Offline fixture/);
});

test('rejects unexpected wrappers, malformed entries, duplicate IDs, and invalid fields', () => {
  const malformed = [
    [], {}, { orders: null }, { orders: [null] },
    { orders: [initial[0], { ...initial[0], id: '1' }] },
    ...[{ id: '' }, { id: '..' }, { items: 'Pancakes' }, { items: [{}] }, { totalPrice: '' },
      { totalPrice: true }, { totalPrice: -1 }, { totalPrice: 'NaN' }, { status: null }]
      .map(overrides => ({ orders: [{ ...initial[0], ...overrides }] })),
  ];
  for (const value of malformed) assert.throws(() => parseOrders(value), /unreadable|invalid|ambiguous/);
});

test('invalid JSON is surfaced as an unreadable list', async () => {
  globalThis.fetch = async () => new Response('<html>Service unavailable</html>');
  await assert.rejects(fetchOrders(), /unreadable orders list/);
});

test('unknown statuses are displayed verbatim without inventing supported transitions', () => {
  assert.equal(parseOrders({ orders: [{ ...initial[0], status: 'Unexpected' }] })[0].status, 'Unexpected');
  assert.equal(orderStatus('Unexpected').tone, 'unknown');
  assert.equal(canChangeOrderStatus('Unexpected', 'Accepted'), false);
});

test('keeps supported transitions and labels Done as preparation ready', () => {
  assert.ok(canChangeOrderStatus('Pending', 'Accepted'));
  assert.ok(canChangeOrderStatus('Pending', 'Declined'));
  assert.ok(canChangeOrderStatus('Accepted', 'Done'));
  for (const status of ['Done', 'Declined']) assert.equal(canChangeOrderStatus(status, 'Accepted'), false);
  assert.equal(orderStatus('Done').label, 'Ready');
  assert.match(orderStatus('Done').detail, /preparation/);
});

for (const status of ['Accepted', 'Declined']) {
  test(`confirms Pending to ${status} through a fresh GET after one PATCH`, async () => {
    const service = mockService();
    const updated = await changeOrderStatus(initial[0], status);
    assert.equal(updated.status, status);
    assert.deepEqual(service.requests.map(request => request.method), ['PATCH', 'GET']);
    assert.deepEqual(service.requests[0].body, { status });
  });
}

test('ready uses Done and deletion uses the existing DELETE endpoint', async () => {
  let service = mockService();
  assert.equal((await changeOrderStatus(initial[1], 'Done')).status, 'Done');
  assert.deepEqual(service.requests[0].body, { status: 'Done' });
  service = mockService();
  assert.equal(await deleteOrder(initial[1]), undefined);
  assert.equal(service.getOrders().length, 1);
  assert.deepEqual(service.requests.map(request => request.method), ['DELETE', 'GET']);
});

test('unsupported transitions and deletion of unaccepted orders never send a request', async () => {
  const service = mockService();
  await assert.rejects(changeOrderStatus(initial[0], 'Delivered'), /unavailable/);
  await assert.rejects(changeOrderStatus(initial[1], undefined), /unavailable/);
  await assert.rejects(changeOrderStatus({ ...initial[0], status: 'Done' }, 'Accepted'), /unavailable/);
  await assert.rejects(deleteOrder(initial[0]), /unavailable/);
  assert.equal(service.requests.length, 0);
});

for (const [name, action] of [
  ['accept', () => changeOrderStatus(initial[0], 'Accepted')],
  ['decline', () => changeOrderStatus(initial[0], 'Declined')],
  ['ready', () => changeOrderStatus(initial[1], 'Done')],
  ['delete', () => deleteOrder(initial[1])],
]) {
  test(`${name} rejects failed writes without retrying or changing the fixture`, async () => {
    const service = mockService({ writeStatus: 500 });
    await assert.rejects(action(), /HTTP 500.*No change has been confirmed/);
    assert.equal(service.requests.length, 1);
    assert.deepEqual(service.getOrders(), initial);
  });
}

test('network loss has an uncertain outcome and never retries the mutation', async () => {
  const service = mockService({ failNetwork: true });
  await assert.rejects(changeOrderStatus(initial[0], 'Accepted'), /may have received.*Refresh orders/);
  assert.equal(service.requests.length, 1);
});

test('a 2xx response alone is insufficient if readback fails or shows no change', async () => {
  let service = mockService({ apply: false });
  await assert.rejects(changeOrderStatus(initial[0], 'Accepted'), /not confirmed the expected/);
  assert.deepEqual(service.requests.map(request => request.method), ['PATCH', 'GET']);
  service = mockService({ badReadback: true });
  await assert.rejects(deleteOrder(initial[1]), /request.*result could not be confirmed/);
  assert.equal(service.requests.filter(request => request.method === 'DELETE').length, 1);
});

test('a successful delete is not shown as complete while the record is still listed', async () => {
  mockService({ apply: false });
  await assert.rejects(deleteOrder(initial[1]), /not confirmed the expected/);
});

test('string IDs are encoded as one path segment', async () => {
  const order = { ...initial[0], id: 'order/with space' };
  const service = mockService({ items: [order] });
  await changeOrderStatus(order, 'Accepted');
  assert.equal(service.requests[0].url, 'https://kilo-eats-backend.onrender.com/orders/order%2Fwith%20space');
});
