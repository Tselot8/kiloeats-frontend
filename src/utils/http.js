import { merchantApiUrl } from './config.js';

// Endpoint-specific validation and write/read-back rules belong in api.js.
// This transport performs one request, never an automatic mutation retry.
export const merchantRequest = async (path, { method = 'GET', signal, json, httpError, uncertainMessage } = {}) => {
  const url = merchantApiUrl(path);
  const body = json === undefined ? undefined : JSON.stringify(json);
  const timeout = AbortSignal.timeout(20000);
  let response;
  try {
    response = await fetch(url, {
      method,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      ...(method === 'GET' ? { cache: 'no-store' } : {}),
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body }),
    });
  } catch (error) {
    if (uncertainMessage) throw new Error(uncertainMessage);
    throw error;
  }
  if (!response.ok) throw new Error(httpError(response.status));
  return response;
};

export const readJson = async (response, malformedMessage) => {
  try { return await response.json(); }
  catch (error) {
    // Interrupted downloads and timeouts are transport failures, not bad JSON.
    if (error instanceof SyntaxError) throw new Error(malformedMessage);
    throw error;
  }
};

export const serviceErrorMessage = (error, service) => {
  if (error?.name === 'TimeoutError') return `The ${service} service took too long to respond. Please try again.`;
  if (error instanceof TypeError) return `The ${service} service could not be reached. Check your connection and try again.`;
  return error?.message || `The ${service} request failed. Please try again.`;
};
