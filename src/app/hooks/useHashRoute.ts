import { useEffect, useState } from 'react';
import { parseRoute, type Route } from '../routes.js';

/**
 * Subscribes to `window.location.hash` changes and returns the currently
 * parsed `Route`. A refresh on any hash route works for free because the
 * server always serves the same `index.html` and the hash is preserved.
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromLocation());

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

function routeFromLocation(): Route {
  if (window.location.hash.startsWith('#/')) return parseRoute(window.location.hash);
  if (/\/wolf\/dashboard\/?$/i.test(window.location.pathname)) return { name: 'records' };
  const hosted = window.location.pathname.match(/\/wolf\/(SUR\d+)\/?$/i);
  if (hosted?.[1]) return { name: 'hosted-survey', code: hosted[1].toUpperCase() };
  return parseRoute(window.location.hash);
}

/** Navigates to a hash, pushing a new history entry. */
export function navigate(hash: string): void {
  window.location.hash = hash;
}
