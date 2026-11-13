import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessDecision, GUEST_IDENTITY, IDENTITY_SERVICE, identityDestination, normalizeIdentity, orderEligibility, safeReturnPath, submitSyntheticVerification, VERIFICATION_SERVICE, VERIFICATION_STATES } from '../src/utils/identity.js';
import { buildAuthPayload, validateAuthFields } from '../src/utils/auth.js';
import { CAMPUSES } from '../src/utils/studentBrowsing.js';
import { installRoleNetwork } from './fixtures/role-network.js';
import { merchantApiUrl } from '../src/utils/config.js';

const student = (status) => normalizeIdentity({ role: 'student', user: { id: 'synthetic', campusId: 'aau-4k' }, verification: { status } });
const staff = normalizeIdentity({ role: 'restaurant-staff', user: { id: 'staff' }, restaurantId: 'fixture-1' });
const admin = normalizeIdentity({ role: 'admin', user: { id: 'admin' } });

test('normal identity and verification adapters stay guest/unavailable without storage or network', async () => {
  assert.deepEqual(normalizeIdentity(await IDENTITY_SERVICE.read()), GUEST_IDENTITY);
  assert.equal(Object.isFrozen(IDENTITY_SERVICE), true);
  assert.equal(VERIFICATION_SERVICE.available, false);
});

for (const [name, identity, expected] of [
  ['guest', GUEST_IDENTITY, ['login-required', 'login-required', 'login-required']],
  ['student', student('not-submitted'), ['allowed', 'denied', 'denied']],
  ['staff', staff, ['denied', 'allowed', 'denied']],
  ['admin', admin, ['denied', 'denied', 'allowed']],
]) test(`${name} follows the student/merchant/admin matrix and can use public browsing/cart`, () => {
  assert.deepEqual(['student', 'merchant', 'admin'].map((area) => accessDecision(area, identity)), expected);
  assert.equal(accessDecision('public', identity), 'allowed');
});

test('loading, failed, malformed and unknown identities fail closed on protected routes', () => {
  for (const area of ['student', 'merchant', 'admin']) {
    assert.equal(accessDecision(area, { status: 'loading' }), 'loading');
    for (const value of [null, {}, { status: 'ready', role: 'owner' }, { ...admin, status: 'failed' }, { ...admin, status: 'unexpected' }]) {
      assert.equal(accessDecision(area, value), 'unavailable');
    }
  }
  assert.equal(accessDecision('invented', admin), 'denied');
});

test('unassigned staff and malformed student verification/campus identities cannot open workspaces', () => {
  for (const value of [
    { role: 'restaurant-staff', user: { id: 'staff' } },
    { role: 'student', user: { id: 's', campusId: 'bad' }, verification: { status: 'verified' } },
    { role: 'student', user: { id: 's', campusId: 'aau-4k' }, verification: { status: 'unknown' } },
    { role: 'admin', user: {} }, { ...admin, status: 'loading' },
  ]) assert.equal(normalizeIdentity(value).status, 'unavailable');
});

for (const status of VERIFICATION_STATES) test(`${status} can browse/account but only verified is a future order-eligible state`, () => {
  const identity = student(status);
  assert.equal(accessDecision('student', identity), 'allowed');
  assert.equal(accessDecision('public', identity), 'allowed');
  assert.equal(orderEligibility(identity), status === 'verified');
});

test('safe return links preserve only known internal paths and permitted navigation context', () => {
  assert.equal(safeReturnPath('/orders'), '/orders');
  assert.equal(safeReturnPath('/edit-menu?item=8&password=never-forward#private'), '/edit-menu?item=8');
  assert.equal(safeReturnPath('/cart?campus=aau-4k&role=admin'), '/cart?campus=aau-4k');
  assert.equal(safeReturnPath('/restaurant/Stable_ID?campus=aau-4k'), '/restaurant/Stable_ID?campus=aau-4k');
  for (const path of ['https://outside.invalid', '//outside.invalid', '/\\outside.invalid', '/%2f%2foutside.invalid', '/%0alogin', '/login?returnTo=/admin', '/signup', '/missing', null]) assert.equal(safeReturnPath(path), '/browse');
});

test('future destinations are filtered through the server-identity matrix; no guest session is invented', () => {
  assert.equal(identityDestination(staff), '/'); assert.equal(identityDestination(admin), '/admin');
  assert.equal(identityDestination(student('pending')), '/account');
  assert.equal(identityDestination(student('verified'), '/orders'), '/account');
  assert.equal(identityDestination(staff, '/account'), '/');
  assert.equal(identityDestination(GUEST_IDENTITY, '/admin'), '/browse');
  assert.equal(identityDestination({ status: 'ready', role: 'admin' }, '/admin'), '/browse');
});

test('student signup requires an agreed campus and never forwards roles or verification privileges', () => {
  const values = { name: 'Synthetic', email: 'synthetic@unconfirmed-domain', phone: 'extension', password: 'x', confirmPassword: 'x', role: 'admin', verified: true, restaurantId: 'other' };
  for (const campus of CAMPUSES) {
    const input = { ...values, campusId: campus.id };
    assert.deepEqual(validateAuthFields('signup', input), {});
    const payload = buildAuthPayload('signup', input);
    assert.deepEqual(Object.keys(payload).sort(), ['campusId', 'email', 'name', 'password', 'phone']);
  }
  assert.ok(validateAuthFields('signup', { ...values, campusId: 'other' }).campusId);
});

test('live verification stays unavailable even if an adapter supplies a non-synthetic submit function', async () => {
  let calls = 0;
  const service = { available: true, submitExample() { calls++; } };
  assert.deepEqual(await submitSyntheticVerification(student('not-submitted')), { state: 'unavailable' });
  assert.deepEqual(await submitSyntheticVerification(student('rejected'), service), { state: 'unavailable' });
  assert.equal(calls, 0);
});

test('synthetic submission/resubmission has no evidence payload and cannot approve a student or submit twice after pending', async () => {
  let calls = 0;
  const service = { available: true, synthetic: true, async submitExample(...args) { calls++; assert.deepEqual(args, []); } };
  assert.deepEqual(await submitSyntheticVerification(student('not-submitted'), service), { state: 'success' });
  assert.deepEqual(await submitSyntheticVerification(student('rejected'), service), { state: 'success' });
  for (const identity of [student('pending'), student('verified'), GUEST_IDENTITY, staff, admin]) assert.deepEqual(await submitSyntheticVerification(identity, service), { state: 'unavailable' });
  assert.equal(calls, 2);
  assert.deepEqual(await submitSyntheticVerification(student('rejected'), { ...service, async submitExample() { throw new Error('Synthetic failure'); } }), { state: 'error' });
});

test('the role harness resolves merchant writes locally and rejects unknown fetches without a network fallback', async () => {
  const originalWindow = globalThis.window;
  let escaped = 0;
  globalThis.window = { fetch() { escaped++; throw new Error('Must never use real fetch'); } };
  try {
    const network = installRoleNetwork();
    const response = await window.fetch(merchantApiUrl('/orders/1'), { method: 'PATCH', body: JSON.stringify({ status: 'Accepted' }) });
    assert.equal(response.status, 204);
    const orders = await (await window.fetch(merchantApiUrl('/orders'))).json();
    assert.equal(orders.orders[0].status, 'Accepted');
    await assert.rejects(window.fetch('https://unrecognized.invalid/register', { method: 'POST' }), /blocked/);
    assert.equal(escaped, 0); assert.ok(network.requests.every((entry) => entry.isolated));
  } finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; }
});
