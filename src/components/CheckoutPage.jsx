import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.js';
import { useIdentity } from '../context/IdentityContext.js';
import { useCheckout } from '../context/CheckoutContext.js';
import { checkoutCartKey, checkoutReviewKey, checkoutTotals, parseQuote, validateDelivery } from '../utils/checkout.js';
import { cartTotals, formatETB } from '../utils/cart.js';
import { browsePath, findCampus } from '../utils/studentBrowsing.js';
import FoodImage from './FoodImage.jsx';
import { studentOrderPath } from '../utils/studentOrders.js';

const EMPTY_DELIVERY = Object.freeze({ recipientName: '', contactPhone: '', dropoffId: '', handoffInstructions: '' });

const CheckoutRecovery = () => {
  const { session, state } = useCheckout();
  const { identity } = useIdentity();
  const heading = useRef(null), feedback = useRef(null);
  const { attempt } = state;
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { if (state.error) feedback.current?.focus(); }, [state.error]);
  return <section className="student-page checkout-page" aria-labelledby="checkout-recovery-title">
    <div className="page-header"><div><p className="auth-eyebrow">Same operation · Read-only recovery</p><h2 ref={heading} tabIndex={-1} id="checkout-recovery-title">Demo order outcome uncertain</h2></div><Link className="button-link button-secondary" to="/cart">View current cart</Link></div>
    <div className="checkout-demo-notice"><strong>Do not submit another order to resolve this outcome.</strong><p>The operation below is reserved in this tab. Its lookup is read-only, even if your current cart changes or is cleared. Refresh resets the demo service and cannot recover the outcome.</p></div>
    <div className="checkout-layout"><section className="checkout-panel"><h3>{attempt.cart.restaurantName}</h3><p>{findCampus(attempt.cart.campusId).name}</p><CheckoutItems cart={attempt.cart} />
      <p>Operation reference: <code>{attempt.operationId}</code></p><p>Recipient: {attempt.delivery.recipientName}</p><p>Synthetic drop-off: {attempt.delivery.dropoffName}</p>
      {state.error && <p ref={feedback} tabIndex={-1} role="alert" className="menu-feedback menu-feedback-error">{state.error}</p>}
      <button className="button-secondary" disabled={state.phase === 'recovering'} onClick={() => session.recover(identity)}>{state.phase === 'recovering' ? 'Checking outcome…' : 'Check demo order outcome'}</button>
      {state.phase === 'recovering' && <p role="status">Looking up the existing operation. No repeat write is sent.</p>}
    </section><aside className="cart-summary checkout-summary"><h3>Submitted demo amounts</h3><CheckoutAmounts totals={attempt.totals} /><p>These amounts describe the uncertain operation, not your current cart. No live order, payment or delivery is created.</p></aside></div>
  </section>;
};

