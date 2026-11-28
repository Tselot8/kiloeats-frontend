import { accessDecision } from './identity.js';
import { findCampus } from './studentBrowsing.js';
import { checkoutTotals, CHECKOUT_SERVICE } from './checkout.js';

export const STUDENT_ORDER_PROGRESS = Object.freeze(['Pending', 'Accepted', 'Ready', 'Delivered']);
export const STUDENT_ORDER_STATUSES = Object.freeze([...STUDENT_ORDER_PROGRESS, 'Declined', 'Cancelled']);
export const STUDENT_ORDER_TRANSITIONS = Object.freeze({ Pending: ['Accepted', 'Declined', 'Cancelled'], Accepted: ['Ready'], Ready: ['Delivered'], Delivered: [], Declined: [], Cancelled: [] });
const methods = ['listOrders', 'readOrder', 'cancelOrder', 'lookupCancellation'];
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value).getTime());
const error = (code, message) => Object.assign(new Error(message), { code });
const referencePattern = /^DEMO-[A-Z0-9-]+$/;
export const studentOrderPath = (reference) => referencePattern.test(reference) ? `/student/orders/${reference}` : '/student/orders';
export const studentOrdersAvailable = (service = CHECKOUT_SERVICE) => service?.available === true && service.synthetic === true
  && methods.every((method) => typeof service[method] === 'function');
const requireStudent = (identity, service) => {
  if (accessDecision('student', identity) !== 'allowed') throw error('ACCESS', 'A student identity is required for your demo orders.');
  if (!studentOrdersAvailable(service)) throw error('UNAVAILABLE', 'Live student orders are unavailable. Only the isolated demo service can supply these records.');
};

