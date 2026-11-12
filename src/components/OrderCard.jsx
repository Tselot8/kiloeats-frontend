import { useEffect, useRef } from "react";
import { formatOrderTotal, orderKey, orderStatus } from "../utils/orders.js";

const OrderCard = ({ order, feedback = {}, onAction, onConfirm, disabled }) => {
  const cardRef = useRef(null);
  const restoreActionFocus = useRef(false);
  const wasPending = useRef(false);
  const status = orderStatus(order.status);
  const pending = Boolean(feedback.pending);

  useEffect(() => {
    if (wasPending.current && !pending && restoreActionFocus.current) {
      if (document.activeElement === document.body || cardRef.current.contains(document.activeElement)) {
        const target = cardRef.current.querySelector('button:not(:disabled)') || cardRef.current.querySelector('h3');
        target?.focus();
      }
      restoreActionFocus.current = false;
    }
    wasPending.current = pending;
  }, [pending]);

  const act = (action, event) => {
    restoreActionFocus.current = document.activeElement === event.currentTarget;
    onAction(order, action);
  };

  return (
    <article ref={cardRef} className="order-card" data-order-id={orderKey(order.id)} aria-label={`Order ${order.id}`}>
      <div className="order-card-heading">
        <h3 tabIndex={-1}>Order <span>#{order.id}</span></h3>
        <span className={`order-status order-status-${status.tone}`}>{status.label}</span>
      </div>
      <div className="order-card-details">
        <div className="order-items"><h4>Items</h4>
          {order.items.length > 0 ? <ul>{order.items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>No items listed.</p>}
        </div>
        <dl className="order-total"><dt>Total price</dt><dd>{formatOrderTotal(order.totalPrice)}</dd></dl>
      </div>
      <div className="order-card-footer">
        <p className="order-status-detail">{status.detail}</p>
        <div className="order-buttons" aria-busy={pending}>
          {order.status === "Pending" && <>
            <button disabled={disabled || pending} onClick={(event) => act("Accepted", event)} aria-label={`Accept order ${order.id}`}>{pending && feedback.action === "Accepted" ? "Accepting…" : "Accept order"}</button>
            <button className="deny-order" disabled={disabled || pending} onClick={() => onConfirm(order, "Declined")} aria-label={`Decline order ${order.id}`}>Decline order</button>
          </>}
          {order.status === "Accepted" && <>
            <button disabled={disabled || pending} onClick={(event) => act("Done", event)} aria-label={`Mark order ${order.id} preparation ready`}>{pending && feedback.action === "Done" ? "Marking ready…" : "Mark ready"}</button>
            <button className="deny-order" disabled={disabled || pending} onClick={() => onConfirm(order, "delete")} aria-label={`Delete order ${order.id}`}>Delete order</button>
          </>}
        </div>
      </div>
      <p className="order-operation-status" role="status">{feedback.message || ""}</p>
      {feedback.error && <p className="menu-feedback menu-feedback-error order-feedback" role="alert">{feedback.error}</p>}
    </article>
  );
};

OrderCard.propTypes = {
  order: (props) => !props.order || typeof props.order !== "object" ? new Error("OrderCard requires order details.") : null,
  feedback: (props) => props.feedback != null && typeof props.feedback !== "object" ? new Error("OrderCard feedback must be an object.") : null,
  onAction: (props) => typeof props.onAction !== "function" ? new Error("OrderCard requires onAction.") : null,
  onConfirm: (props) => typeof props.onConfirm !== "function" ? new Error("OrderCard requires onConfirm.") : null,
  disabled: (props) => typeof props.disabled !== "boolean" ? new Error("OrderCard requires a disabled state.") : null,
};

export default OrderCard;
