import { useEffect, useState } from 'react';
import { parseRoute, type Route } from '../routes.js';

/**
 * Subscribes to `window.location.hash` changes and returns the currently
 * parsed `Route`. A refresh on any hash route works for free because the
 * server always serves the same `index.html` and the hash is preserved.
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

/** Navigates to a hash, pushing a new history entry. */
export function navigate(hash: string): void {
  window.location.hash = hash;
}
