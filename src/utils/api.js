import { hasUniqueMenuId, menuItemId } from './menu.js';
import { canChangeOrderStatus, orderKey, parseOrders } from './orders.js';
import { parseRestaurantProfile, PROFILE_FIELDS, profileValues, validateProfileFields } from './profile.js';
import { merchantRequest, readJson, serviceErrorMessage } from './http.js';

const readMenuResource = async (signal) => {
  const response = await merchantRequest('/item', {
    signal,
    httpError: (status) => `Could not load the menu (HTTP ${status}).`,
  });
  const resource = await readJson(response, 'The menu service returned an unreadable menu. Please try again.');
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
  await merchantRequest('/item', {
    method: 'PATCH',
    json: { item: { ...resource.item, menu: { ...resource.item.menu, menuItems: updatedMenu } } },
    uncertainMessage: 'Could not confirm the save. Your input is kept. Check the menu before retrying; the service may have received the change.',
    httpError: (status) => `Changes were not saved (HTTP ${status}). Please try again.`,
  });
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

export const menuErrorMessage = (error) => serviceErrorMessage(error, 'menu');

export const fetchRestaurantProfile = async ({ signal } = {}) => {
  const response = await merchantRequest('/restaurant', {
    signal,
    httpError: (status) => `Could not load the restaurant profile (HTTP ${status}). Please try again.`,
  });
  if (response.status === 204) return null;
  const data = await readJson(response, 'The profile service returned unreadable restaurant details. Please refresh the profile.');
  return parseRestaurantProfile(data);
};

export const saveRestaurantProfile = async (original, values) => {
  const baseline = parseRestaurantProfile(original);
  if (!baseline) throw new Error('Load an existing restaurant profile before saving.');
  if (Object.keys(validateProfileFields(values)).length > 0) throw new Error('Check the required profile fields before saving.');
  const normalized = profileValues(values);
  const restaurant = { ...(baseline.id != null ? { id: baseline.id } : {}), ...normalized };
  // Preserve the existing nested write. A flat GET is not evidence of a flat
  // PATCH contract. Never try a different payload as an automatic fallback.
  await merchantRequest('/restaurant', {
    method: 'PATCH', json: { restaurant },
    uncertainMessage: 'Could not confirm the save. The service may have received your changes. Your draft is kept; check the profile before trying again.',
    httpError: (status) => `The profile save failed (HTTP ${status}). Your draft is kept; no change has been confirmed.`,
  });
  let verified;
  try { verified = await fetchRestaurantProfile(); }
  catch { throw new Error('The service accepted the save, but the profile could not be read back. Your draft is kept. Check the profile before trying again.'); }
  if (!verified || (baseline.id != null && String(verified.id) !== String(baseline.id))
    || PROFILE_FIELDS.some(({ key }) => verified[key] !== normalized[key])) {
    throw new Error('The profile read-back did not match your changes. Your draft is kept. The save contract needs confirmation before retrying.');
  }
  return verified;
};

export const profileErrorMessage = (error) => serviceErrorMessage(error, 'profile');

export const fetchOrders = async ({ signal } = {}) => {
  const response = await merchantRequest('/orders', {
    signal,
    httpError: (status) => `Could not load orders (HTTP ${status}). Please try again.`,
  });
  const data = await readJson(response, 'The order service returned an unreadable orders list. Please refresh orders.');
  return parseOrders(data);
};

const mutateOrder = async (order, nextStatus, { deleting = false } = {}) => {
  const key = orderKey(order?.id);
  if (key === null || (deleting ? order.status !== 'Accepted' : !canChangeOrderStatus(order.status, nextStatus))) {
    throw new Error('This action is unavailable for the current order status. Please refresh orders.');
  }
  await merchantRequest(`/orders/${encodeURIComponent(key)}`, {
    method: deleting ? 'DELETE' : 'PATCH',
    ...(deleting ? {} : { json: { status: nextStatus } }),
    uncertainMessage: 'Could not confirm this action. The service may have received it. Refresh orders before trying again.',
    httpError: (status) => `The order action failed (HTTP ${status}). No change has been confirmed.`,
  });

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

export const orderErrorMessage = (error) => serviceErrorMessage(error, 'order');
