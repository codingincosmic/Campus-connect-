/**
 * Small data-fetching hook, so every page doesn't repeat the same
 * loading / error / reload boilerplate.
 *
 *   const { data, loading, error, reload } = useAsyncData(
 *     () => api.get('/classes'),
 *     []                       // re-runs when these change
 *   );
 *
 * `reload()` re-fetches after a mutation (create/update/delete).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsyncData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Keep the latest fetcher without making it a dependency, which would
  // re-run the effect on every render (the caller usually passes an inline
  // arrow function, which is a new reference each time).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  /** Bumped by reload() to re-trigger the effect. */
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve(fetcherRef.current())
      .then((result) => {
        // Guard against a slow response landing after the component unmounted
        // or after newer arguments made this result stale.
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload, setData };
}
