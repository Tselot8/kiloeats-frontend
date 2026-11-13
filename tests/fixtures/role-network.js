import { merchantApiUrl } from '../../src/utils/config.js';

// ISOLATED_ROLE_NETWORK: installed before mounting any merchant component.
// Every fetch is resolved here or rejected. No network fallback exists.
export const installRoleNetwork = () => {
  const requests = [];
  let menu = { item: { restaurantName: 'Fixture Merchant', menu: { menuItems: [{ id: 1, name: 'Synthetic food', description: 'An isolated fixture food.', price: 100, image: '' }] } } };
  let orders = [{ id: 1, items: ['Synthetic food'], totalPrice: 100, status: 'Pending' }, { id: 2, items: ['Fixture tea'], totalPrice: 25, status: 'Accepted' }];
  let profile = { id: 'fixture-restaurant-1', name: 'Fixture Merchant', email: 'fixture@example.test', location: 'Synthetic location', openingHours: 'Sample hours', cuisineType: 'Sample cuisine' };
  const urls = { menu: merchantApiUrl('/item'), orders: merchantApiUrl('/orders'), profile: merchantApiUrl('/restaurant') };
  window.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = options.method || (typeof input !== 'string' && input.method) || 'GET';
    requests.push({ url, method, isolated: true });
    options.signal?.throwIfAborted();
    const body = options.body && JSON.parse(options.body);
    if (method !== 'GET') await new Promise((resolve) => setTimeout(resolve, 250));
    if (url === urls.menu) {
      if (method === 'GET') return Response.json(structuredClone(menu));
      if (method === 'PATCH') { menu = body; return new Response(null, { status: 204 }); }
    }
    if (url === urls.profile) {
      if (method === 'GET') return Response.json(structuredClone(profile));
      if (method === 'PATCH') { profile = body.restaurant; return new Response(null, { status: 204 }); }
    }
    if (url === urls.orders && method === 'GET') return Response.json({ orders: structuredClone(orders) });
    if (url.startsWith(urls.orders + '/')) {
      const id = decodeURIComponent(url.slice(urls.orders.length + 1));
      if (method === 'PATCH') { orders = orders.map((entry) => String(entry.id) === id ? { ...entry, ...body } : entry); return new Response(null, { status: 204 }); }
      if (method === 'DELETE') { orders = orders.filter((entry) => String(entry.id) !== id); return new Response(null, { status: 204 }); }
    }
    throw new TypeError('The isolated role harness blocked an unrecognized request.');
  };
  return { requests };
};
