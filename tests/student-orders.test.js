import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdentity, GUEST_IDENTITY, identityDestination, safeReturnPath } from '../src/utils/identity.js';
import { addCartItem } from '../src/utils/cart.js';
import { checkoutReviewKey, createCheckoutSession } from '../src/utils/checkout.js';
import { canCancelStudentOrder, createStudentOrderCancellations, createStudentOrdersClient, newestStudentOrder, parseStudentOrder, studentOrderPath, studentOrdersAvailable, studentStatusPresentation, STUDENT_ORDER_STATUSES } from '../src/utils/studentOrders.js';
import { createDemoCheckoutService } from './fixtures/checkout-service.js';
import { addStudentOrderScenarios } from './fixtures/student-order-scenarios.js';

const student = (id = 'synthetic-student-a', status = 'verified') => normalizeIdentity({ role: 'student', user: { id, campusId: 'aau-4k' }, verification: { status } });
const owner = student(), other = student('synthetic-student-b');
const placed = async (service = createDemoCheckoutService(), identity = owner) => {
  const cart = addCartItem(null, { restaurantId: 'demo-acacia-kitchen', campusId: 'aau-4k', itemId: 'acacia-shiro', quantity: 2 }).cart;
  const checkout = createCheckoutSession(service), dropoffs = await checkout.client.listDropoffs(identity, cart);
  const quote = await checkout.client.quote(identity, cart, dropoffs[0].id);
  await checkout.submit({ identity, cart, revision: 2, quote, reviewKey: checkoutReviewKey(quote, cart), dropoffs,
    delivery: { recipientName: identity.user.id === owner.user.id ? 'Fictional Recipient A' : 'Fictional Recipient B', contactPhone: '000 000 0000', dropoffId: quote.dropoffId, handoffInstructions: 'Synthetic instructions' }, isCurrent: () => true });
  assert.equal(checkout.getSnapshot().phase, 'confirmed');
  const client = createStudentOrdersClient(service), reference = checkout.getSnapshot().receipt.reference;
  return { service, checkout, client, reference, cart, order: await client.read(identity, reference), cancellations: createStudentOrderCancellations(client) };
};

test('confirmed checkout immediately appears in the same student history, with immutable receipt snapshots', async () => {
  const { service, checkout, client, reference, cart, order } = await placed();
  const list = await client.list(owner);
  assert.equal(service.orders.length, 1); assert.equal(list.length, 1); assert.equal(list[0].reference, reference);
  assert.equal(list[0].totalMinor, checkout.getSnapshot().receipt.totals.totalMinor);
  assert.equal(order.restaurantName, cart.restaurantName); assert.equal(order.items[0].name, 'Shiro with injera');
  assert.equal(order.paymentMethod, 'cash-on-delivery'); assert.equal(order.status, 'Pending');
  assert.equal(order.confirmedAt, checkout.getSnapshot().receipt.confirmedAt);
  service.catalog[0].items[0].name = 'Changed future menu name'; service.catalog[0].items[0].price = 999;
  list[0].items[0].name = 'Caller edit'; cart.items[0].name = 'Caller cart edit';
  assert.equal((await client.read(owner, reference)).items[0].name, 'Shiro with injera');
  assert.equal((await client.read(owner, reference)).items[0].unitPriceMinor, 11000);
});

test('service and UI adapter scope lists, details, cancellation and lookup to the current student', async () => {
  const first = await placed(), second = await placed(first.service, other);
  assert.deepEqual((await first.client.list(owner)).map((order) => order.reference), [first.reference]);
  assert.deepEqual((await first.client.list(other)).map((order) => order.reference), [second.reference]);
  assert.equal(await first.client.read(other, first.reference), null);
  const response = await first.service.cancelOrder({ identity: other, reference: first.reference, version: 1, operationId: 'foreign-attempt' });
  assert.equal(response.outcome, 'not-found'); assert.equal('order' in response, false);
  await first.cancellations.cancel(owner, first.order);
  const operationId = first.cancellations.getSnapshot(owner, first.reference).attempt.operationId;
  const lookup = await first.service.lookupCancellation({ identity: other, reference: first.reference, operationId });
  assert.equal(lookup.outcome, 'not-found'); assert.equal('order' in lookup, false);
  assert.equal(first.cancellations.getSnapshot(other, first.reference).phase, 'idle');
  assert.equal(JSON.stringify(await first.client.list(other)).includes('Fictional Recipient A'), false);
});

