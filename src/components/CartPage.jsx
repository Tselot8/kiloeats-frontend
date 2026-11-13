import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext.js';
import { cartTotals, formatETB, parseQuantity } from '../utils/cart.js';
import { browsePath, findCampus, restaurantPath } from '../utils/studentBrowsing.js';
import { StudentDemoNotice } from './StudentBrowsingShared.jsx';
import FoodImage from './FoodImage.jsx';

const CartLine = ({ item, onRemove }) => {
  const { cart, setQuantity } = useCart();
  const [draft, setDraft] = useState(String(item.quantity));
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const id = useId();
  useEffect(() => { setDraft(String(item.quantity)); setError(''); }, [item.quantity]);
  const submit = (event) => {
    event.preventDefault();
    try {
      const quantity = parseQuantity(draft);
      cartTotals({ items: cart.items.map((entry) => entry.itemId === item.itemId ? { ...entry, quantity } : entry) });
      setError(''); setQuantity(item.itemId, quantity);
    }
    catch (failure) { setError(failure.message); inputRef.current?.focus(); }
  };
  return (
    <article className="cart-line" aria-labelledby={`${id}-name`}>
      <FoodImage src={item.image} name={item.name} />
      <div className="cart-line-content">
        <h4 id={`${id}-name`}>{item.name}</h4><p className="cart-unit-price">{formatETB(item.unitPriceMinor)} each</p>
        <form className="cart-quantity-form" onSubmit={submit} noValidate>
          <div><label htmlFor={`${id}-quantity`}>Quantity</label><input ref={inputRef} id={`${id}-quantity`} name="quantity" type="number" min="1" step="1" inputMode="numeric" required value={draft} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => { setDraft(event.target.value); setError(''); }} /></div>
          <button className="button-secondary" type="submit" aria-label={`Update quantity for ${item.name}`}>Update quantity</button>
          {error && <p className="error-text" id={`${id}-error`} role="alert">{error}</p>}
        </form>
      </div>
      <div className="cart-line-end"><p><span>Line total</span><strong>{formatETB(item.unitPriceMinor * item.quantity)}</strong></p><button className="button-secondary" type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => onRemove(item.itemId)}>Remove</button></div>
    </article>
  );
};

CartLine.propTypes = {
  item: (props) => !props.item ? new Error('Cart line requires an item.') : null,
  onRemove: (props) => typeof props.onRemove !== 'function' ? new Error('Cart line requires a removal action.') : null,
};

const CartPage = () => {
  const { cart, context, totals, remove, requestClear, recheck } = useCart();
  const [params] = useSearchParams();
  const headingRef = useRef(null);
  useEffect(() => { recheck(); }, [recheck]);
  const campusId = cart?.campusId || context?.campusId || params.get('campus');
  return (
    <section className="student-page cart-page" aria-labelledby="cart-title">
      <div className="student-menu-page-heading"><h2 ref={headingRef} id="cart-title" tabIndex={-1}>Your demo cart</h2><Link className="button-link button-secondary" to={browsePath(campusId)}>Browse restaurants</Link></div>
      <StudentDemoNotice />
      {!cart ? <div className="menu-state cart-empty"><h3>Your cart is empty</h3><p>Explore a sample menu and add available food to get started.</p><div className="container1">
        {context?.restaurantId && <Link className="button-link" to={restaurantPath(context.restaurantId, campusId)}>Return to sample menu</Link>}
        <Link className="button-link button-secondary" to={browsePath(campusId)}>{findCampus(campusId) ? `Browse ${findCampus(campusId).name}` : 'Choose a campus'}</Link>
      </div></div> : <>
        <div className="cart-restaurant"><div><p className="auth-eyebrow">One restaurant · One campus</p><h3>{cart.restaurantName}</h3><p>{findCampus(cart.campusId).name}</p></div><Link className="button-link button-secondary" to={restaurantPath(cart.restaurantId, cart.campusId)}>Continue with this menu</Link></div>
        <div className="cart-layout"><section aria-labelledby="cart-items-title"><div className="student-results-heading"><h3 id="cart-items-title">Food items</h3><p>{totals.quantity} item(s)</p></div><div className="cart-lines">{cart.items.map((item) => <CartLine key={item.itemId} item={item} onRemove={(id) => { remove(id); headingRef.current?.focus(); }} />)}</div>
          <button className="button-secondary cart-clear" onClick={requestClear}>Clear cart</button>
        </section>
        <aside className="cart-summary" aria-labelledby="cart-summary-title"><h3 id="cart-summary-title">Food summary</h3><dl><div><dt>Food subtotal</dt><dd>{formatETB(totals.subtotalMinor)}</dd></div><div><dt>Delivery fee</dt><dd>Not yet quoted</dd></div></dl><p>Delivery is distance-priced and restaurant-managed. The fee must be strictly below 100 ETB; the exact fee is not defined yet.</p><p className="cart-subtotal-note">The food subtotal excludes delivery and is not a final payable total.</p><p className="cart-checkout-note">Checkout and order submission are not available in this demo.</p></aside></div>
      </>}
    </section>
  );
};

export default CartPage;
