export const orderKey = (id) => {
  if (typeof id === 'number' && Number.isSafeInteger(id)) return String(id);
  if (typeof id === 'string' && id.trim() && !['.', '..'].includes(id)) return id;
  return null;
};

export const parseOrders = (data) => {
  const orders = data?.orders;
  const seen = new Set();
  if (!Array.isArray(orders)) throw new Error('The order service returned an unreadable orders list. Please refresh orders.');
  for (const order of orders) {
    const key = orderKey(order?.id);
    const total = order?.totalPrice;
    if (!order || key === null || seen.has(key)
      || !Array.isArray(order.items) || order.items.some((item) => typeof item !== 'string' || !item.trim())
      || !['number', 'string'].includes(typeof total) || (typeof total === 'string' && !total.trim())
      || !Number.isFinite(Number(total)) || Number(total) < 0
      || typeof order.status !== 'string' || !order.status.trim()) {
      throw new Error('The order service returned invalid or ambiguous order details. Please refresh orders.');
    }
    seen.add(key);
  }
  return orders;
};

export const canChangeOrderStatus = (current, next) => (
  (current === 'Pending' && ['Accepted', 'Declined'].includes(next))
  || (current === 'Accepted' && next === 'Done')
);

export const orderStatus = (status) => {
  switch (status) {
    case 'Pending': return { label: 'Pending', tone: 'pending', detail: 'Awaiting your decision.' };
    case 'Accepted': return { label: 'Accepted', tone: 'accepted', detail: 'Mark ready when food preparation is complete.' };
    case 'Declined': return { label: 'Declined', tone: 'declined', detail: 'This order was declined.' };
    case 'Done': return { label: 'Ready', tone: 'ready', detail: 'Food preparation marked ready.' };
    default: return { label: status, tone: 'unknown', detail: 'Actions are unavailable for this status. Refresh orders to check for an update.' };
  }
};

export const formatOrderTotal = (value) => `${new Intl.NumberFormat('en-ET', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value))} Br.`;