test('guests, staff, admins and malformed/loading identities never invoke the order service', async () => {
  const service = createDemoCheckoutService(), client = createStudentOrdersClient(service);
  for (const identity of [GUEST_IDENTITY, normalizeIdentity({ role: 'admin', user: { id: 'admin' } }), normalizeIdentity({ role: 'restaurant-staff', user: { id: 'staff' }, restaurantId: 'assigned' }), { status: 'loading' }, { status: 'ready', role: 'unknown' }]) {
    await assert.rejects(client.list(identity)); await assert.rejects(client.read(identity, 'DEMO-0001'));
    await assert.rejects(client.cancel(identity, {})); await assert.rejects(client.reconcile(identity, {}));
    await assert.rejects(async () => service.listOrders({ identity })); await assert.rejects(async () => service.readOrder({ identity, reference: 'DEMO-0001' }));
    await assert.rejects(async () => service.cancelOrder({ identity, reference: 'DEMO-0001' }));
    await assert.rejects(async () => service.lookupCancellation({ identity, reference: 'DEMO-0001' }));
  }
  assert.deepEqual(service.requests, []);
});

test('history and Pending cancellation remain student-owned even if current verification is no longer verified', async () => {
  const { client, reference, cancellations } = await placed();
  const identity = student(owner.user.id, 'rejected');
  const order = await client.read(identity, reference);
  assert.equal((await client.list(identity)).length, 1);
  await cancellations.cancel(identity, order); assert.equal(cancellations.getSnapshot(identity, reference).phase, 'confirmed');
});

test('normal and non-synthetic services remain unavailable', async () => {
  assert.equal(studentOrdersAvailable(), false); assert.equal(studentOrdersAvailable(null), false);
  assert.equal(studentOrdersAvailable({ ...createDemoCheckoutService(), synthetic: false }), false);
  await assert.rejects(createStudentOrdersClient().list(owner), /unavailable/);
});

test('student order return paths preserve references but never delivery fields or cross-role destinations', () => {
  assert.equal(studentOrderPath('DEMO-0001'), '/student/orders/DEMO-0001');
  assert.equal(studentOrderPath('https://outside.invalid'), '/student/orders');
  assert.equal(safeReturnPath('/STUDENT/ORDERS/demo-0001?phone=0000000000&instructions=synthetic#private'), '/student/orders/DEMO-0001');
  assert.equal(identityDestination(student(owner.user.id, 'pending'), '/student/orders/DEMO-0001'), '/student/orders/DEMO-0001');
  assert.equal(identityDestination(normalizeIdentity({ role: 'admin', user: { id: 'a' } }), '/student/orders/DEMO-0001'), '/admin');
  assert.equal(safeReturnPath('/student/orders/%2f%2foutside.invalid'), '/browse');
});

test('receipt parsing rejects foreign orders, bad statuses/versions, incoherent progress and invalid amounts', async () => {
  const { service } = await placed(); const raw = service.orders[0];
  for (const patch of [{ studentId: other.user.id }, { status: 'Done' }, { version: 0 }, { deliveryFeeMinor: 10000 }, { totalMinor: 1 }, { confirmedAt: 9e15 }, { items: [] },
    { statusEvents: [{ status: 'Delivered', at: 1 }, { status: 'Pending', at: 2 }] }, { statusEvents: [{ status: 'Pending', at: 2 }, { status: 'Pending', at: 1 }] }]) {
    assert.throws(() => parseStudentOrder({ ...raw, ...patch }, owner), /invalid|belong/);
  }
});

test('optional unrecorded details stay missing and are not filled from the current menu or campus assumptions', async () => {
  const { service } = await placed(); const raw = structuredClone(service.orders[0]);
  delete raw.restaurantName; delete raw.paymentMethod; delete raw.confirmedAt; delete raw.delivery; delete raw.statusEvents; delete raw.items[0].name;
  const order = parseStudentOrder(raw, owner);
  assert.equal(order.restaurantName, ''); assert.equal(order.items[0].name, ''); assert.equal(order.paymentMethod, null);
  assert.equal(order.confirmedAt, null); assert.deepEqual(order.statusEvents, []); assert.equal(order.delivery.recipientName, '');
});

