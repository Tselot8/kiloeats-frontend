import { findCampus } from './studentBrowsing.js';

export const GUEST_IDENTITY = Object.freeze({ status: 'ready', role: 'guest' });
export const VERIFICATION_STATES = Object.freeze(['not-submitted', 'pending', 'verified', 'rejected']);
export const IDENTITY_SERVICE = Object.freeze({ async read() { return { role: 'guest' }; } });
export const VERIFICATION_SERVICE = Object.freeze({ available: false });
const unavailable = () => ({ status: 'unavailable', role: null });
const text = (value) => typeof value === 'string' ? value.trim() : '';
const unsafeCharacters = (value) => [...value].some((character) => character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);

// This is a frontend adapter shape, not a claimed session API contract. No
// identity or role is read from browser storage, URL parameters, or auth forms.
export const normalizeIdentity = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  if (value.status !== undefined && value.status !== 'ready') return unavailable();
  if (value.role === 'guest') return GUEST_IDENTITY;
  if (!['student', 'restaurant-staff', 'admin'].includes(value.role) || !text(value.user?.id)) return unavailable();
  const user = { id: text(value.user.id), name: text(value.user.name), email: text(value.user.email) };
  if (value.role === 'student') {
    if (!findCampus(value.user.campusId) || !VERIFICATION_STATES.includes(value.verification?.status)) return unavailable();
    return { status: 'ready', role: 'student', user: { ...user, campusId: value.user.campusId },
      verification: { status: value.verification.status, rejectionReason: text(value.verification.rejectionReason) } };
  }
  if (value.role === 'restaurant-staff') {
    if (!text(value.restaurantId)) return unavailable();
    return { status: 'ready', role: value.role, user, restaurantId: text(value.restaurantId), restaurantName: text(value.restaurantName) };
  }
  return { status: 'ready', role: 'admin', user };
};

export const accessDecision = (area, identity) => {
  if (area === 'public') return 'allowed';
  if (!['student', 'merchant', 'admin'].includes(area)) return 'denied';
  if (identity?.status === 'loading') return 'loading';
  const normalized = normalizeIdentity(identity);
  if (identity?.status !== 'ready' || normalized.status !== 'ready') return 'unavailable';
  if (normalized.role === 'guest') return 'login-required';
  const required = { student: 'student', merchant: 'restaurant-staff', admin: 'admin' }[area];
  return normalized.role === required ? 'allowed' : 'denied';
};

export const orderEligibility = (identity) => accessDecision('student', identity) === 'allowed' && identity.verification.status === 'verified';

const routeArea = (path) => {
  if (['/', '/edit-menu', '/orders', '/profile'].includes(path)) return 'merchant';
  if (path === '/account') return 'student';
  if (path === '/admin') return 'admin';
  return 'public';
};

export const safeReturnPath = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || unsafeCharacters(value)) return '/browse';
  try {
    const url = new URL(value, 'https://kiloeats.invalid');
    const decoded = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://kiloeats.invalid' || unsafeCharacters(decoded) || decoded.includes('//') || decoded.includes('%')) return '/browse';
    const original = url.pathname.replace(/\/+$/, '') || '/';
    const path = /^\/restaurant\/[a-z0-9_-]+$/i.test(original) ? `/restaurant/${original.split('/')[2]}` : original.toLowerCase();
    if (!['/', '/edit-menu', '/orders', '/profile', '/account', '/admin', '/browse', '/cart'].includes(path)
      && !/^\/restaurant\/[a-zA-Z0-9_-]+$/.test(path)) return '/browse';
    // Only preserve existing, non-sensitive navigation context. Never reflect
    // arbitrary queries, credential-like fields, fragments or nested redirects.
    const query = new URLSearchParams();
    if ((path === '/browse' || path === '/cart' || path.startsWith('/restaurant/')) && findCampus(url.searchParams.get('campus'))) query.set('campus', url.searchParams.get('campus'));
    if (path === '/edit-menu' && /^[a-zA-Z0-9_-]{1,100}$/.test(url.searchParams.get('item') || '')) query.set('item', url.searchParams.get('item'));
    return path + (query.size ? `?${query}` : '');
  } catch { return '/browse'; }
};

export const identityDestination = (identity, requested) => {
  const current = identity?.status === 'ready' ? normalizeIdentity(identity) : unavailable();
  if (current.status !== 'ready' || current.role === 'guest') return '/browse';
  const fallback = { student: '/account', 'restaurant-staff': '/', admin: '/admin' }[current.role] || '/browse';
  if (!requested) return fallback;
  const path = safeReturnPath(requested);
  const area = routeArea(path.split('?')[0]);
  return accessDecision(area, current) === 'allowed' ? path : fallback;
};

export const submitSyntheticVerification = async (identity, service = VERIFICATION_SERVICE) => {
  if (accessDecision('student', identity) !== 'allowed' || !['not-submitted', 'rejected'].includes(identity.verification.status)) return { state: 'unavailable' };
  if (service.available !== true || service.synthetic !== true || typeof service.submitExample !== 'function') return { state: 'unavailable' };
  try { await service.submitExample(); return { state: 'success' }; }
  catch { return { state: 'error' }; }
};
