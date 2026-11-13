import { useMatch } from 'react-router-dom';
import { useCart } from '../context/CartContext.js';

const CartFeedback = () => {
  const { feedback, error, notices, storageWarning, pending } = useCart();
  const browsing = useMatch('/browse');
  const menu = useMatch('/restaurant/:restaurantId');
  const cart = useMatch('/cart');
  if (!browsing && !menu && !cart) return null;
  return (
    <div className="cart-feedback">
      <p className="cart-announcement" role="status">{feedback}</p>
      {error && !pending && <p className="menu-feedback menu-feedback-error" role="alert">{error}</p>}
      {storageWarning && <p className="menu-feedback cart-storage-warning" role="alert">{storageWarning}</p>}
      {notices.length > 0 && <aside className="menu-feedback cart-change-notice" role="alert" aria-label="Demo cart changes">
        <h3>Changes to your saved demo cart</h3><ul>{notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>
      </aside>}
    </div>
  );
};

export default CartFeedback;
