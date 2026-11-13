import { DEMO_RESTAURANTS } from '../data/demoRestaurants.js';
import { findCampus } from './studentBrowsing.js';

export const CART_STORAGE_KEY = 'kiloeats.demoCart.v1';

export const parseQuantity = (value) => {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) {
    throw new Error('Enter a positive whole-number quantity.');
  }
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Enter a positive whole-number quantity within the supported range.');
  return quantity;
};

const safeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
export const toMinorUnits = (price) => {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || Number(price.toFixed(2)) !== price) {
    throw new Error('This item does not have a valid ETB price. It cannot be added right now.');
  }
  const minor = Number(price.toFixed(2).replace('.', ''));
  if (!safeInteger(minor)) throw new Error('This price exceeds the supported currency range.');
  return minor;
};

export const formatETB = (minor) => {
  if (!safeInteger(minor)) throw new Error('The food amount is outside the supported range.');
  // Format the integer and fractional parts separately; never round a large
  // subtotal through a floating-point birr amount.
  return `${new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(Math.floor(minor / 100))}.${String(minor % 100).padStart(2, '0')} ETB`;
};

export const cartTotals = (cart) => (cart?.items || []).reduce((totals, item) => {
  const quantity = parseQuantity(item.quantity);
  const lineMinor = item.unitPriceMinor * quantity;
  if (!safeInteger(item.unitPriceMinor) || !safeInteger(lineMinor)
    || !safeInteger(totals.subtotalMinor + lineMinor) || !safeInteger(totals.quantity + quantity)) {
    throw new Error('This quantity would exceed the supported cart total. Choose a smaller quantity.');
  }
  return { quantity: totals.quantity + quantity, subtotalMinor: totals.subtotalMinor + lineMinor };
}, { quantity: 0, subtotalMinor: 0 });

const cartContext = (stored, catalog) => {
  const campus = findCampus(stored?.campusId);
  const restaurant = catalog.find((entry) => entry.id === stored?.restaurantId);
  return campus ? { campusId: campus.id, ...(restaurant ? { restaurantId: restaurant.id, restaurantName: restaurant.name } : {}) } : null;
};

export const reconcileCart = (stored, catalog = DEMO_RESTAURANTS) => {
  if (stored === null) return { cart: null, notices: [], context: null };
  const context = cartContext(stored, catalog);
  const discard = (message) => ({ cart: null, notices: [message], context });
  if (!stored || typeof stored !== 'object' || Array.isArray(stored) || stored.version !== 1
    || typeof stored.restaurantId !== 'string' || typeof stored.campusId !== 'string' || !Array.isArray(stored.items)) {
    return discard('The saved demo cart was malformed or from an unsupported version and has been cleared.');
  }
  const restaurant = catalog.find((entry) => entry.id === stored.restaurantId);
  if (!findCampus(stored.campusId)) return discard('The saved cart used an unsupported campus and has been cleared.');
  if (!restaurant) return discard('The saved restaurant is no longer in the demo catalog. Its cart has been cleared.');
  if (!restaurant.campusIds.includes(stored.campusId)) return discard('The saved restaurant no longer serves that campus. Its cart has been cleared.');
  if (!restaurant.menuAvailable) return discard(`${restaurant.name}’s demo menu is unavailable. Its saved items have been removed.`);
  const notices = [];
  const seen = new Set();
  const cart = { version: 1, restaurantId: restaurant.id, restaurantName: restaurant.name, campusId: stored.campusId, items: [] };
  for (const entry of stored.items) {
    const item = restaurant.items.find((candidate) => candidate.id === entry?.itemId);
    const label = item?.name || (typeof entry?.name === 'string' ? entry.name.slice(0, 80) : 'A saved item');
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.itemId !== 'string'
      || typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || !safeInteger(entry.unitPriceMinor)) {
      notices.push(`${label} was removed because its saved quantity or price was invalid.`); continue;
    }
    if (seen.has(entry.itemId)) { notices.push(`A duplicate saved entry for ${label} was removed.`); continue; }
    seen.add(entry.itemId);
    if (!item) { notices.push(`${label} was removed because it is no longer on the demo menu.`); continue; }
    if (item.available !== true) { notices.push(`${item.name} was removed because it is unavailable.`); continue; }
    let unitPriceMinor;
    try { unitPriceMinor = toMinorUnits(item.price); }
    catch { notices.push(`${item.name} was removed because its current price is invalid.`); continue; }
    const candidate = { itemId: item.id, name: item.name, image: item.image, quantity: entry.quantity, unitPriceMinor };
    try { cartTotals({ items: [...cart.items, candidate] }); }
    catch { notices.push(`${item.name} was removed because its quantity exceeded the supported cart total.`); continue; }
    if (entry.unitPriceMinor !== unitPriceMinor) notices.push(`${item.name} changed from ${formatETB(entry.unitPriceMinor)} to ${formatETB(unitPriceMinor)} per item. The food subtotal has been recalculated.`);
    cart.items.push(candidate);
  }
  return { cart: cart.items.length ? cart : null, notices: [...new Set(notices)], context };
};

export const restoreCart = (raw, catalog = DEMO_RESTAURANTS) => {
  if (raw === null) return reconcileCart(null, catalog);
  try { return reconcileCart(JSON.parse(raw), catalog); }
  catch { return { cart: null, context: null, notices: ['The saved demo cart could not be read and has been cleared.'] }; }
};

export const loadCart = (getStorage, catalog = DEMO_RESTAURANTS) => {
  try {
    const raw = getStorage().getItem(CART_STORAGE_KEY);
    return { ...restoreCart(raw, catalog), revision: raw === null ? 0 : 1, readFailed: false, storageWarning: '' };
  } catch {
    return { cart: null, context: null, notices: [], revision: 0, readFailed: true,
      storageWarning: 'Saved cart storage could not be read. This tab will use an in-memory demo cart and will not overwrite the unreadable saved cart. Changes may be lost on refresh.' };
  }
};

