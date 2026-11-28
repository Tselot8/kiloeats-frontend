import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCheckout } from '../context/CheckoutContext.js';
import { useIdentity } from '../context/IdentityContext.js';
import { useStudentOrders } from '../hooks/useStudentOrders.js';
import { formatETB } from '../utils/cart.js';
import { findCampus, browsePath } from '../utils/studentBrowsing.js';
import { canCancelStudentOrder, formatStudentOrderTime, newestStudentOrder, studentOrderPath, studentStatusPresentation } from '../utils/studentOrders.js';
import FoodImage from './FoodImage.jsx';
import MenuDialog from './MenuDialog.jsx';

const RecordedTime = ({ at }) => at == null ? <span>Not recorded</span> : <time dateTime={new Date(at).toISOString()}>{formatStudentOrderTime(at)}</time>;
RecordedTime.propTypes = { at: (props) => props.at != null && typeof props.at !== 'number' ? new Error('Recorded time must be numeric.') : null };
const DemoOrderNotice = () => <aside className="checkout-demo-notice"><strong>Demo orders · In this tab only</strong><p>All orders and status changes here are synthetic. Page refresh resets this tab’s service and personal details. Refresh buttons below only read the current records. Progress changes only when explicitly simulated.</p></aside>;
const OrderStatus = ({ order }) => <span className={`student-order-status student-order-status-${order.status.toLowerCase()}`}>{order.status}</span>;
OrderStatus.propTypes = { order: (props) => !props.order ? new Error('Order status requires a record.') : null };

const ReadFeedback = ({ read, updatedAt, onRefresh, feedbackRef }) => <>
  {read.loading && <p className="student-order-progress" role="status">Refreshing your demo order data…</p>}
  {read.error && <div ref={feedbackRef} tabIndex={-1} className="menu-feedback menu-feedback-error" role="alert"><p>{read.error}</p><button className="button-secondary" disabled={read.loading} onClick={onRefresh}>Retry loading orders</button></div>}
  {updatedAt > 0 && <p className="student-order-updated">Last successful update: <RecordedTime at={updatedAt} /> · Addis Ababa time{read.error && ' · Previous confirmed details are shown.'}</p>}
</>;
ReadFeedback.propTypes = { read: (props) => !props.read ? new Error('Read feedback requires state.') : null,
  updatedAt: (props) => typeof props.updatedAt !== 'number' ? new Error('Read feedback requires a timestamp.') : null,
  onRefresh: (props) => typeof props.onRefresh !== 'function' ? new Error('Read feedback requires refresh.') : null,
  feedbackRef: (props) => !props.feedbackRef ? new Error('Read feedback requires a ref.') : null };

