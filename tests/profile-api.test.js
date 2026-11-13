import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRestaurantProfile, saveRestaurantProfile } from '../src/utils/api.js';
import { parseRestaurantProfile, profileValues, validateProfileFields } from '../src/utils/profile.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const original = { id: 1, name: 'Fixture restaurant', email: 'owner@example.test', location: 'Campus gate', openingHours: '8 AM - 8 PM', cuisineType: 'Local' };
const changed = { ...profileValues(original), name: 'Updated fixture restaurant', email: 'new@example.test' };

// Simulated save support is evidence about this client, not the live backend.
const mockService = ({ readStatus = 200, writeStatus = 204, mode = 'confirmed', networkFailure = false } = {}) => {
  let profile = structuredClone(original);
  let wrote = false;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://kilo-eats-backend.onrender.com/restaurant');
    const method = options.method || 'GET';
    requests.push({ method, body: options.body && JSON.parse(options.body) });
    if (method === 'GET') {
      if (wrote && mode === 'bad-readback') return Response.json({ unexpected: true });
      if (wrote && mode === 'missing') return Response.json(null);
      if (wrote && mode === 'readback-failure') return Response.json({ error: 'Fixture error' }, { status: 503 });
      return Response.json(profile, { status: readStatus });
    }
    assert.equal(method, 'PATCH');
    if (networkFailure) throw new TypeError('Simulated connection loss');
    if (writeStatus >= 400) return Response.json({ error: 'Fixture error' }, { status: writeStatus });
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body), ['restaurant']);
    // Explicitly simulate both possible outcomes of the legacy nested payload.
    if (mode === 'nested-only') profile = { ...profile, restaurant: body.restaurant };
    else if (mode !== 'unchanged') profile = { ...body.restaurant, ...(mode === 'different-id' ? { id: 2 } : {}) };
    wrote = true;
    return new Response(null, { status: writeStatus });
  };
  return { requests, profile: () => profile };
};

test('reads only the evidenced flat profile and preserves the existing ID', async () => {
  mockService();
  assert.deepEqual(await fetchRestaurantProfile(), original);
  assert.deepEqual(parseRestaurantProfile({ ...original, name: '  Fixture restaurant  ' }), original);
});

test('empty/null/id-only profiles are unavailable; partial fields get honest missing values', () => {
  for (const data of [null, {}, { id: 1 }, { name: ' ', email: null }]) assert.equal(parseRestaurantProfile(data), null);
  assert.deepEqual(parseRestaurantProfile({ name: 'Only a name' }), { name: 'Only a name', email: '', location: '', openingHours: '', cuisineType: '' });
});

test('rejects unexpected nested or malformed responses instead of silently returning an empty profile', () => {
  for (const data of [[], 'bad', { restaurant: original }, { id: 1, restaurant: original }, { restuarant: original }, { item: original }, { name: {} }, { ...original, email: [] }, { ...original, id: {} }]) {
    assert.throws(() => parseRestaurantProfile(data), /unreadable restaurant details/);
  }
});

test('does not let nested legacy data override flat read fields', () => {
  assert.equal(parseRestaurantProfile({ ...original, restaurant: changed }).name, original.name);
});

test('read failures and invalid JSON reject visibly', async () => {
  mockService({ readStatus: 503 });
  await assert.rejects(fetchRestaurantProfile(), /HTTP 503/);
  globalThis.fetch = async () => new Response('<html>Unavailable</html>');
  await assert.rejects(fetchRestaurantProfile(), /unreadable restaurant details/);
  globalThis.fetch = async () => { throw new TypeError('Offline fixture'); };
  await assert.rejects(fetchRestaurantProfile(), /Offline fixture/);
});

test('204 without content is treated as unavailable', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await fetchRestaurantProfile(), null);
});

test('validates all existing required fields and email without restructuring hours or cuisine', () => {
  assert.deepEqual(Object.keys(validateProfileFields({})), ['name', 'email', 'location', 'openingHours', 'cuisineType']);
  assert.deepEqual(validateProfileFields(changed), {});
  assert.ok(validateProfileFields({ ...changed, email: 'not-an-email' }).email);
  assert.ok(validateProfileFields({ ...changed, location: ' ' }).location);
  assert.deepEqual(validateProfileFields({ ...changed, email: 'owner@campus', openingHours: 'Weekdays until late', cuisineType: 'Any existing text' }), {});
});

test('normalizes whitespace and excludes IDs/unknown fields from editable values', () => {
  const values = profileValues({ ...original, name: '  Cafe  ', extra: 'not editable' });
  assert.equal(values.name, 'Cafe');
  assert.equal(Object.hasOwn(values, 'id'), false);
  assert.equal(Object.hasOwn(values, 'extra'), false);
});

test('preserves the existing nested write format and confirms every field through a flat GET', async () => {
  const service = mockService();
  const result = await saveRestaurantProfile(original, { ...changed, name: ' Updated fixture restaurant ' });
  assert.deepEqual(result, { id: 1, ...changed });
  assert.deepEqual(service.requests.map(request => request.method), ['PATCH', 'GET']);
  assert.deepEqual(service.requests[0].body, { restaurant: { id: 1, ...changed } });
});

test('invalid forms and missing original profiles never send a write', async () => {
  const service = mockService();
  await assert.rejects(saveRestaurantProfile(original, { ...changed, email: '' }), /required profile fields/);
  await assert.rejects(saveRestaurantProfile(null, changed), /existing restaurant profile/);
  assert.equal(service.requests.length, 0);
});

test('failed PATCH leaves stored details unchanged and is never retried', async () => {
  const service = mockService({ writeStatus: 500 });
  await assert.rejects(saveRestaurantProfile(original, changed), /HTTP 500.*draft is kept/);
  assert.deepEqual(service.profile(), original);
  assert.equal(service.requests.length, 1);
});

test('connection loss produces an uncertain outcome and never tries a flat payload', async () => {
  const service = mockService({ networkFailure: true });
  await assert.rejects(saveRestaurantProfile(original, changed), /may have received.*draft is kept/);
  assert.equal(service.requests.length, 1);
  assert.deepEqual(Object.keys(service.requests[0].body), ['restaurant']);
});

for (const mode of ['nested-only', 'unchanged', 'different-id', 'missing']) {
  test(`2xx with ${mode} read-back cannot falsely claim a confirmed save`, async () => {
    const service = mockService({ mode });
    await assert.rejects(saveRestaurantProfile(original, changed), /read-back did not match/);
    assert.deepEqual(service.requests.map(request => request.method), ['PATCH', 'GET']);
  });
}

for (const mode of ['bad-readback', 'readback-failure']) {
  test(`${mode} keeps the outcome unconfirmed without repeating the write`, async () => {
    const service = mockService({ mode });
    await assert.rejects(saveRestaurantProfile(original, changed), /accepted the save.*could not be read back/);
    assert.equal(service.requests.filter(request => request.method === 'PATCH').length, 1);
  });
}
