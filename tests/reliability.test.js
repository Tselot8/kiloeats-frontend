import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_API_BASE_URL, merchantApiUrl, resolveApiBaseUrl } from '../src/utils/config.js';
import { fetchMenuData, fetchOrders, fetchRestaurantProfile, menuErrorMessage, orderErrorMessage, profileErrorMessage } from '../src/utils/api.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('API configuration defaults and overrides retain path prefixes and remove trailing slashes', () => {
  for (const value of [undefined, '', '  ']) assert.equal(resolveApiBaseUrl(value), DEFAULT_API_BASE_URL);
  assert.equal(resolveApiBaseUrl(' https://merchant.example.invalid/v1/// '), 'https://merchant.example.invalid/v1');
  assert.equal(resolveApiBaseUrl('http://localhost:3007/'), 'http://localhost:3007');
  assert.equal(merchantApiUrl('/item'), `${DEFAULT_API_BASE_URL}/item`);
});

test('invalid API configuration cannot embed credentials, queries, or fragments in requests or error messages', () => {
  for (const value of ['/relative', 'javascript:alert(1)', 'https://user:private-marker@example.invalid',
    'https://example.invalid?key=private-marker', 'https://example.invalid/#private-marker',
    'https://example.invalid/?', 'https://example.invalid/#']) {
    assert.throws(() => resolveApiBaseUrl(value), (error) => {
      assert.match(error.message, /merchant API URL/);
      assert.ok(!error.message.includes('private-marker'));
      return true;
    });
  }
});

for (const [name, read, message, emptyResponse, expected] of [
  ['menu', fetchMenuData, menuErrorMessage, { item: { menu: { menuItems: [] } } }, []],
  ['orders', fetchOrders, orderErrorMessage, { orders: [] }, []],
  ['profile', fetchRestaurantProfile, profileErrorMessage, null, null],
]) {
  test(`${name}: HTTP errors, invalid JSON, invalid shapes, and valid empty data stay distinct`, async () => {
    globalThis.fetch = async () => new Response('Not JSON', { status: 502 });
    await assert.rejects(read(), /HTTP 502/);
    globalThis.fetch = async () => new Response('<html>Not JSON</html>');
    await assert.rejects(read(), /unreadable/);
    globalThis.fetch = async () => Response.json({ unexpected: true });
    await assert.rejects(read(), /unreadable/);
    globalThis.fetch = async () => Response.json(emptyResponse);
    assert.deepEqual(await read(), expected);
  });

  test(`${name}: connection loss during fetch or JSON download is not reported as malformed data or retried`, async () => {
    for (const phase of ['fetch', 'body']) {
      let calls = 0;
      const failure = new TypeError('Isolated interrupted connection');
      globalThis.fetch = async () => {
        calls += 1;
        if (phase === 'fetch') throw failure;
        return { ok: true, status: 200, json: async () => { throw failure; } };
      };
      await assert.rejects(read(), (error) => {
        assert.equal(error, failure);
        assert.match(message(error), /could not be reached/);
        return true;
      });
      assert.equal(calls, 1);
    }
  });

  test(`${name}: timeouts and caller cancellation survive body parsing and reads use a composed signal`, async () => {
    const controller = new AbortController();
    const failure = new DOMException('Isolated timeout', 'TimeoutError');
    globalThis.fetch = async (url, options) => {
      assert.equal(options.cache, 'no-store');
      assert.equal(options.method, 'GET');
      controller.abort();
      assert.equal(options.signal.aborted, true);
      return { ok: true, status: 200, json: async () => { throw failure; } };
    };
    await assert.rejects(read({ signal: controller.signal }), (error) => {
      assert.equal(error, failure);
      assert.match(message(error), /too long/);
      return true;
    });
    assert.match(message(null), /request failed/);
  });
}