const OrderHistory = ({ client, cancellations, identity }) => {
  const read = useStudentOrders(client, identity);
  useSyncExternalStore(cancellations.subscribe, cancellations.getRevision, cancellations.getRevision);
  const feedbackRef = useRef(null), refreshRef = useRef(null), requested = useRef(false);
  const refresh = () => { requested.current = true; read.refresh(); };
  useEffect(() => {
    if (read.error) feedbackRef.current?.focus();
    else if (!read.loading && requested.current) { requested.current = false; if (document.activeElement === document.body) refreshRef.current?.focus(); }
  }, [read.error, read.loading]);
  const orders = read.data?.map((order) => newestStudentOrder(order, cancellations.getSnapshot(identity, order.reference))).filter(Boolean);
  const updatedAt = Math.max(read.updatedAt, ...(read.data || []).map((order) => cancellations.getSnapshot(identity, order.reference).updatedAt));
  return <section className="student-page student-orders-page" aria-labelledby="student-orders-title">
    <div className="page-header"><div><p className="auth-eyebrow">Student workspace · Demo only</p><h2 id="student-orders-title" tabIndex={-1}>Your demo orders</h2></div><button ref={refreshRef} className="button-secondary" onClick={refresh} disabled={read.loading}>{read.loading ? 'Refreshing…' : 'Refresh orders'}</button></div>
    <DemoOrderNotice /><ReadFeedback read={read} updatedAt={updatedAt} onRefresh={refresh} feedbackRef={feedbackRef} />
    {orders && !orders.length && !read.error && !read.loading && <div className="menu-state"><h3>No demo orders in this tab</h3><p>A confirmed checkout appears here immediately for its student. If this page was reloaded, the demo service and order history were reset.</p><Link className="button-link" to={browsePath(identity.user.campusId)}>Browse sample menus</Link></div>}
    {Boolean(orders?.length) && <div className="student-order-list">{orders.map((order) => <article className="student-order-card" key={order.reference}>
      <div className="student-order-card-heading"><div><h3>{order.restaurantName || 'Restaurant name not recorded'}</h3><p>{findCampus(order.campusId).name} · <span>{order.reference}</span></p></div><OrderStatus order={order} /></div>
      <p className="student-order-card-items">{order.items.map((item) => `${item.quantity} × ${item.name || `Item ${item.itemId} (name not recorded)`}`).join(' · ')}</p>
      <dl className="student-order-card-details"><div><dt>Final demo total</dt><dd>{formatETB(order.totalMinor)}</dd></div><div><dt>Payment method</dt><dd>{order.paymentMethod === 'cash-on-delivery' ? 'Cash on delivery (ETB)' : 'Not recorded'}</dd></div><div><dt>Recorded</dt><dd><RecordedTime at={order.confirmedAt} /></dd></div></dl>
      <div className="student-order-card-footer"><p>{studentStatusPresentation(order).description}</p><Link className="button-link button-secondary" to={studentOrderPath(order.reference)} aria-label={`View demo order ${order.reference}`}>View order & receipt</Link></div>
    </article>)}</div>}
  </section>;
};
const workspaceProps = { client: (props) => !props.client ? new Error('Order workspace requires a client.') : null,
  cancellations: (props) => !props.cancellations ? new Error('Order workspace requires cancellation state.') : null,
  identity: (props) => !props.identity ? new Error('Order workspace requires identity.') : null };
OrderHistory.propTypes = workspaceProps;

const OrderTimeline = ({ order }) => {
  const status = studentStatusPresentation(order);
  return <section className="student-order-timeline-section" aria-labelledby="student-order-timeline-title"><h3 id="student-order-timeline-title">Order progress</h3>
    <p>{status.description}</p><ol className="student-order-timeline" aria-label="Demo order progress">{status.steps.map((step) => <li className={`student-order-step-${step.state}`} key={step.status} aria-current={step.state === 'current' ? 'step' : undefined}>
      <strong>{step.status}</strong><span>{step.state === 'current' ? 'Current status' : step.state === 'complete' ? 'Reached' : step.state === 'not-reached' ? 'Not reached' : 'Not yet reached'}</span>{step.at != null && <RecordedTime at={step.at} />}
    </li>)}</ol>
    {['Declined', 'Cancelled'].includes(order.status) && <p className="student-order-terminal"><strong>{order.status}</strong> is a separate final outcome, not a delivery completion. {order.statusEvents.find((event) => event.status === order.status)?.at != null && <RecordedTime at={order.statusEvents.find((event) => event.status === order.status).at} />}</p>}
    <p className="menu-helper">Ready means prepared, not delivered. There is no map, courier assignment or delivery estimate.</p>
  </section>;
};
OrderTimeline.propTypes = OrderStatus.propTypes;