const CheckoutReceipt = () => {
  const { state } = useCheckout();
  const { cart } = useCart();
  const heading = useRef(null);
  const { receipt } = state;
  useEffect(() => { heading.current?.focus(); document.title = 'Demo order confirmed | KiloEats'; }, []);
  return <section className="student-page checkout-page checkout-receipt" aria-labelledby="checkout-receipt-title">
    <div className="page-header"><div><p className="auth-eyebrow">Synthetic receipt · No live order</p><h2 ref={heading} tabIndex={-1} id="checkout-receipt-title">Demo order confirmed</h2></div><Link className="button-link button-secondary" to={browsePath(receipt.cart.campusId)}>Browse restaurants</Link></div>
    <div className="checkout-demo-notice"><strong>No restaurant received this order.</strong><p>The order and receipt exist only in this tab’s isolated fixture memory. You can view its demo history and progress in this tab. Page refresh clears the records; there is no recovery across refresh.</p></div>
    <div className="container1 student-order-confirmation-links"><Link className="button-link" to={studentOrderPath(receipt.reference)}>View order progress & receipt</Link><Link className="button-link button-secondary" to="/student/orders">View all demo orders</Link></div>
    <p className="menu-helper student-order-submission-note">This receipt confirms the original demo submission. Open order progress for its current status.</p>
    <div className="checkout-layout"><section className="checkout-panel"><h3>{receipt.cart.restaurantName}</h3><p>{findCampus(receipt.cart.campusId).name}</p>
      <dl className="checkout-reference"><div><dt>Synthetic order reference</dt><dd>{receipt.reference}</dd></div><div><dt>Operation reference</dt><dd><code>{receipt.operationId}</code></dd></div></dl>
      <CheckoutItems cart={receipt.cart} />
      <h3>Demo handoff</h3><dl className="checkout-delivery-details"><div><dt>Recipient</dt><dd>{receipt.delivery.recipientName}</dd></div><div><dt>Contact phone</dt><dd>{receipt.delivery.contactPhone}</dd></div><div><dt>Synthetic drop-off</dt><dd>{receipt.delivery.dropoffName}</dd></div><div><dt>Instructions</dt><dd>{receipt.delivery.handoffInstructions || 'None provided'}</dd></div></dl>
    </section><aside className="cart-summary checkout-summary"><h3>Confirmed demo total</h3><CheckoutAmounts totals={receipt.totals} /><p>Restaurant-managed delivery · Cash on delivery in ETB.</p><p>No payment was collected and no delivery will take place. These fees are synthetic examples, not operational distance pricing.</p>{cart && <p>Your newer cart was preserved. <Link to="/cart">View your cart</Link>.</p>}</aside></div>
  </section>;
};

const CheckoutItems = ({ cart }) => <ul className="checkout-items" aria-label="Checkout food items">{cart.items.map((item) => <li key={item.itemId}>
  <FoodImage src={item.image} name={item.name} illustrationId={item.itemId} /><div><h4>{item.name}</h4><p>{item.quantity} × {formatETB(item.unitPriceMinor)}</p></div><strong>{formatETB(item.unitPriceMinor * item.quantity)}</strong>
</li>)}</ul>;
CheckoutItems.propTypes = { cart: (props) => !props.cart ? new Error('Checkout items require a cart.') : null };

const CheckoutAmounts = ({ totals }) => <dl className="checkout-amounts"><div><dt>Food subtotal</dt><dd>{formatETB(totals.subtotalMinor)}</dd></div><div><dt>Demo delivery fee</dt><dd>{formatETB(totals.deliveryFeeMinor)}</dd></div><div className="checkout-final-total"><dt>Final demo total</dt><dd>{formatETB(totals.totalMinor)}</dd></div></dl>;
CheckoutAmounts.propTypes = { totals: (props) => !props.totals ? new Error('Checkout amounts require totals.') : null };

