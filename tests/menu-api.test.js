import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { addMenuItem, fetchMenuData, removeMenuItem, updateMenuItem } from '../src/utils/api.js';
import { hasUniqueMenuId, validateMenuFields } from '../src/utils/menu.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const food = { name: 'Pancakes', description: 'Freshly made', price: 50, image: '' };
const initial = [{ ...food, id: 2, rating: 5 }, { ...food, id: '8', price: 60 }];

// Every request is intercepted here. These tests never contact the live service.
const mockService = ({ items = initial, readStatus = 200, writeStatus = 200, networkFailure = false } = {}) => {
  let resource = { item: { restaurantName: 'Fixture only', menu: { title: 'Breakfast', menuItems: structuredClone(items) } } };
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://kilo-eats-backend.onrender.com/item');
    requests.push({ method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    if (options.method !== 'PATCH') return Response.json(resource, { status: readStatus });
    if (networkFailure) throw new TypeError('Simulated connection loss');
    if (writeStatus >= 400) return Response.json({ error: 'Fixture failure' }, { status: writeStatus });
    resource = { ...resource, ...JSON.parse(options.body) };
    return Response.json(resource);
  };
  return { requests, getResource: () => resource };
};

test('reads a genuine empty menu and rejects failed or malformed reads', async () => {
  mockService({ items: [] });
  assert.deepEqual(await fetchMenuData(), []);
  mockService({ readStatus: 503 });
  await assert.rejects(fetchMenuData(), /HTTP 503/);
  for (const body of [{}, { item: { menu: { menuItems: [null] } } }, { item: { menu: { menuItems: [{ name: {} }] } } }]) {
    globalThis.fetch = async () => Response.json(body);
    await assert.rejects(fetchMenuData(), /unreadable menu/);
  }
});

test('adds a same-name item without replacing existing entries or nested metadata', async () => {
  const service = mockService();
  const result = await addMenuItem(food);
  assert.equal(result.length, 3);
  assert.deepEqual(result.slice(0, 2), initial);
  assert.equal(result[2].id, 9);
  assert.equal(service.getResource().item.restaurantName, 'Fixture only');
  assert.equal(service.getResource().item.menu.title, 'Breakfast');
  assert.deepEqual(service.requests.map(request => request.method), ['GET', 'PATCH']);
});

test('edits only the selected ID among identically named items and preserves its ID and rating', async () => {
  mockService();
  const result = await updateMenuItem('2', { ...food, id: 999, price: 75 });
  assert.equal(result[0].id, 2);
  assert.equal(result[0].rating, 5);
  assert.equal(result[0].price, 75);
  assert.deepEqual(result[1], initial[1]);
});

test('removes only the selected ID among identically named items', async () => {
  mockService();
  assert.deepEqual(await removeMenuItem('8'), [initial[0]]);
});

test('refuses missing or ambiguous IDs without writing', async () => {
  const service = mockService({ items: [{ ...food }, { ...food, id: 1 }, { ...food, id: '1' }] });
  assert.equal(hasUniqueMenuId({ ...food }, service.getResource().item.menu.menuItems), false);
  await assert.rejects(updateMenuItem(1, food), /unique ID/);
  await assert.rejects(removeMenuItem(1), /unique ID/);
  await assert.rejects(removeMenuItem('missing'), /unique ID/);
  assert.ok(service.requests.every(request => request.method === 'GET'));
});

test('uses the latest menu before editing, retaining another entry added since the page loaded', async () => {
  const addedElsewhere = { ...food, id: 20, name: 'New from another session' };
  mockService({ items: [...initial, addedElsewhere] });
  const result = await updateMenuItem(2, { ...food, price: 90 });
  assert.deepEqual(result[2], addedElsewhere);
});

for (const [name, operation] of [
  ['add', () => addMenuItem(food)],
  ['edit', () => updateMenuItem(2, food)],
  ['remove', () => removeMenuItem(2)],
]) {
  test(`${name} rejects a failed PATCH without retrying or changing the stored menu`, async () => {
    const service = mockService({ writeStatus: 500 });
    await assert.rejects(operation(), /not saved.*HTTP 500/);
    assert.deepEqual(service.getResource().item.menu.menuItems, initial);
    assert.equal(service.requests.filter(request => request.method === 'PATCH').length, 1);
  });
}

test('connection loss reports an uncertain save and never retries automatically', async () => {
  const service = mockService({ networkFailure: true });
  await assert.rejects(addMenuItem(food), /Could not confirm the save.*may have received/);
  assert.equal(service.requests.filter(request => request.method === 'PATCH').length, 1);
});

test('read failure and ID exhaustion prevent PATCH requests', async () => {
  let service = mockService({ readStatus: 503 });
  await assert.rejects(addMenuItem(food), /HTTP 503/);
  assert.equal(service.requests.length, 1);
  service = mockService({ items: [{ ...food, id: Number.MAX_SAFE_INTEGER }] });
  await assert.rejects(addMenuItem(food), /ID could not be allocated/);
  assert.equal(service.requests.length, 1);
});

test('validates required fields, prices, and image URLs without requiring an image', () => {
  assert.deepEqual(validateMenuFields({ ...food, price: '50.25' }), {});
  assert.deepEqual(validateMenuFields({ ...food, price: '0' }), {});
  const errors = validateMenuFields({ name: ' ', description: '', price: '-2', image: 'javascript:bad' });
  assert.deepEqual(Object.keys(errors), ['name', 'description', 'price', 'image']);
  assert.ok(validateMenuFields({ ...food, price: '1.001' }).price);
  assert.ok(validateMenuFields({ ...food, price: '' }).price);
});
