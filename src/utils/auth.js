import { isValidEmail } from './validation.js';

// No usable registration/login/session contract is supplied by this repository.
// Normal routes always use this unavailable adapter. No endpoint is guessed.
export const AUTH_SERVICE = Object.freeze({ available: false });

const text = (value) => typeof value === 'string' ? value.trim() : '';
const passwordValue = (value) => typeof value === 'string' ? value : '';

export const validateAuthFields = (mode, values = {}) => {
  if (!['signup', 'login'].includes(mode)) throw new Error('Unsupported authentication form.');
  const errors = {};
  if (mode === 'signup' && !text(values.name)) errors.name = 'Enter your name.';
  if (!text(values.email)) errors.email = 'Enter your email address.';
  else if (!isValidEmail(values.email)) errors.email = 'Enter a valid email address.';
  if (mode === 'signup') {
    if (!text(values.phone)) errors.phone = 'Enter your phone number.';
    if (!['Customer', 'Restaurant Owner'].includes(values.role)) errors.role = 'Choose Customer or Restaurant owner.';
  }
  if (!passwordValue(values.password)) errors.password = 'Enter your password.';
  if (mode === 'signup') {
    if (!passwordValue(values.confirmPassword)) errors.confirmPassword = 'Confirm your password.';
    else if (values.password !== values.confirmPassword) errors.confirmPassword = 'The passwords do not match.';
  }
  return errors;
};

// These are frontend adapter inputs, not a claim about an undocumented API.
export const buildAuthPayload = (mode, values) => {
  if (Object.keys(validateAuthFields(mode, values)).length) throw new Error('Check the required authentication fields.');
  const credentials = { email: text(values.email), password: values.password };
  return mode === 'signup'
    ? { name: text(values.name), ...credentials, phone: text(values.phone), role: values.role }
    : credentials;
};

export const submitAuth = async (mode, values, service = AUTH_SERVICE) => {
  if (service.available !== true) return { state: 'unavailable' };
  try {
    // A supplied adapter must implement its own confirmed backend contract.
    // The only available adapter today is an isolated test fixture.
    await service.submit(mode, buildAuthPayload(mode, values));
    return { state: 'success' };
  } catch {
    // Never render/log arbitrary errors that might echo credentials.
    return { state: 'error' };
  }
};
