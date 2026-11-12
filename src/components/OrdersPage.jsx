import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrders } from "../hooks/useOrders.js";
import { orderKey } from "../utils/orders.js";
import MenuDialog from "./MenuDialog.jsx";
import OrderCard from "./OrderCard.jsx";

const OrdersPage = () => {
  const { orders, loading, loadError, reload, feedback, announcement, perform } = useOrders();
  const [confirmation, setConfirmation] = useState(null);
  const hasPendingAction = Object.values(feedback).some((entry) => entry.pending);
  const feedbackFor = (order) => Object.hasOwn(feedback, orderKey(order.id)) ? feedback[orderKey(order.id)] : undefined;
  const confirmationFeedback = confirmation ? feedbackFor(confirmation.order) || {} : {};
  const dismiss = () => { if (!confirmationFeedback.pending) setConfirmation(null); };
  const confirm = async () => {
    if (await perform(confirmation.order, confirmation.action)) setConfirmation(null);
  };

  return (
    <section className="orders-page" aria-labelledby="orders-heading">
      <div className="page-header">
        <div>
          <h2 id="orders-heading">Orders</h2>
          <p className="menu-helper">Review incoming orders and manage food preparation.</p>
        </div>
        <div className="orders-page-actions">
          <Link to="/" className="button-link button-secondary orders-back-to-menu">Back to Menu</Link>
          <button id="orders-refresh" className="button-secondary" onClick={reload} disabled={loading || hasPendingAction}>{loading ? "Loading…" : "Refresh orders"}</button>
        </div>
      </div>
      <p className="orders-readiness-note">Ready refers to food preparation.</p>
      <p className="orders-announcement" role="status">{announcement}</p>
      {loading && <p className="menu-state" role="status">{orders.length ? "Refreshing orders…" : "Loading orders…"}</p>}
      {loadError && <div className="menu-feedback menu-feedback-error" role="alert">
        <p>{loadError}</p>
        {orders.length > 0 && <p>Showing the last loaded orders.</p>}
        <button className="button-secondary" onClick={reload} disabled={loading || hasPendingAction}>Retry loading orders</button>
      </div>}
      {!loading && !loadError && orders.length === 0 && <div className="menu-state orders-empty"><h3>No orders available</h3><p>There are no orders in the current list. Refresh to check again.</p></div>}
      <div className="orders-list">
        {orders.map((order) => <OrderCard key={orderKey(order.id)} order={order} feedback={feedbackFor(order)} disabled={loading} onAction={perform} onConfirm={(selected, action) => setConfirmation({ order: selected, action })} />)}
      </div>
      {confirmation && (
        <MenuDialog title={`${confirmation.action === "delete" ? "Delete" : "Decline"} order #${confirmation.order.id}?`} busy={Boolean(confirmationFeedback.pending)} onDismiss={dismiss} fallbackFocusSelector="#orders-refresh">
          <div className="orders-confirmation">
            <p>{confirmation.action === "delete"
              ? "Delete this order record? It will be removed from your orders list and cannot be restored here."
              : "Decline this order? You cannot accept it afterward from this screen."}</p>
            {confirmationFeedback.error && <p className="menu-feedback menu-feedback-error" role="alert">{confirmationFeedback.error}</p>}
            <div className="menu-form-actions">
              <button type="button" className="button-secondary" data-initial-focus disabled={Boolean(confirmationFeedback.pending)} onClick={dismiss}>Keep order</button>
              <button type="button" className="button-danger" disabled={Boolean(confirmationFeedback.pending)} onClick={confirm}>{confirmationFeedback.pending
                ? confirmation.action === "delete" ? "Deleting…" : "Declining…"
                : confirmation.action === "delete" ? "Delete order" : "Decline order"}</button>
            </div>
            <p className="order-operation-status" role="status">{confirmationFeedback.pending ? confirmationFeedback.message : ""}</p>
          </div>
        </MenuDialog>
      )}
    </section>
  );
};

export default OrdersPage;