const StudentOrderReceipt = ({ order }) => <div className="checkout-layout student-order-receipt"><section className="checkout-panel" aria-labelledby="student-order-receipt-title"><h3 id="student-order-receipt-title">Receipt snapshot</h3>
  <dl className="checkout-reference"><div><dt>Restaurant</dt><dd>{order.restaurantName || 'Name not recorded'} · {order.restaurantId}</dd></div><div><dt>Campus</dt><dd>{findCampus(order.campusId).name}</dd></div><div><dt>Order reference</dt><dd>{order.reference}</dd></div><div><dt>Recorded</dt><dd><RecordedTime at={order.confirmedAt} /></dd></div></dl>
  <ul className="checkout-items" aria-label="Ordered food snapshots">{order.items.map((item) => <li key={item.itemId}><FoodImage src={item.image} name={item.name || `Food item ${item.itemId}`} illustrationId={item.itemId} /><div><h4>{item.name || 'Item name not recorded'}</h4><p>{item.quantity} × {formatETB(item.unitPriceMinor)}</p></div><strong>{formatETB(item.quantity * item.unitPriceMinor)}</strong></li>)}</ul>
  <h3>Recorded handoff details</h3><dl className="checkout-delivery-details">{[['recipientName', 'Recipient'], ['contactPhone', 'Contact phone'], ['dropoffName', 'Synthetic drop-off'], ['handoffInstructions', 'Instructions']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{order.delivery[key] || 'Not recorded'}</dd></div>)}</dl>
  <p className="menu-helper">Item names, quantities and prices are the submitted snapshots. Current menu changes do not rewrite this receipt.</p>
</section><aside className="cart-summary checkout-summary"><h3>Recorded demo amounts</h3><dl className="checkout-amounts"><div><dt>Food subtotal</dt><dd>{formatETB(order.subtotalMinor)}</dd></div><div><dt>Demo delivery fee</dt><dd>{formatETB(order.deliveryFeeMinor)}</dd></div><div className="checkout-final-total"><dt>Final demo total</dt><dd>{formatETB(order.totalMinor)}</dd></div></dl><p>Payment method: {order.paymentMethod === 'cash-on-delivery' ? 'Cash on delivery in ETB' : 'Not recorded'}.</p><p>No payment was processed. Restaurant-managed delivery and these fees are simulated; no live delivery or refund is claimed.</p></aside></div>;
StudentOrderReceipt.propTypes = OrderStatus.propTypes;

