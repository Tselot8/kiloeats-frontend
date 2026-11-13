import { isValidEmail } from './validation.js';

export const PROFILE_FIELDS = [
  { key: 'name', label: 'Restaurant name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'openingHours', label: 'Opening hours', type: 'text' },
  { key: 'cuisineType', label: 'Cuisine type', type: 'text' },
];

export const profileValues = (profile) => Object.fromEntries(PROFILE_FIELDS.map(({ key }) => [
  key, typeof profile?.[key] === 'string' ? profile[key].trim() : '',
]));

export const parseRestaurantProfile = (data) => {
  if (data === null) return null;
  const unreadable = () => new Error('The profile service returned unreadable restaurant details. Please refresh the profile.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw unreadable();
  const hasFlatFields = PROFILE_FIELDS.some(({ key }) => Object.hasOwn(data, key));
  if (!hasFlatFields && Object.keys(data).some((key) => key !== 'id')) throw unreadable();
  if (data.id != null && !((typeof data.id === 'number' && Number.isSafeInteger(data.id)) || (typeof data.id === 'string' && data.id.trim()))) throw unreadable();
  if (PROFILE_FIELDS.some(({ key }) => data[key] != null && typeof data[key] !== 'string')) throw unreadable();
  const values = profileValues(data);
  if (Object.values(values).every((value) => !value)) return null;
  return { ...(data.id != null ? { id: data.id } : {}), ...values };
};

export const validateProfileFields = (values) => {
  const normalized = profileValues(values);
  const errors = {};
  for (const { key, label } of PROFILE_FIELDS) {
    if (!normalized[key]) errors[key] = `Enter the ${label.toLowerCase()}.`;
  }
  if (normalized.email && !isValidEmail(normalized.email)) errors.email = 'Enter a valid email address.';
  return errors;
};
