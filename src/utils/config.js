export const DEFAULT_API_BASE_URL = 'https://kilo-eats-backend.onrender.com';

export const resolveApiBaseUrl = (value) => {
  const candidate = value?.trim() || DEFAULT_API_BASE_URL;
  let url;
  try { url = new URL(candidate); }
  catch { throw new Error('The merchant API URL is invalid. Check VITE_API_BASE_URL and restart the frontend.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.includes('?') || url.href.includes('#')) {
    throw new Error('The merchant API URL must be an HTTP(S) URL without credentials, a query, or a fragment. Check VITE_API_BASE_URL.');
  }
  return url.href.replace(/\/+$/, '');
};

// Vite replaces this public setting at build time. Node regression tests use
// the default; invalid configuration is reported by requests, not at app startup.
export const merchantApiUrl = (path) => `${resolveApiBaseUrl(import.meta.env?.VITE_API_BASE_URL)}${path}`;