const OrderDetail = ({ client, cancellations, identity, reference }) => {
  const read = useStudentOrders(client, identity, reference);
  const action = useSyncExternalStore(cancellations.subscribe, () => cancellations.getSnapshot(identity, reference), () => cancellations.getSnapshot(identity, reference));
  const [selection, setSelection] = useState(null);
  const headingRef = useRef(null), feedbackRef = useRef(null), actionRef = useRef(null), refreshRef = useRef(null), requested = useRef(false);
  const order = read.missing ? null : newestStudentOrder(read.data, action);
  const busy = ['pending', 'reconciling'].includes(action.phase);
  const uncertain = ['uncertain', 'reconciling'].includes(action.phase);
  const refresh = () => { requested.current = true; read.refresh(); };
  useEffect(() => {
    if (read.error) feedbackRef.current?.focus();
    else if (!read.loading && requested.current) { requested.current = false; if (document.activeElement === document.body) refreshRef.current?.focus(); }
  }, [read.error, read.loading]);
  useEffect(() => {
    if (!selection && action.error) actionRef.current?.focus();
    if (!selection && action.phase === 'confirmed') headingRef.current?.focus();
  }, [selection, action.error, action.phase]);
  const confirm = async () => { await cancellations.cancel(identity, selection); setSelection(null); };
  const missing = read.missing || action.phase === 'missing';
  return <section className="student-page student-orders-page student-order-detail" aria-labelledby="student-order-title">
    <div className="page-header"><div><p className="auth-eyebrow">Student workspace · Demo only</p><h2 ref={headingRef} id="student-order-title" tabIndex={-1}>Your demo order</h2></div><div className="container1"><Link className="button-link button-secondary" to="/student/orders">All demo orders</Link><button ref={refreshRef} className="button-secondary" onClick={refresh} disabled={read.loading || busy || Boolean(selection)}>{read.loading ? 'Refreshing…' : 'Refresh order'}</button></div></div>
    <DemoOrderNotice /><ReadFeedback read={read} updatedAt={Math.max(read.updatedAt, action.updatedAt)} onRefresh={refresh} feedbackRef={feedbackRef} />
    {missing && <div className="menu-state"><h3>Demo order not available</h3><p>No order with this reference is available to this student in this tab. The service may have reset on page refresh. Another student’s receipt is never shown.</p><Link className="button-link" to="/student/orders">Return to your demo orders</Link></div>}
    {order && !missing && <>
      <div className="student-order-summary"><div><h3>{order.restaurantName || 'Restaurant name not recorded'}</h3><p>{order.reference} · {findCampus(order.campusId).name}</p></div><OrderStatus order={order} /></div>
      <OrderTimeline order={order} />
      <div className="student-order-actions">
        {canCancelStudentOrder(order) && !uncertain && <button className="button-danger" type="button" disabled={read.loading || Boolean(read.error) || busy} onClick={() => setSelection(structuredClone(order))}>Cancel pending demo order</button>}
        {action.phase === 'confirmed' && <p className="success-text" role="status">Demo order cancellation confirmed.</p>}
        {action.error && <p ref={actionRef} tabIndex={-1} className="menu-feedback menu-feedback-error" role="alert">{action.error}</p>}
        {uncertain && <div className="student-order-reconciliation"><p>Cancellation operation: <code>{action.attempt.operationId}</code>. Do not refresh the page to resolve this operation; the demo records reset.</p><button className="button-secondary" disabled={busy} onClick={() => cancellations.reconcile(identity, reference)}>{busy ? 'Checking cancellation…' : 'Check cancellation result'}</button><p className="menu-helper">This is a read-only lookup. No cancellation request is repeated.</p></div>}
        {busy && <p role="status">{action.phase === 'pending' ? 'Submitting one demo cancellation…' : 'Reading the existing cancellation result…'}</p>}
      </div><StudentOrderReceipt order={order} />
    </>}
    {selection && <MenuDialog title="Cancel this pending demo order?" busy={action.phase === 'pending'} onDismiss={() => setSelection(null)} fallbackFocusSelector="#student-order-title">
      <p>Cancel <strong>{selection.reference}</strong> from <strong>{selection.restaurantName || selection.restaurantId}</strong>?</p><p>Cancellation is allowed only while the order is still Pending. If the restaurant accepts first, the cancellation will not be applied. No real order or payment is affected.</p>
      {action.phase === 'pending' && <p role="status">Checking the current status and recording one demo cancellation. Please wait.</p>}
      <div className="menu-form-actions"><button className="button-secondary" data-initial-focus disabled={action.phase === 'pending'} onClick={() => setSelection(null)}>Keep demo order</button><button className="button-danger" disabled={action.phase === 'pending'} onClick={confirm}>{action.phase === 'pending' ? 'Cancelling…' : 'Cancel demo order'}</button></div>
    </MenuDialog>}
  </section>;
};
OrderDetail.propTypes = { ...workspaceProps, reference: (props) => typeof props.reference !== 'string' ? new Error('Order detail requires a reference.') : null };

const StudentOrdersPage = () => {
  const { identity } = useIdentity();
  const { studentOrders: { client, cancellations } } = useCheckout();
  const { orderReference } = useParams();
  if (!client.available) return <section className="route-message"><h2>Student orders unavailable</h2><p>No live student order service is connected. Order history, progress and cancellation are available only in the isolated synthetic harness.</p><Link className="button-link button-secondary" to="/browse">Browse restaurants</Link></section>;
  return orderReference === undefined ? <OrderHistory key={identity.user.id} client={client} cancellations={cancellations} identity={identity} />
    : <OrderDetail key={`${identity.user.id}:${orderReference}`} client={client} cancellations={cancellations} identity={identity} reference={orderReference.toUpperCase()} />;
};
export default StudentOrdersPage;
