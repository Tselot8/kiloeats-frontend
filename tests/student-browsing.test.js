import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_RESTAURANTS } from '../src/data/demoRestaurants.js';
import { CAMPUSES, browsePath, createDemoBrowsingService, findCampus, restaurantPath, studentBrowsing } from '../src/utils/studentBrowsing.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('campus IDs/names match the four agreed campuses without inferring a default', () => {
  assert.deepEqual(CAMPUSES.map((campus) => campus.name), ['AAU 4K', 'AAU 5K', 'AAU 6K', 'Yared Music School']);
  assert.equal(new Set(CAMPUSES.map((campus) => campus.id)).size, 4);
  for (const id of [undefined, null, '', 'AAU 4K', 'aau-7k', '__proto__', 4]) assert.equal(findCampus(id), null);
});

for (const campus of CAMPUSES) {
  test(`${campus.name}: lists only matching restaurants and looks up their menus by stable ID`, async () => {
    const restaurants = await studentBrowsing.listRestaurants(campus.id);
    assert.ok(restaurants.length > 0);
    assert.deepEqual(restaurants.map((entry) => entry.id), DEMO_RESTAURANTS.filter((entry) => entry.campusIds.includes(campus.id)).map((entry) => entry.id));
    assert.ok(restaurants.every((entry) => !Object.hasOwn(entry, 'items')));
    for (const restaurant of restaurants) {
      const menu = await studentBrowsing.getRestaurantMenu(restaurant.id, campus.id);
      assert.equal(menu.restaurant.id, restaurant.id);
      assert.equal(menu.campus.id, campus.id);
      assert.ok(['ready', 'unavailable'].includes(menu.state));
    }
  });
}

test('catalog has unique stable restaurant/food IDs, valid coverage, prices, and explicit availability', () => {
  const ids = new Set();
  for (const restaurant of DEMO_RESTAURANTS) {
    assert.ok(!ids.has(restaurant.id)); ids.add(restaurant.id);
    assert.ok(restaurant.name.includes('Demo'));
    assert.ok(restaurant.campusIds.length > 0 && restaurant.campusIds.every(findCampus));
    assert.equal(new Set(restaurant.campusIds).size, restaurant.campusIds.length);
    for (const item of restaurant.items) {
      assert.ok(!ids.has(item.id)); ids.add(item.id);
      assert.ok(Number.isFinite(item.price) && item.price >= 0);
      assert.equal(typeof item.available, 'boolean');
      assert.ok(item.name && item.description);
    }
    for (const field of ['rating', 'reviews', 'distance', 'deliveryFee', 'deliveryEstimate']) assert.ok(!Object.hasOwn(restaurant, field));
  }
});

test('unavailable foods remain visible and distinct from available foods', async () => {
  const result = await studentBrowsing.getRestaurantMenu('demo-acacia-kitchen', 'aau-4k');
  assert.equal(result.state, 'ready');
  assert.equal(result.items.find((item) => item.id === 'acacia-sambusa').available, false);
  assert.ok(result.items.some((item) => item.available));
});

test('an empty menu, unavailable menu, and genuinely empty restaurant list are distinct', async () => {
  const empty = await studentBrowsing.getRestaurantMenu('demo-sunroom-kitchen', 'aau-5k');
  assert.equal(empty.state, 'ready'); assert.deepEqual(empty.items, []);
  const unavailable = await studentBrowsing.getRestaurantMenu('demo-hilltop-canteen', 'aau-4k');
  assert.equal(unavailable.state, 'unavailable'); assert.deepEqual(unavailable.items, []);
  assert.deepEqual(await createDemoBrowsingService([]).listRestaurants('aau-4k'), []);
});

test('invalid campus values never silently return all restaurants or menus', async () => {
  for (const campusId of [undefined, null, '', 'wrong-campus', '__proto__']) {
    await assert.rejects(studentBrowsing.listRestaurants(campusId), /supported campus/);
    const menu = await studentBrowsing.getRestaurantMenu('demo-acacia-kitchen', campusId);
    assert.equal(menu.state, campusId ? 'invalid-campus' : 'choose-campus');
    assert.deepEqual(menu.items, []);
  }
});

test('known but unsupported campus combinations keep restaurant coverage for recovery, hiding menu data', async () => {
  const menu = await studentBrowsing.getRestaurantMenu('demo-acacia-kitchen', 'yared-music-school');
  assert.equal(menu.state, 'unsupported-campus');
  assert.deepEqual(menu.restaurant.campusIds, ['aau-4k', 'aau-5k']);
  assert.deepEqual(menu.items, []);
});

test('missing/invalid restaurant IDs reject instead of selecting the first restaurant', async () => {
  for (const id of [undefined, null, '', '1', '__proto__', '../demo-acacia-kitchen']) {
    await assert.rejects(studentBrowsing.getRestaurantMenu(id, 'aau-4k'), (error) => error.code === 'RESTAURANT_NOT_FOUND');
  }
});

test('results are independent snapshots; callers cannot overwrite another read or its availability', async () => {
  const restaurants = await studentBrowsing.listRestaurants('aau-4k');
  restaurants[0].campusIds.length = 0;
  const menu = await studentBrowsing.getRestaurantMenu('demo-acacia-kitchen', 'aau-4k');
  menu.items[0].name = 'Changed only in this test'; menu.items[0].available = false;
  const reread = await studentBrowsing.getRestaurantMenu('demo-acacia-kitchen', 'aau-4k');
  assert.equal(reread.items[0].name, 'Shiro with injera');
  assert.equal(reread.items[0].available, true);
  assert.ok(reread.restaurant.campusIds.includes('aau-4k'));
});

test('asynchronous reads honour cancellation before and during resolution', async () => {
  const before = new AbortController(); before.abort();
  await assert.rejects(studentBrowsing.listRestaurants('aau-4k', { signal: before.signal }), { name: 'AbortError' });
  const during = new AbortController();
  const promise = studentBrowsing.getRestaurantMenu('demo-acacia-kitchen', 'aau-4k', { signal: during.signal });
  during.abort();
  await assert.rejects(promise, { name: 'AbortError' });
});

test('browsing never calls live services or merchant APIs', async () => {
  globalThis.fetch = () => { throw new Error('No request should be made'); };
  await studentBrowsing.listRestaurants('aau-4k');
  await studentBrowsing.getRestaurantMenu('demo-tempo-table', 'yared-music-school');
});

test('URLs preserve a valid campus and encode restaurant IDs as one segment', () => {
  assert.equal(browsePath('aau-5k'), '/browse?campus=aau-5k');
  assert.equal(restaurantPath('demo-tempo-table', 'yared-music-school'), '/restaurant/demo-tempo-table?campus=yared-music-school');
  assert.equal(restaurantPath('id/with space', 'aau-4k'), '/restaurant/id%2Fwith%20space?campus=aau-4k');
  assert.equal(browsePath('invalid'), '/browse');
  assert.equal(restaurantPath('demo-tempo-table', 'invalid'), '/restaurant/demo-tempo-table');
});
