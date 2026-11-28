import { useCallback, useEffect, useState } from 'react';

// A failed refresh keeps its last validated snapshot; a different owner/ref
// never receives it, including the render before the next effect starts.
export const useStudentOrders = (client, identity, reference = null) => {
  const scope = JSON.stringify([identity.user.id, reference]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setResult((previous) => ({ ...(previous?.scope === scope ? previous : { scope, data: null, updatedAt: 0, missing: false }), loading: true, error: '' }));
    const read = reference === null ? client.list(identity, { signal: controller.signal }) : client.read(identity, reference, { signal: controller.signal });
    read.then((data) => {
      if (!controller.signal.aborted) setResult({ scope, data, missing: reference !== null && data === null, loading: false, error: '', updatedAt: Date.now() });
    }).catch((failure) => {
      if (!controller.signal.aborted) setResult((previous) => ({ ...previous, loading: false,
        error: failure?.code === 'MALFORMED' ? failure.message : 'Demo orders could not be refreshed. Any previously loaded details are kept. Please try the read again.' }));
    });
    return () => controller.abort();
  }, [client, identity, reference, scope, attempt]);
  return { ...(result?.scope === scope ? result : { data: null, loading: true, error: '', missing: false, updatedAt: 0 }), refresh };
};
