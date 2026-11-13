import { DEMO_RESTAURANTS } from '../data/demoRestaurants.js';

export const CAMPUSES = Object.freeze([
  { id: 'aau-4k', name: 'AAU 4K' },
  { id: 'aau-5k', name: 'AAU 5K' },
  { id: 'aau-6k', name: 'AAU 6K' },
  { id: 'yared-music-school', name: 'Yared Music School' },
].map(Object.freeze));

export const findCampus = (id) => CAMPUSES.find((campus) => campus.id === id) || null;
export const browsePath = (campusId) => findCampus(campusId) ? `/browse?campus=${encodeURIComponent(campusId)}` : '/browse';
export const restaurantPath = (id, campusId) => `/restaurant/${encodeURIComponent(id)}${findCampus(campusId) ? `?campus=${encodeURIComponent(campusId)}` : ''}`;

const summary = ({ id, name, description, image, campusIds }) => ({ id, name, description, image, campusIds });
const snapshot = async (value, signal) => {
  signal?.throwIfAborted();
  // An asynchronous read boundary without simulated delays or a query/storage
  // switch. A future service can replace this implementation.
  await Promise.resolve();
  signal?.throwIfAborted();
  return structuredClone(value);
};

export const createDemoBrowsingService = (catalog = DEMO_RESTAURANTS) => ({
  async listRestaurants(campusId, { signal } = {}) {
    if (!findCampus(campusId)) throw new Error('Choose a supported campus to browse restaurants.');
    return snapshot(catalog.filter((restaurant) => restaurant.campusIds.includes(campusId)).map(summary), signal);
  },
  async getRestaurantMenu(id, campusId, { signal } = {}) {
    signal?.throwIfAborted();
    const restaurant = catalog.find((entry) => entry.id === id);
    if (!restaurant) {
      const error = new Error('This demo restaurant could not be found.');
      error.code = 'RESTAURANT_NOT_FOUND';
      throw error;
    }
    const campus = findCampus(campusId);
    const state = !campusId ? 'choose-campus'
      : !campus ? 'invalid-campus'
        : !restaurant.campusIds.includes(campus.id) ? 'unsupported-campus'
          : !restaurant.menuAvailable ? 'unavailable' : 'ready';
    return snapshot({ restaurant: summary(restaurant), campus, state, items: state === 'ready' ? restaurant.items : [] }, signal);
  },
});

// Read-only and independent of VITE_API_BASE_URL, merchant data, and auth.
export const studentBrowsing = createDemoBrowsingService();
