import { useCallback, useEffect, useRef, useState } from "react";
import { changeOrderStatus, deleteOrder, fetchOrders, orderErrorMessage } from "../utils/api.js";
import { orderKey } from "../utils/orders.js";

const progress = { Accepted: "Accepting order…", Declined: "Declining order…", Done: "Marking preparation ready…", delete: "Deleting order…" };
const completed = { Accepted: "Order accepted.", Declined: "Order declined.", Done: "Food preparation marked ready.", delete: "Order record deleted from the list." };

export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const request = useRef(null);
  const pending = useRef(new Set());

  const reload = useCallback(async () => {
    if (pending.current.size > 0) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadError("");
    setAnnouncement("");
    try {
      const data = await fetchOrders({ signal: controller.signal });
      if (!controller.signal.aborted) { setOrders(data); setFeedback({}); }
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(orderErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return () => request.current?.abort();
  }, [reload]);

  const perform = async (order, action) => {
    const key = orderKey(order.id);
    if (key === null || loading || pending.current.has(key)) return false;
    pending.current.add(key);
    setFeedback((previous) => ({ ...previous, [key]: { pending: true, message: progress[action], action } }));
    setAnnouncement("");
    try {
      const updated = await (action === "delete" ? deleteOrder(order) : changeOrderStatus(order, action));
      setOrders((previous) => action === "delete"
        ? previous.filter((entry) => orderKey(entry.id) !== key)
        : previous.map((entry) => orderKey(entry.id) === key ? updated : entry));
      setFeedback((previous) => ({ ...previous, [key]: { pending: false, message: completed[action], action } }));
      if (action === "delete") setAnnouncement(`Order ${order.id}: ${completed.delete}`);
      return true;
    } catch (error) {
      setFeedback((previous) => ({ ...previous, [key]: { pending: false, error: orderErrorMessage(error), action } }));
      return false;
    } finally {
      pending.current.delete(key);
    }
  };

  return { orders, loading, loadError, reload, feedback, announcement, perform };
};