// Receipt snapshots are read from the order, never rebuilt from today's menu.
// Missing optional information is retained as missing, not invented by the UI.
export const parseStudentOrder = (value, identity) => {
  const invalid = () => { throw error('MALFORMED', 'The demo order response was invalid or did not belong to this student. No new details were accepted.'); };
  if (accessDecision('student', identity) !== 'allowed' || !value || value.studentId !== identity.user.id
    || !referencePattern.test(value.reference) || !text(value.restaurantId) || !findCampus(value.campusId)
    || !STUDENT_ORDER_STATUSES.includes(value.status) || !Number.isSafeInteger(value.version) || value.version < 1
    || !Array.isArray(value.items) || !value.items.length || new Set(value.items.map((item) => item?.itemId)).size !== value.items.length
    || value.items.some((item) => !item || !text(item.itemId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1)
    || (value.confirmedAt != null && !timestamp(value.confirmedAt))
    || (value.paymentMethod != null && value.paymentMethod !== 'cash-on-delivery')) invalid();
  let totals;
  try { totals = checkoutTotals({ items: value.items }, value.deliveryFeeMinor); } catch { invalid(); }
  if (value.subtotalMinor !== totals.subtotalMinor || value.totalMinor !== totals.totalMinor) invalid();
  const events = value.statusEvents ?? [];
  if (!Array.isArray(events) || events.some((event) => !event || !STUDENT_ORDER_STATUSES.includes(event.status)
    || (event.at != null && !timestamp(event.at))) || new Set(events.map((event) => event.status)).size !== events.length
    || (events.length && (events[0].status !== 'Pending' || events.at(-1).status !== value.status))
    || events.some((event, index) => index > 0 && (!STUDENT_ORDER_TRANSITIONS[events[index - 1].status].includes(event.status)
      || (event.at != null && events[index - 1].at != null && event.at < events[index - 1].at)))) invalid();
  return {
    reference: value.reference, studentId: value.studentId, restaurantId: value.restaurantId,
    restaurantName: text(value.restaurantName) ? value.restaurantName : '', campusId: value.campusId,
    status: value.status, version: value.version, confirmedAt: value.confirmedAt ?? null,
    paymentMethod: value.paymentMethod ?? null, ...totals,
    items: value.items.map((item) => ({ itemId: item.itemId, name: text(item.name) ? item.name : '',
      image: typeof item.image === 'string' ? item.image : '', quantity: item.quantity, unitPriceMinor: item.unitPriceMinor })),
    statusEvents: events.map(({ status, at }) => ({ status, at: at ?? null })),
    delivery: Object.fromEntries(['recipientName', 'contactPhone', 'dropoffName', 'handoffInstructions'].map((key) => [key,
      typeof value.delivery?.[key] === 'string' ? value.delivery[key] : ''])),
  };
};

export const studentStatusPresentation = (order) => {
  const descriptions = {
    Pending: 'Waiting for restaurant acceptance. You may cancel while this demo order is still Pending.',
    Accepted: 'The restaurant has accepted this demo order. Student cancellation is no longer available.',
    Ready: 'The food is prepared. Ready does not mean delivered.',
    Delivered: 'Marked delivered in the simulation. No real delivery took place.',
    Declined: 'The restaurant declined this demo order. It will not progress to delivery.',
    Cancelled: 'This demo order was cancelled. It will not progress to delivery.',
  };
  const position = STUDENT_ORDER_PROGRESS.indexOf(order.status);
  return { description: descriptions[order.status], terminal: ['Delivered', 'Declined', 'Cancelled'].includes(order.status),
    steps: STUDENT_ORDER_PROGRESS.map((status, index) => ({ status,
      state: status === order.status ? 'current' : position >= 0 ? index < position ? 'complete' : 'upcoming'
        : order.statusEvents.some((event) => event.status === status) ? 'complete' : 'not-reached',
      at: order.statusEvents.find((event) => event.status === status)?.at ?? null,
    })) };
};
export const canCancelStudentOrder = (order) => order?.status === 'Pending';
export const formatStudentOrderTime = (at) => new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' }).format(new Date(at));

export const createStudentOrdersClient = (service = CHECKOUT_SERVICE) => ({
  available: studentOrdersAvailable(service),
  async list(identity, options = {}) {
    requireStudent(identity, service);
    const result = await service.listOrders({ identity, signal: options.signal });
    if (!Array.isArray(result) || new Set(result.map((order) => order?.reference)).size !== result.length) {
      throw error('MALFORMED', 'The demo order list was malformed. It was not treated as an empty history.');
    }
    return result.map((order) => parseStudentOrder(order, identity));
  },
  async read(identity, reference, options = {}) {
    requireStudent(identity, service);
    if (!referencePattern.test(reference)) return null;
    const result = await service.readOrder({ identity, reference, signal: options.signal });
    if (result?.outcome === 'not-found') return null;
    const order = parseStudentOrder(result, identity);
    if (order.reference !== reference) throw error('MALFORMED', 'The demo service returned a different order. No new details were accepted.');
    return order;
  },
  async cancel(identity, attempt) {
    requireStudent(identity, service);
    return service.cancelOrder({ identity, reference: attempt.reference, version: attempt.version, operationId: attempt.operationId });
  },
  async reconcile(identity, attempt) {
    requireStudent(identity, service);
    return service.lookupCancellation({ identity, reference: attempt.reference, operationId: attempt.operationId });
  },
});

const IDLE = Object.freeze({ phase: 'idle', error: '', order: null, updatedAt: 0 });
// One cancellation coordinator shares the checkout provider's tab lifetime.
// Navigation does not create a new operation after a lost cancellation response.
export const createStudentOrderCancellations = (client, { now = Date.now, makeId = () => globalThis.crypto.randomUUID() } = {}) => {
  const records = new Map(), pending = new Map(), listeners = new Set();
  let revision = 0;
  const keyFor = (identity, reference) => JSON.stringify([identity?.user?.id, reference]);
  const publish = (key, state) => { records.set(key, state); revision++; listeners.forEach((listener) => listener()); return state; };
  const uncertain = (key, previous, message) => publish(key, { ...previous, phase: 'uncertain', error: message });
  const accept = (identity, key, previous, response, reconciling = false) => {
    const { attempt } = previous;
    if (response?.operationId !== attempt.operationId) throw error('MALFORMED', 'Cancellation operation mismatch.');
    if (response.outcome === 'not-found' && !reconciling) return publish(key, { ...previous, phase: 'missing', order: null, updatedAt: now(), error: 'This demo order is unavailable. It may have been reset. No cancellation was confirmed.' });
    if (response.outcome === 'cancelled' || response.outcome === 'rejected') {
      const order = parseStudentOrder(response.order, identity);
      if (!order || order.reference !== attempt.reference || order.version < attempt.version) throw error('MALFORMED', 'Cancellation order mismatch.');
      if (response.outcome === 'cancelled') {
        if (order.status !== 'Cancelled' || order.version <= attempt.version) throw error('MALFORMED', 'Cancellation was not confirmed.');
        return publish(key, { phase: 'confirmed', attempt, order, updatedAt: now(), error: '' });
      }
      if (!['STALE', 'NOT_PENDING', 'FAILED'].includes(response.code)) throw error('MALFORMED', 'Unknown rejection result.');
      return publish(key, { phase: response.code === 'FAILED' ? 'failed' : 'stale', attempt, order, updatedAt: now(),
        error: response.code === 'FAILED' ? `The demo service rejected cancellation. No cancellation was applied.${canCancelStudentOrder(order) ? ' You can explicitly review and try again.' : ' Only Pending orders can be cancelled.'}`
          : `Cancellation was not applied. The service reported ${order.status}. Review the latest order before deciding what to do next.` });
    }
    return uncertain(key, previous, 'No confirmed cancellation result is available. This does not prove the request failed. No repeat write was sent.');
  };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getRevision: () => revision,
    getSnapshot(identity, reference) { return accessDecision('student', identity) === 'allowed' ? records.get(keyFor(identity, reference)) || IDLE : IDLE; },
    cancel(identity, input) {
      if (accessDecision('student', identity) !== 'allowed' || !client.available) return Promise.reject(error('ACCESS', 'Student demo cancellation is unavailable.'));
      const order = parseStudentOrder(input, identity), key = keyFor(identity, order.reference);
      if (pending.has(key)) return pending.get(key);
      const previous = records.get(key) || IDLE;
      if (['uncertain', 'reconciling', 'confirmed'].includes(previous.phase)) return Promise.resolve(previous);
      if (!canCancelStudentOrder(order)) return Promise.resolve(publish(key, { ...previous, phase: 'stale', order, updatedAt: now(), error: 'Only Pending demo orders can be cancelled.' }));
      const attempt = { reference: order.reference, studentId: identity.user.id, version: order.version,
        operationId: previous.attempt?.version === order.version ? previous.attempt.operationId : makeId() };
      const started = { phase: 'pending', attempt, order, updatedAt: previous.updatedAt, error: '' };
      publish(key, started);
      const task = Promise.resolve().then(() => client.cancel(identity, attempt)).then((response) => accept(identity, key, started, response))
        .catch(() => uncertain(key, started, 'Cancellation could not be confirmed. It may have been applied. Check the same operation’s result; no mutation will be retried automatically.'))
        .finally(() => pending.delete(key));
      pending.set(key, task); return task;
    },
    reconcile(identity, reference) {
      const key = keyFor(identity, reference), previous = records.get(key);
      if (pending.has(key)) return pending.get(key);
      if (!previous || previous.phase !== 'uncertain' || accessDecision('student', identity) !== 'allowed') return Promise.resolve(IDLE);
      publish(key, { ...previous, phase: 'reconciling', error: '' });
      const task = Promise.resolve().then(() => client.reconcile(identity, previous.attempt)).then((response) => accept(identity, key, previous, response, true))
        .catch(() => uncertain(key, previous, 'The cancellation result could not be checked. Your last confirmed order details are kept. No repeat write was sent.'))
        .finally(() => pending.delete(key));
      pending.set(key, task); return task;
    },
  };
};

export const newestStudentOrder = (readOrder, cancellation) => cancellation.phase === 'missing' ? null
  : cancellation.order && (!readOrder || cancellation.order.version > readOrder.version) ? cancellation.order : readOrder;
