import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useCart } from './CartContext.js';
import { CheckoutContext } from './CheckoutContext.js';
import { CHECKOUT_SERVICE, createCheckoutSession } from '../utils/checkout.js';
import { createStudentOrdersClient, createStudentOrderCancellations } from '../utils/studentOrders.js';

const CheckoutProvider = ({ children, service = CHECKOUT_SERVICE }) => {
  const session = useMemo(() => createCheckoutSession(service), [service]);
  const studentOrders = useMemo(() => {
    const client = createStudentOrdersClient(service);
    return { client, cancellations: createStudentOrderCancellations(client) };
  }, [service]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { clearSubmittedCart, reviewCatalog } = useCart();
  const handled = useRef(new Set());
  const [draft, setDraft] = useState(null); // Memory only; never a storage effect.
  useEffect(() => {
    if (handled.current.has(state)) return;
    if (state.phase === 'confirmed') { handled.current.add(state); clearSubmittedCart(state.attempt.cart, state.attempt.revision); }
    if (state.phase === 'review-required') { handled.current.add(state); reviewCatalog(state.catalog, state.revision); }
  }, [state, clearSubmittedCart, reviewCatalog]);
  const value = useMemo(() => ({ session, state, draft, setDraft, studentOrders }), [session, state, draft, studentOrders]);
  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
};
CheckoutProvider.propTypes = {
  children: (props) => props.children == null ? new Error('CheckoutProvider requires content.') : null,
  service: (props) => props.service != null && typeof props.service.available !== 'boolean' ? new Error('Checkout service must declare availability.') : null,
};
export default CheckoutProvider;