const CheckoutForm = () => {
  const { cart, revision, pending } = useCart();
  const { identity } = useIdentity();
  const { session, state, draft, setDraft } = useCheckout();
  const values = draft?.studentId === identity.user.id ? draft.values : EMPTY_DELIVERY;
  const [destination, setDestination] = useState({ phase: 'loading', data: [] });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [quoteState, setQuoteState] = useState(null);
  const [reviewedKey, setReviewedKey] = useState('');
  const [errors, setErrors] = useState({});
  const [, setClock] = useState(0);
  const formRef = useRef(null), feedbackRef = useRef(null), quoteRef = useRef(null), current = useRef(null), mounted = useRef(true), quoteBusy = useRef(false);
  const prefix = useId();
  const busy = ['checking', 'submitting', 'recovering'].includes(state.phase);
  const locked = busy;
  const cartKey = checkoutCartKey(cart);
  const quoteBinding = JSON.stringify([cartKey, revision, values.dropoffId, identity.user.id]);
  const currentQuote = quoteState?.binding === quoteBinding && quoteState.phase === 'ready' ? quoteState.data : null;
  let quote = null;
  if (currentQuote) { try { quote = parseQuote(currentQuote, { identity, cart, dropoffId: values.dropoffId }); } catch { /* The expired quote remains visible as invalid, never submitted. */ } }
  const totals = quote ? checkoutTotals(cart, quote.deliveryFeeMinor) : null;
  const reviewKey = quote ? checkoutReviewKey(quote, cart) : '';
  const reviewed = Boolean(reviewKey && reviewKey === reviewedKey);
  const loadingQuote = quoteState?.binding === quoteBinding && quoteState.phase === 'loading';
  current.current = { cartKey, revision, pending: Boolean(pending), dropoffId: values.dropoffId, studentId: identity.user.id, quoteId: quote?.id };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setDestination({ phase: 'loading', data: [] });
    session.client.listDropoffs(identity, cart).then((data) => { if (active) setDestination({ phase: 'ready', data }); })
      .catch(() => { if (active) setDestination({ phase: 'error', data: [] }); });
    return () => { active = false; };
    // Only campus/restaurant/student changes reload destinations. Quantity and
    // price changes invalidate quotes without overwriting the delivery draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, cart.campusId, cart.restaurantId, identity.user.id, loadAttempt]);
  useEffect(() => {
    if (!currentQuote) return;
    const timer = setTimeout(() => setClock((value) => value + 1), Math.min(2147483647, Math.max(0, currentQuote.expiresAt - Date.now() + 10)));
    return () => clearTimeout(timer);
  }, [currentQuote]);
  useEffect(() => { if (state.error) feedbackRef.current?.focus(); }, [state.error]);
  const change = (name, value) => {
    setDraft({ studentId: identity.user.id, values: { ...values, [name]: value } });
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };
  const requestQuote = async () => {
    if (quoteBusy.current || locked || destination.phase !== 'ready') return;
    if (!destination.data.some((entry) => entry.id === values.dropoffId)) {
      setErrors((previous) => ({ ...previous, dropoffId: 'Choose a supported synthetic drop-off first.' }));
      formRef.current?.querySelector('select')?.focus(); return;
    }
    quoteBusy.current = true; setQuoteState({ phase: 'loading', binding: quoteBinding }); setReviewedKey('');
    try {
      const data = await session.client.quote(identity, cart, values.dropoffId);
      if (mounted.current) setQuoteState({ phase: 'ready', binding: quoteBinding, data });
    } catch {
      if (mounted.current) { setQuoteState({ phase: 'error', binding: quoteBinding }); quoteRef.current?.focus(); }
    } finally { quoteBusy.current = false; }
  };
  const submit = (event) => {
    event.preventDefault();
    if (locked || pending) return;
    const validation = validateDelivery(values, destination.data, cart.campusId);
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length) {
      const first = Object.keys(validation.errors)[0]; formRef.current?.querySelector(`[name="${first}"]`)?.focus(); return;
    }
    if (!quote || !reviewed || loadingQuote || destination.phase !== 'ready') { quoteRef.current?.focus(); return; }
    const submitted = current.current;
    session.submit({ identity, cart, revision, delivery: { ...validation.delivery,
      dropoffName: destination.data.find((entry) => entry.id === values.dropoffId).name }, dropoffs: destination.data, quote, reviewKey,
      isCurrent: () => mounted.current && Object.entries(submitted).every(([key, value]) => current.current[key] === value) });
  };
  const field = (name) => ({ id: `${prefix}-${name}`, name, value: values[name], onChange: (event) => change(name, event.target.value),
    'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${prefix}-${name}-error` : undefined });
  const errorFor = (name) => errors[name] && <p className="error-text" id={`${prefix}-${name}-error`} role="alert">{errors[name]}</p>;
  return <>
    <div className="checkout-demo-notice"><strong>Isolated demo checkout</strong><p>Use fictional recipient details only. Drop-offs and fees are synthetic, not real delivery locations or distance bands. Nothing is sent to a restaurant. Delivery details and orders stay in memory; only the non-sensitive cart uses browser storage.</p></div>
    <div className="cart-restaurant"><div><p className="auth-eyebrow">Your campus meal</p><h3>{cart.restaurantName}</h3><p>{findCampus(cart.campusId).name}</p></div><Link className="button-link button-secondary" to="/cart">Edit cart</Link></div>
    <div className="checkout-layout"><section className="checkout-panel" aria-labelledby="checkout-delivery-title"><h3 id="checkout-delivery-title">Delivery details</h3>
      {destination.phase === 'loading' && <p role="status">Loading synthetic drop-offs…</p>}
      {destination.phase === 'error' && <div className="menu-feedback menu-feedback-error" role="alert"><p>Synthetic drop-offs could not be loaded. No destination or fee has been confirmed.</p><button className="button-secondary" onClick={() => setLoadAttempt((value) => value + 1)}>Retry loading drop-offs</button></div>}
      {destination.phase === 'ready' && !destination.data.length && <div className="menu-state"><h4>No synthetic drop-offs available</h4><p>This cart’s campus has no supported demo handoff locations. No order can be submitted.</p></div>}
      <form ref={formRef} onSubmit={submit} className="checkout-form" noValidate>
        <fieldset disabled={locked}>
          <div><label htmlFor={`${prefix}-recipientName`}>Recipient name (required)</label><input {...field('recipientName')} type="text" autoComplete="name" maxLength={120} required />{errorFor('recipientName')}</div>
          <div><label htmlFor={`${prefix}-contactPhone`}>Contact phone (required)</label><input {...field('contactPhone')} type="tel" autoComplete="tel" maxLength={40} required />{errorFor('contactPhone')}</div>
          <div><label htmlFor={`${prefix}-dropoffId`}>Synthetic drop-off (required)</label><select {...field('dropoffId')} required disabled={destination.phase !== 'ready' || !destination.data.length}>
            <option value="">Choose a synthetic drop-off</option>{destination.data.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>{errorFor('dropoffId')}</div>
          <div><label htmlFor={`${prefix}-handoffInstructions`}>Handoff instructions (optional)</label><textarea {...field('handoffInstructions')} rows={3} maxLength={500} />{errorFor('handoffInstructions')}</div>
        </fieldset>
        <div className="checkout-quote" ref={quoteRef} tabIndex={-1} aria-labelledby={`${prefix}-quote-title`}><h4 id={`${prefix}-quote-title`}>Demo delivery quote</h4>
          <p>Restaurants deliver and collect cash on delivery in ETB. Demo fees are non-negative and strictly below 100 ETB. Real pricing and drop-offs remain undecided.</p>
          {loadingQuote ? <p role="status">Requesting a synthetic delivery quote…</p>
            : quote ? <p role="status">Synthetic delivery fee: <strong>{formatETB(quote.deliveryFeeMinor)}</strong>. Valid only for these items and this drop-off until it expires.</p>
              : <p role="status">{currentQuote ? 'This quote has expired. Request a new quote and review the total.' : 'Delivery is not quoted. Request a quote for the current cart and selected drop-off.'}</p>}
          {quoteState?.binding === quoteBinding && quoteState.phase === 'error' && <p className="error-text" role="alert">The synthetic quote failed or was invalid. No fee was accepted. Please request it again.</p>}
          <button className="button-secondary" type="button" disabled={locked || loadingQuote || destination.phase !== 'ready' || !destination.data.length} onClick={requestQuote}>{loadingQuote ? 'Quoting…' : quote ? 'Refresh demo quote' : 'Get demo delivery quote'}</button>
        </div>
        {totals && <p className="checkout-reviewed-total">Final demo total to review: <strong>{formatETB(totals.totalMinor)}</strong></p>}
        <label className="checkout-review"><input type="checkbox" name="reviewed" checked={reviewed} disabled={locked || !quote || loadingQuote} onChange={(event) => setReviewedKey(event.target.checked ? reviewKey : '')} /><span>I have reviewed these items, the synthetic delivery fee and the final demo total.</span></label>
        {state.error && <div ref={feedbackRef} tabIndex={-1} className="menu-feedback menu-feedback-error" role="alert"><p>{state.error}</p>{state.phase === 'review-required' && state.notices?.map((notice) => <p key={notice}>{notice}</p>)}</div>}
        <p className="checkout-progress" role="status">{state.phase === 'checking' ? 'Rechecking current demo menu prices and availability…' : state.phase === 'submitting' ? 'Submitting one simulated order. Please wait.' : state.phase === 'recovering' ? 'Looking up the existing operation only…' : ''}</p>
        <button type="submit" disabled={locked || pending || !quote || !reviewed || loadingQuote || destination.phase !== 'ready'}>{busy ? 'Please wait…' : 'Submit demo order'}</button>
        <p className="menu-helper">This is a simulation. No live order, payment or delivery is created. A confirmed failure preserves your entries; uncertain operations are never retried automatically.</p>
      </form>
    </section><aside className="cart-summary checkout-summary" aria-labelledby="checkout-summary-title"><h3 id="checkout-summary-title">Review your meal</h3><CheckoutItems cart={cart} />
      {totals ? <CheckoutAmounts totals={totals} /> : <dl><div><dt>Food subtotal</dt><dd>{formatETB(cartTotals(cart).subtotalMinor)}</dd></div><div><dt>Delivery fee</dt><dd>Not yet quoted</dd></div><div><dt>Final total</dt><dd>Quote required</dd></div></dl>}
      <p>Cash on delivery in ETB · Restaurant-managed delivery.</p><p>{quote ? 'The final demo total includes this synthetic delivery quote.' : 'The unquoted food subtotal is not a final payable total.'} Demo fees do not define a real delivery formula.</p>
    </aside></div>
  </>;
};

const CheckoutPage = () => {
  const { session, state } = useCheckout();
  const { cart, context } = useCart();
  const { identity } = useIdentity();
  if (state.phase === 'confirmed' && state.receipt.studentId === identity.user.id) return <CheckoutReceipt />;
  if (['uncertain', 'recovering'].includes(state.phase) && state.attempt?.studentId === identity.user.id) return <CheckoutRecovery />;
  const otherOperation = state.attempt && state.attempt.studentId !== identity.user.id && ['checking', 'submitting', 'uncertain', 'recovering', 'confirmed'].includes(state.phase);
  return <section className="student-page checkout-page" aria-labelledby="checkout-title">
    <div className="page-header"><div><p className="auth-eyebrow">Verified student · Demo only</p><h2 id="checkout-title">Review checkout</h2></div><Link className="button-link button-secondary" to="/cart">Return to cart</Link></div>
    {!session.client.available ? <div className="menu-state"><h3>Live checkout unavailable</h3><p>No supported ordering service is connected. Synthetic quotes and submission exist only in the isolated harness. Your cart is preserved.</p></div>
      : otherOperation ? <div className="menu-state"><h3>Another demo operation is reserved</h3><p>This tab already has an operation for another synthetic identity. No new order has been sent. Return to that identity to view its outcome.</p></div>
        : !cart ? ['checking', 'submitting'].includes(state.phase) ? <div className="menu-state"><h3>Demo operation in progress</h3><p role="status">Please wait for the existing operation’s result. No second order is being submitted.</p></div> : <div className="menu-state"><h3>Your demo cart is empty</h3>{state.phase === 'review-required' && <p role="alert">{state.error}</p>}<p>Choose available food before reviewing checkout.</p><Link className="button-link" to={browsePath(context?.campusId)}>Browse restaurants</Link></div>
          : <CheckoutForm key={`${identity.user.id}:${cart.restaurantId}:${cart.campusId}`} />}
  </section>;
};
export default CheckoutPage;