test('list parsing distinguishes valid empty history from network failure, malformed or cross-student responses', async () => {
  const fixture = createDemoCheckoutService(); assert.deepEqual(await createStudentOrdersClient(fixture).list(owner), []);
  for (const response of [null, {}, [null]]) {
    const client = createStudentOrdersClient({ ...fixture, async listOrders() { return response; } });
    await assert.rejects(client.list(owner), /malformed|invalid/);
  }
  const { service } = await placed();
  const client = createStudentOrdersClient({ ...service, async listOrders() { return [{ ...service.orders[0], studentId: other.user.id }]; } });
  await assert.rejects(client.list(owner), /belong/);
  await assert.rejects(createStudentOrdersClient({ ...service, async listOrders() { throw new Error('Synthetic offline'); } }).list(owner), /offline/);
});

test('missing and reset-service references return honest missing data, never another receipt or a fabricated order', async () => {
  const { client, reference } = await placed();
  assert.equal(await client.read(owner, 'DEMO-UNKNOWN'), null);
  assert.equal(await createStudentOrdersClient(createDemoCheckoutService()).read(owner, reference), null);
  assert.equal(await client.read(owner, '../other-order'), null);
});

test('read-only refresh does not progress an order and simulated progress uses only the supported lifecycle', async () => {
  const { service, client, reference } = await placed();
  assert.equal((await client.read(owner, reference)).status, 'Pending');
  assert.equal((await client.read(owner, reference)).version, 1);
  assert.throws(() => service.simulateOrderStatus(reference, 'Ready'), /Unsupported/);
  for (const status of ['Accepted', 'Ready', 'Delivered']) {
    service.simulateOrderStatus(reference, status);
    const order = await client.read(owner, reference), presentation = studentStatusPresentation(order);
    assert.equal(presentation.steps.find((step) => step.state === 'current').status, status);
    if (status === 'Ready') assert.match(presentation.description, /does not mean delivered/);
  }
  assert.throws(() => service.simulateOrderStatus(reference, 'Accepted'), /Unsupported/);
});

test('Declined and Cancelled are separate terminal outcomes and never mark delivery as completed', async () => {
  for (const status of ['Declined', 'Cancelled']) {
    const { service, client, cancellations, order, reference } = await placed();
    if (status === 'Declined') service.simulateOrderStatus(reference, status); else await cancellations.cancel(owner, order);
    const current = await client.read(owner, reference), presentation = studentStatusPresentation(current);
    assert.equal(presentation.terminal, true); assert.equal(current.status, status);
    assert.equal(presentation.steps.find((step) => step.status === 'Delivered').state, 'not-reached');
    assert.equal(canCancelStudentOrder(current), false); assert.throws(() => service.simulateOrderStatus(reference, 'Accepted'), /Unsupported/);
  }
});

test('Pending cancellation records a confirmed outcome without changing receipt amounts or item snapshots', async () => {
  const { cancellations, client, order, reference } = await placed();
  await cancellations.cancel(owner, order);
  assert.equal(cancellations.getSnapshot(owner, reference).phase, 'confirmed');
  const current = await client.read(owner, reference);
  assert.equal(current.status, 'Cancelled'); assert.equal(current.version, 2);
  assert.deepEqual(current.items, order.items); assert.equal(current.totalMinor, order.totalMinor);
  assert.equal(current.statusEvents.at(-1).status, 'Cancelled');
});

test('duplicate cancellation clicks share one pending operation; repeated service IDs cannot cancel twice', async () => {
  let release; const wait = new Promise((resolve) => { release = resolve; });
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'cancel-before') await wait; } });
  const { cancellations, order, reference } = await placed(service);
  const first = cancellations.cancel(owner, order), second = cancellations.cancel(owner, order);
  assert.equal(first, second); release(); await Promise.all([first, second]);
  assert.equal(service.requests.filter((request) => request.operation === 'cancel').length, 1);
  const attempt = cancellations.getSnapshot(owner, reference).attempt;
  assert.equal((await service.cancelOrder({ identity: owner, ...attempt })).outcome, 'cancelled');
  assert.equal(service.orders[0].statusEvents.filter((event) => event.status === 'Cancelled').length, 1);
});

