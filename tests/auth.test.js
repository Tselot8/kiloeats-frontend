import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { AUTH_SERVICE, buildAuthPayload, submitAuth, validateAuthFields } from '../src/utils/auth.js';

const signup = { name: 'Fixture User', email: 'fixture@example.test', phone: '+251 900 000 000', campusId: 'aau-4k', password: 'synthetic-password', confirmPassword: 'synthetic-password' };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('signup validates all existing required fields, including confirmation', () => {
  assert.deepEqual(Object.keys(validateAuthFields('signup')), ['name', 'email', 'phone', 'campusId', 'password', 'confirmPassword']);
  assert.deepEqual(validateAuthFields('signup', signup), {});
  assert.ok(validateAuthFields('signup', { ...signup, name: ' ', phone: ' ' }).name);
  assert.ok(validateAuthFields('signup', { ...signup, confirmPassword: 'different' }).confirmPassword);
});

test('login requires email and password without adding owner or signup fields', () => {
  assert.deepEqual(Object.keys(validateAuthFields('login')), ['email', 'password']);
  assert.deepEqual(validateAuthFields('login', { email: signup.email, password: signup.password }), {});
});

test('email syntax matches existing form validation and rejects invalid addresses', () => {
  for (const email of ['invalid', 'two@@example.test', 'space here@example.test']) assert.ok(validateAuthFields('login', { email, password: 'synthetic' }).email);
  assert.deepEqual(validateAuthFields('login', { email: 'user@campus', password: 'synthetic' }), {});
});

test('no unsupported length, composition, or phone-format rule is invented', () => {
  for (const password of ['a', 'a very long plain password', ' leading and trailing ']) {
    assert.deepEqual(validateAuthFields('signup', { ...signup, phone: 'campus extension', password, confirmPassword: password }), {});
  }
});

test('signup payload excludes confirmation and arbitrary authorization/session fields', () => {
  const payload = buildAuthPayload('signup', { ...signup, name: ' Fixture User ', email: ' fixture@example.test ', role: 'Restaurant Owner', isAdmin: true, session: 'never forward' });
  assert.deepEqual(payload, { name: 'Fixture User', email: signup.email, phone: signup.phone, campusId: signup.campusId, password: signup.password });
  assert.equal(Object.hasOwn(payload, 'confirmPassword'), false);
  assert.equal(Object.hasOwn(payload, 'role'), false);
});

test('login payload contains only email and the exact untrimmed password', () => {
  const password = ' synthetic with spaces ';
  assert.deepEqual(buildAuthPayload('login', { ...signup, email: ' fixture@example.test ', password }), { email: signup.email, password });
});

test('invalid campuses, payloads, and modes cannot be submitted as valid inputs', () => {
  assert.throws(() => buildAuthPayload('signup', { ...signup, campusId: 'unknown-campus' }), /required authentication fields/);
  assert.throws(() => buildAuthPayload('login', {}), /required authentication fields/);
  assert.throws(() => buildAuthPayload('other', signup), /Unsupported/);
});

test('normal service is unavailable and never makes a request', async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('No live auth request is permitted'); };
  assert.equal(AUTH_SERVICE.available, false);
  assert.equal(Object.isFrozen(AUTH_SERVICE), true);
  assert.deepEqual(await submitAuth('signup', signup), { state: 'unavailable' });
  assert.deepEqual(await submitAuth('login', signup), { state: 'unavailable' });
  assert.equal(requests, 0);
});

test('unavailable adapter cannot receive credentials even when it has a submit method', async () => {
  let calls = 0;
  const result = await submitAuth('signup', signup, { available: false, submit() { calls++; } });
  assert.deepEqual(result, { state: 'unavailable' });
  assert.equal(calls, 0);
});

test('isolated success receives only the whitelisted payload and never creates a session result', async () => {
  let calls = 0;
  const result = await submitAuth('signup', signup, { available: true, async submit(mode, payload) {
    calls++;
    assert.equal(mode, 'signup');
    assert.equal(Object.hasOwn(payload, 'confirmPassword'), false);
    return { token: 'fixture-only-never-store', role: 'owner' };
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { state: 'success' });
});

test('isolated request failure returns a safe state without echoing credentials or retrying', async () => {
  let calls = 0;
  const result = await submitAuth('login', signup, { available: true, async submit() {
    calls++;
    throw new Error(`Sensitive fixture echo: ${signup.password}`);
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { state: 'error' });
  assert.equal(JSON.stringify(result).includes(signup.password), false);
});

test('invalid input never reaches an available fixture transport', async () => {
  let calls = 0;
  assert.deepEqual(await submitAuth('signup', { ...signup, confirmPassword: '' }, { available: true, async submit() { calls++; } }), { state: 'error' });
  assert.equal(calls, 0);
});
