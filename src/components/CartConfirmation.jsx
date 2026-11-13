import { useEffect } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { useCart } from '../context/CartContext.js';
import { findCampus } from '../utils/studentBrowsing.js';
import MenuDialog from './MenuDialog.jsx';

const CartConfirmation = () => {
  const { pending, cart, error, confirm, cancel } = useCart();
  const location = useLocation();
  const onCartPage = useMatch('/cart');
  // Browser back/forward can leave a modal's originating page. Close the
  // pending decision in that case without changing its existing cart.
  useEffect(() => { cancel(); }, [location.key, cancel]);
  if (!pending) return null;
  const replacing = pending.kind === 'replace';
  return (
    <MenuDialog title={replacing ? 'Replace your demo cart?' : 'Clear your demo cart?'} busy={false} onDismiss={cancel} fallbackFocusSelector={onCartPage ? '#cart-title' : '.cart-link'}>
      <div className="cart-confirmation">
        {replacing ? <>
          <p>Your cart is for <strong>{cart.restaurantName}</strong> at <strong>{findCampus(cart.campusId).name}</strong>.</p>
          <p>Replace all its items with <strong>{pending.itemName}</strong> from <strong>{pending.restaurantName}</strong> at <strong>{findCampus(pending.selection.campusId).name}</strong>?</p>
          <p>Each demo cart can contain food from one restaurant and one campus.</p>
        </> : <p>Remove all items from this demo cart? You can add them again from the sample menu.</p>}
        {error && <p className="menu-feedback menu-feedback-error" role="alert">{error}</p>}
        <div className="menu-form-actions">
          <button className="button-secondary" type="button" data-initial-focus onClick={cancel}>Keep existing cart</button>
          <button className="button-danger" type="button" onClick={confirm}>{replacing ? 'Replace cart and add item' : 'Clear cart'}</button>
        </div>
      </div>
    </MenuDialog>
  );
};

export default CartConfirmation;