test('non-Pending orders cannot cancel locally or through the service', async () => {
  const { service, client, cancellations, reference } = await placed(); service.simulateOrderStatus(reference, 'Accepted');
  const order = await client.read(owner, reference);
  await cancellations.cancel(owner, order);
  assert.equal(service.requests.filter((request) => request.operation === 'cancel').length, 0);
  const response = await service.cancelOrder({ identity: owner, reference, version: order.version, operationId: 'already-accepted' });
  assert.equal(response.outcome, 'rejected'); assert.equal(response.code, 'NOT_PENDING'); assert.equal(service.orders[0].status, 'Accepted');
});

test('concurrent acceptance wins atomically over a stale Pending cancellation and is reported visibly', async () => {
  let release; const wait = new Promise((resolve) => { release = resolve; });
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'cancel-before') await wait; } });
  const { cancellations, order, reference } = await placed(service);
  const pending = cancellations.cancel(owner, order); await Promise.resolve();
  service.simulateOrderStatus(reference, 'Accepted'); release(); await pending;
  const state = cancellations.getSnapshot(owner, reference);
  assert.equal(state.phase, 'stale'); assert.equal(state.order.status, 'Accepted'); assert.match(state.error, /not applied/);
  assert.equal(service.orders[0].statusEvents.some((event) => event.status === 'Cancelled'), false);
});

test('a confirmed cancellation prevents later acceptance of the same order', async () => {
  const { service, cancellations, order, reference } = await placed(); await cancellations.cancel(owner, order);
  assert.throws(() => service.simulateOrderStatus(reference, 'Accepted'), /Unsupported/);
});

test('confirmed failure preserves the order and retries only on explicit review with the same stable operation ID', async () => {
  let reject = true;
  const service = createDemoCheckoutService({ before: async (operation) => operation === 'cancel-before' && reject ? { outcome: 'rejected', code: 'FAILED' } : undefined });
  const { cancellations, order, reference } = await placed(service);
  await cancellations.cancel(owner, order); const first = cancellations.getSnapshot(owner, reference);
  assert.equal(first.phase, 'failed'); assert.equal(service.orders[0].status, 'Pending');
  assert.equal(service.requests.filter((request) => request.operation === 'cancel').length, 1);
  reject = false; await cancellations.cancel(owner, order);
  assert.equal(cancellations.getSnapshot(owner, reference).attempt.operationId, first.attempt.operationId);
  assert.equal(cancellations.getSnapshot(owner, reference).phase, 'confirmed');
});

test('a lost post-cancellation response is reconciled read-only without another cancellation write', async () => {
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'cancel-after') throw new Error('Synthetic lost response'); } });
  const { cancellations, order, reference } = await placed(service);
  await cancellations.cancel(owner, order); assert.equal(cancellations.getSnapshot(owner, reference).phase, 'uncertain');
  assert.equal(service.orders[0].status, 'Cancelled');
  await cancellations.cancel(owner, order); assert.equal(service.requests.filter((request) => request.operation === 'cancel').length, 1);
  await cancellations.reconcile(owner, reference);
  assert.equal(cancellations.getSnapshot(owner, reference).phase, 'confirmed');
  assert.equal(service.requests.at(-1).operation, 'cancel-lookup');
});

test('unknown pre-recording outcomes and failed lookups remain reserved and never automatically repeat writes', async () => {
  let lookupFails = true;
  const service = createDemoCheckoutService({ before: async (operation) => { if (operation === 'cancel-before' || (operation === 'cancel-lookup' && lookupFails)) throw new Error('Synthetic uncertainty'); } });
  const { cancellations, order, reference } = await placed(service);
  await cancellations.cancel(owner, order); await cancellations.reconcile(owner, reference);
  assert.equal(cancellations.getSnapshot(owner, reference).phase, 'uncertain'); assert.match(cancellations.getSnapshot(owner, reference).error, /could not be checked/);
  lookupFails = false; await cancellations.reconcile(owner, reference);
  assert.match(cancellations.getSnapshot(owner, reference).error, /does not prove/);
  await cancellations.cancel(owner, order);
  assert.equal(service.requests.filter((request) => request.operation === 'cancel').length, 1); assert.equal(service.orders[0].status, 'Pending');
});

