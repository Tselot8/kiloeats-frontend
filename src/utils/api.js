import { hasUniqueMenuId, menuItemId } from './menu.js';
import { canChangeOrderStatus, orderKey, parseOrders } from './orders.js';
import { parseRestaurantProfile, PROFILE_FIELDS, profileValues, validateProfileFields } from './profile.js';

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

export const fetchRestaurantProfile = async ({ signal } = {}) => {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(`${BASE_URL}/restaurant`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not load the restaurant profile (HTTP ${response.status}). Please try again.`);
  if (response.status === 204) return null;
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The profile service returned unreadable restaurant details. Please refresh the profile.'); }
  return parseRestaurantProfile(data);
};

export const saveRestaurantProfile = async (original, values) => {
  const baseline = parseRestaurantProfile(original);
  if (!baseline) throw new Error('Load an existing restaurant profile before saving.');
  if (Object.keys(validateProfileFields(values)).length > 0) throw new Error('Check the required profile fields before saving.');
  const normalized = profileValues(values);
  const restaurant = { ...(baseline.id != null ? { id: baseline.id } : {}), ...normalized };
  let response;
  try {
    // Preserve the existing nested write. A flat GET is not evidence of a flat
    // PATCH contract. Never try a different payload as an automatic fallback.
    response = await fetch(`${BASE_URL}/restaurant`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ restaurant }),
    });
  } catch {
    throw new Error('Could not confirm the save. The service may have received your changes. Your draft is kept; check the profile before trying again.');
  }
  if (!response.ok) throw new Error(`The profile save failed (HTTP ${response.status}). Your draft is kept; no change has been confirmed.`);
  let verified;
  try { verified = await fetchRestaurantProfile(); }
  catch { throw new Error('The service accepted the save, but the profile could not be read back. Your draft is kept. Check the profile before trying again.'); }
  if (!verified || (baseline.id != null && String(verified.id) !== String(baseline.id))
    || PROFILE_FIELDS.some(({ key }) => verified[key] !== normalized[key])) {
    throw new Error('The profile read-back did not match your changes. Your draft is kept. The save contract needs confirmation before retrying.');
  }
  return verified;
};

export const profileErrorMessage = (error) => {
  if (error?.name === 'TimeoutError') return 'The profile service took too long to respond. Please try again.';
  if (error instanceof TypeError) return 'The profile service could not be reached. Check your connection and try again.';
  return error?.message || 'The profile request failed. Please try again.';
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
