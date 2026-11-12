import { hasUniqueMenuId, menuItemId } from './menu.js';
import { canChangeOrderStatus, orderKey, parseOrders } from './orders.js';

export const BASE_URL = 'https://kilo-eats-backend.onrender.com';

const readMenuResource = async (signal) => {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(`${BASE_URL}/item`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not load the menu (HTTP ${response.status}).`);
  let resource;
  try { resource = await response.json(); }
  catch { throw new Error('The menu service returned an unreadable menu. Please try again.'); }
  const items = resource?.item?.menu?.menuItems;
  if (!Array.isArray(items) || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item)
    || ['name', 'description', 'image'].some((field) => item[field] != null && typeof item[field] !== 'string'))) {
    throw new Error('The menu service returned an unreadable menu. Please try again.');
  }
  return { resource, items };
};

export const fetchMenuData = async ({ signal } = {}) => {
  const { items } = await readMenuResource(signal);
  return items;
};

const changeMenu = async (transform) => {
  // The existing menu contract replaces the whole menu. Read its latest state first,
  // and preserve nested metadata, but concurrent writes still require backend support.
  const { resource, items } = await readMenuResource();
  const updatedMenu = transform(items);
  let response;
  try {
    response = await fetch(`${BASE_URL}/item`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        item: { ...resource.item, menu: { ...resource.item.menu, menuItems: updatedMenu } },
      }),
    });
  } catch {
    throw new Error('Could not confirm the save. Your input is kept. Check the menu before retrying; the service may have received the change.');
  }
  if (!response.ok) throw new Error(`Changes were not saved (HTTP ${response.status}). Please try again.`);
  return updatedMenu;
};

const findItemIndex = (items, id) => {
  const item = items.find((entry) => menuItemId(entry) === String(id));
  if (!item || !hasUniqueMenuId(item, items)) {
    throw new Error('This item no longer has a unique ID in the menu. Reload the menu before trying again.');
  }
  return items.indexOf(item);
};

export const addMenuItem = (values) => changeMenu((items) => {
  const numericIds = items.map((item) => Number(item.id)).filter((id) => Number.isSafeInteger(id) && id >= 0);
  const id = Math.max(0, ...numericIds) + 1;
  if (!Number.isSafeInteger(id)) throw new Error('A new item ID could not be allocated. Please contact support.');
  return [...items, { ...values, id, rating: 4 }];
});

export const updateMenuItem = (id, values) => changeMenu((items) => {
  const index = findItemIndex(items, id);
  return items.map((item, position) => position === index ? { ...item, ...values, id: item.id } : item);
});

export const removeMenuItem = (id) => changeMenu((items) => {
  const index = findItemIndex(items, id);
  return items.filter((_, position) => position !== index);
});

export const menuErrorMessage = (error) => {
  if (error.name === 'TimeoutError') return 'The menu service took too long to respond. Please try again.';
  if (error instanceof TypeError) return 'The menu service could not be reached. Check your connection and try again.';
  return error.message || 'The menu request failed. Please try again.';
};

export const fetchRestaurantProfile = async () => {
  try {
    const response = await fetch(`${BASE_URL}/restaurant`);
    if (!response.ok) {
      throw new Error("Failed to fetch restaurant profile");
    }
    const data = await response.json();
    return data; // Return flat structure { id, name, email, location, openingHours, cuisineType }
  } catch (error) {
    console.error("Error fetching restaurant profile:", error);
    return {};
  }
};

export const fetchOrders = async ({ signal } = {}) => {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(`${BASE_URL}/orders`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not load orders (HTTP ${response.status}). Please try again.`);
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The order service returned an unreadable orders list. Please refresh orders.'); }
  return parseOrders(data);
};

const mutateOrder = async (order, nextStatus, { deleting = false } = {}) => {
  const key = orderKey(order?.id);
  if (key === null || (deleting ? order.status !== 'Accepted' : !canChangeOrderStatus(order.status, nextStatus))) {
    throw new Error('This action is unavailable for the current order status. Please refresh orders.');
  }
  let response;
  try {
    response = await fetch(`${BASE_URL}/orders/${encodeURIComponent(key)}`, {
      method: deleting ? 'DELETE' : 'PATCH',
      ...(deleting ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('Could not confirm this action. The service may have received it. Refresh orders before trying again.');
  }
  if (!response.ok) throw new Error(`The order action failed (HTTP ${response.status}). No change has been confirmed.`);

  // Keep the existing write contract without assuming a mutation response shape.
  // Verify the result through the documented orders-list response instead.
  let orders;
  try { orders = await fetchOrders(); }
  catch { throw new Error('The service accepted the request, but its result could not be confirmed. Refresh orders before trying again.'); }
  const updated = orders.find((entry) => orderKey(entry.id) === key);
  if (deleting ? updated !== undefined : !updated || updated.status !== nextStatus) {
    throw new Error('The service has not confirmed the expected order change. Refresh orders before trying again.');
  }
  return updated;
};

export const changeOrderStatus = (order, status) => mutateOrder(order, status);
export const deleteOrder = (order) => mutateOrder(order, undefined, { deleting: true });

export const orderErrorMessage = (error) => {
  if (error?.name === 'TimeoutError') return 'The order service took too long to respond. Please try again.';
  if (error instanceof TypeError) return 'The order service could not be reached. Check your connection and try again.';
  return error?.message || 'The order request failed. Please try again.';
};