test('malformed post-write cancellation responses cannot falsely claim success; lookup can recover the actual result', async () => {
  const service = createDemoCheckoutService({ before: async (operation) => operation === 'cancel-after' ? { malformed: true } : undefined });
  const { cancellations, order, reference } = await placed(service); await cancellations.cancel(owner, order);
  assert.equal(cancellations.getSnapshot(owner, reference).phase, 'uncertain');
  await cancellations.reconcile(owner, reference); assert.equal(cancellations.getSnapshot(owner, reference).phase, 'confirmed');
});

test('a rejection without its current order snapshot cannot claim a confirmed stale status', async () => {
  const { client, order, reference } = await placed();
  const cancellations = createStudentOrderCancellations({ ...client,
    async cancel(identity, attempt) { return { outcome: 'rejected', code: 'STALE', operationId: attempt.operationId }; } });
  await cancellations.cancel(owner, order);
  const state = cancellations.getSnapshot(owner, reference);
  assert.equal(state.phase, 'uncertain'); assert.equal(state.order.status, 'Pending');
  assert.equal(state.updatedAt, 0); assert.match(state.error, /could not be confirmed/);
});

test('missing cancellation-operation lookup is uncertainty, not proof that a request failed', async () => {
  const { service, client, order, reference } = await placed();
  const cancellations = createStudentOrderCancellations({ ...client,
    async cancel() { throw new Error('Synthetic unknown outcome'); }, async reconcile(identity, attempt) { return service.lookupCancellation({ identity, ...attempt }); } });
  await cancellations.cancel(owner, order); await cancellations.reconcile(owner, reference);
  assert.equal(cancellations.getSnapshot(owner, reference).phase, 'uncertain'); assert.match(cancellations.getSnapshot(owner, reference).error, /does not prove/);
});

test('validated newer cancellation snapshots prevent a late or failed refresh from regressing the displayed order', async () => {
  const { cancellations, order, reference } = await placed(); await cancellations.cancel(owner, order);
  const confirmed = cancellations.getSnapshot(owner, reference);
  assert.equal(newestStudentOrder(order, confirmed).status, 'Cancelled');
  assert.equal(order.status, 'Pending');
  const fresh = { ...confirmed.order, version: 3 };
  assert.equal(newestStudentOrder(fresh, confirmed), fresh);
});

test('aborted reads and read failures reject without converting earlier valid details to empty data', async () => {
  let fail = false;
  const service = createDemoCheckoutService({ before: async (operation) => { if (fail && operation.startsWith('order-')) throw new Error('Synthetic read failure'); } });
  const { client, reference, order } = await placed(service); fail = true;
  await assert.rejects(client.list(owner), /failure/); await assert.rejects(client.read(owner, reference), /failure/); assert.equal(order.status, 'Pending');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.list(owner, { signal: controller.signal }), { name: 'AbortError' });
});

test('deterministic lifecycle examples are submitted into the checkout collection and scoped by student', async () => {
  const service = createDemoCheckoutService(), originalCollection = service.orders;
  await addStudentOrderScenarios(service, owner, other);
  const client = createStudentOrdersClient(service), mine = await client.list(owner), theirs = await client.list(other);
  assert.equal(service.orders, originalCollection); assert.equal(service.orders.length, 7);
  assert.deepEqual(mine.map((order) => order.status).sort(), [...STUDENT_ORDER_STATUSES].sort());
  assert.equal(theirs.length, 1); assert.equal(service.requests.filter((request) => request.operation === 'submit').length, 7);
  assert.equal(JSON.stringify(service.requests).includes('Fictional Lifecycle Recipient'), false);
  assert.equal(JSON.stringify(service.requests).includes('000 000 0000'), false);
});
