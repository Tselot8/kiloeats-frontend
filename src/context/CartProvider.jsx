import { useEffect, useMemo, useReducer } from 'react';
import { DEMO_RESTAURANTS } from '../data/demoRestaurants.js';
import { cartReducer, cartTotals, loadCart, persistCart } from '../utils/cart.js';
import { CartContext } from './CartContext.js';

const browserStorage = () => window.localStorage;

const CartProvider = ({ children, getStorage = browserStorage, catalog = DEMO_RESTAURANTS }) => {
  const [state, dispatch] = useReducer((previous, action) => cartReducer(previous, action, catalog), null,
    () => ({ ...loadCart(getStorage, catalog), pending: null, feedback: '', error: '' }));

  useEffect(() => {
    if (state.readFailed || state.revision === 0) return;
    dispatch({ type: 'STORAGE', warning: persistCart(state.cart, getStorage) });
  }, [state.cart, state.revision, state.readFailed, getStorage]);

  const actions = useMemo(() => ({
    add: (selection) => dispatch({ type: 'ADD', selection }),
    setQuantity: (itemId, quantity) => dispatch({ type: 'QUANTITY', itemId, quantity }),
    remove: (itemId) => dispatch({ type: 'REMOVE', itemId }),
    requestClear: () => dispatch({ type: 'CLEAR' }),
    confirm: () => dispatch({ type: 'CONFIRM' }),
    cancel: () => dispatch({ type: 'CANCEL' }),
    recheck: () => dispatch({ type: 'RECHECK' }),
  }), []);
  const value = useMemo(() => ({ ...state, ...actions, totals: cartTotals(state.cart) }), [state, actions]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

CartProvider.propTypes = {
  children: (props) => props.children == null ? new Error('CartProvider requires content.') : null,
  getStorage: (props) => props.getStorage != null && typeof props.getStorage !== 'function' ? new Error('Cart storage requires a getter.') : null,
  catalog: (props) => props.catalog != null && !Array.isArray(props.catalog) ? new Error('Cart catalog must be an array.') : null,
};

export default CartProvider;
