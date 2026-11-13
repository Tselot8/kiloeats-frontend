import { useEffect, useState } from 'react';
import { findCampus, studentBrowsing } from '../utils/studentBrowsing.js';

export const useStudentBrowsing = (kind, campusId, restaurantId, service = studentBrowsing) => {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const enabled = kind === 'menu' || Boolean(findCampus(campusId));
  const key = JSON.stringify([kind, campusId, restaurantId, attempt]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setResult({ key, status: 'loading' });
    const load = async () => {
      try {
        const data = kind === 'menu'
          ? await service.getRestaurantMenu(restaurantId, campusId, { signal: controller.signal })
          : await service.listRestaurants(campusId, { signal: controller.signal });
        if (!controller.signal.aborted) setResult({ key, status: 'ready', data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, status: 'error', notFound: error?.code === 'RESTAURANT_NOT_FOUND' });
      }
    };
    load();
    return () => controller.abort();
  }, [kind, campusId, restaurantId, service, key, enabled]);

  // A changed URL must never briefly show the previous campus/restaurant data.
  return {
    ...(enabled ? result?.key === key ? result : { status: 'loading' } : { status: 'idle' }),
    retry: () => setAttempt((previous) => previous + 1),
  };
};