export const persistCart = (cart, getStorage) => {
  try {
    const storage = getStorage();
    if (!cart) storage.removeItem(CART_STORAGE_KEY);
    else storage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, restaurantId: cart.restaurantId, campusId: cart.campusId,
      items: cart.items.map(({ itemId, name, unitPriceMinor, quantity }) => ({ itemId, name, unitPriceMinor, quantity })) }));
    return '';
  } catch { return 'Your current demo cart could not be saved. Changes stay in this tab; refreshing may restore an older cart.'; }
};

const resolveSelection = (selection, catalog) => {
  const restaurant = catalog.find((entry) => entry.id === selection.restaurantId);
  if (!findCampus(selection.campusId) || !restaurant || !restaurant.campusIds.includes(selection.campusId) || !restaurant.menuAvailable) {
    throw new Error('This restaurant’s menu is unavailable for the selected campus. Browse another demo menu.');
  }
  const item = restaurant.items.find((entry) => entry.id === selection.itemId);
  if (!item || item.available !== true) throw new Error('This food is unavailable and was not added to your cart.');
  return { restaurant, item: { itemId: item.id, name: item.name, image: item.image, quantity: parseQuantity(selection.quantity ?? 1), unitPriceMinor: toMinorUnits(item.price) } };
};

export const addCartItem = (cart, selection, { replace = false, catalog = DEMO_RESTAURANTS } = {}) => {
  const { restaurant, item } = resolveSelection(selection, catalog);
  if (cart && (cart.restaurantId !== restaurant.id || cart.campusId !== selection.campusId) && !replace) {
    return { type: 'replace-required', cart, selection: { restaurantId: restaurant.id, campusId: selection.campusId, itemId: item.itemId, quantity: item.quantity }, restaurantName: restaurant.name, itemName: item.name };
  }
  const reconciled = replace ? { cart: null, notices: [] } : reconcileCart(cart, catalog);
  const base = reconciled.cart || { version: 1, restaurantId: restaurant.id, restaurantName: restaurant.name, campusId: selection.campusId, items: [] };
  const previous = base.items.find((entry) => entry.itemId === item.itemId);
  const added = { ...item, quantity: item.quantity + (previous?.quantity || 0) };
  const next = { ...base, items: previous ? base.items.map((entry) => entry.itemId === item.itemId ? added : entry) : [...base.items, added] };
  cartTotals(next);
  return { type: 'added', cart: next, notices: reconciled.notices, itemName: item.name };
};

export const setCartQuantity = (cart, itemId, value, catalog = DEMO_RESTAURANTS) => {
  const quantity = parseQuantity(value);
  const { cart: current, notices } = reconcileCart(cart, catalog);
  if (!current?.items.some((entry) => entry.itemId === itemId)) throw new Error('This item is no longer available in the demo cart. Review the menu before adding it again.');
  const next = { ...current, items: current.items.map((entry) => entry.itemId === itemId ? { ...entry, quantity } : entry) };
  cartTotals(next);
  return { cart: next, notices };
};

export const cartReducer = (state, action, catalog = DEMO_RESTAURANTS) => {
  const commit = (cart, notices = [], feedback = '') => ({ ...state, cart, context: cart ? cartContext(cart, catalog) : state.context,
    notices: [...new Set([...state.notices, ...notices])], feedback, error: '', pending: null, revision: state.revision + 1 });
  try {
    switch (action.type) {
      case 'ADD': {
        if (state.pending) return state;
        const result = addCartItem(state.cart, action.selection, { catalog });
        if (result.type === 'replace-required') return { ...state, pending: { kind: 'replace', ...result }, feedback: '', error: '' };
        return commit(result.cart, result.notices, `Added ${result.itemName} to your demo cart. ${cartTotals(result.cart).quantity} item(s) in the cart.`);
      }
      case 'CONFIRM': {
        if (!state.pending) return state;
        if (state.pending.kind === 'clear') return { ...commit(null, [], 'Demo cart cleared.'), notices: [] };
        const result = addCartItem(state.cart, state.pending.selection, { replace: true, catalog });
        return commit(result.cart, result.notices, `Replaced the demo cart and added ${result.itemName}.`);
      }
      case 'CANCEL': return state.pending ? { ...state, pending: null, error: '', feedback: 'Kept your existing demo cart.' } : state;
      case 'QUANTITY': {
        if (state.pending) return state;
        const result = setCartQuantity(state.cart, action.itemId, action.quantity, catalog);
        return commit(result.cart, result.notices, 'Demo cart quantity updated. Food subtotal recalculated.');
      }
      case 'REMOVE': {
        if (state.pending || !state.cart) return state;
        const item = state.cart.items.find((entry) => entry.itemId === action.itemId);
        if (!item) return state;
        const items = state.cart.items.filter((entry) => entry.itemId !== action.itemId);
        return commit(items.length ? { ...state.cart, items } : null, [], `Removed ${item.name} from your demo cart.`);
      }
      case 'CLEAR': return state.cart && !state.pending ? { ...state, pending: { kind: 'clear' }, feedback: '', error: '' } : state;
      case 'RECHECK': {
        const result = reconcileCart(state.cart, catalog);
        if (JSON.stringify(result.cart) === JSON.stringify(state.cart)) return state;
        return commit(result.cart, result.notices);
      }
      case 'STORAGE': return state.storageWarning === action.warning ? state : { ...state, storageWarning: action.warning };
      default: return state;
    }
  } catch (error) { return { ...state, error: error.message, feedback: '' }; }
};
