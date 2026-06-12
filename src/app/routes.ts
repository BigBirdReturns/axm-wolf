// Hash-based route parsing for AXM Wolf (DESIGN.md 9.3).
//
// Pure functions only -- no React, no DOM globals -- so this module can be
// unit-tested under the node:test pipeline without JSX support.

export type Route =
  | { name: 'launch' }
  | { name: 'records' }
  | { name: 'record'; recordId: string }
  | { name: 'record-section'; recordId: string; sectionId: string }
  | { name: 'record-prompt'; recordId: string; promptId: string }
  | { name: 'record-search'; recordId: string }
  | { name: 'record-export'; recordId: string }
  | { name: 'packs' }
  | { name: 'settings' }
  | { name: 'not-found'; path: string };

/**
 * Parses a location hash (e.g. `#/records`, `#/record/abc/section/early`)
 * into a `Route`. The leading `#` is optional; a missing or empty hash
 * (and bare `#`, `#/`) resolves to the launch route.
 */
export function parseRoute(hash: string): Route {
  let path = hash.startsWith('#') ? hash.slice(1) : hash;

  // Strip query string / fragment-of-fragment, if any.
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) path = path.slice(0, queryIndex);

  // Normalize: ensure leading slash, drop trailing slash (except root).
  if (path === '' || path === '/') return { name: 'launch' };
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  const segments = path.split('/').filter((s) => s.length > 0).map(decodeURIComponent);

  if (segments.length === 1 && segments[0] === 'records') {
    return { name: 'records' };
  }

  if (segments.length === 1 && segments[0] === 'packs') {
    return { name: 'packs' };
  }

  if (segments.length === 1 && segments[0] === 'settings') {
    return { name: 'settings' };
  }

  if (segments[0] === 'record' && segments.length >= 2) {
    const recordId = segments[1];
    if (recordId.length === 0) return { name: 'not-found', path };

    if (segments.length === 2) {
      return { name: 'record', recordId };
    }

    if (segments.length === 3 && segments[2] === 'search') {
      return { name: 'record-search', recordId };
    }

    if (segments.length === 3 && segments[2] === 'export') {
      return { name: 'record-export', recordId };
    }

    if (segments.length === 4 && segments[2] === 'section') {
      const sectionId = segments[3];
      if (sectionId.length === 0) return { name: 'not-found', path };
      return { name: 'record-section', recordId, sectionId };
    }

    if (segments.length === 4 && segments[2] === 'prompt') {
      const promptId = segments[3];
      if (promptId.length === 0) return { name: 'not-found', path };
      return { name: 'record-prompt', recordId, promptId };
    }
  }

  return { name: 'not-found', path };
}

/**
 * Builds a location hash (including leading `#`) for a given `Route`.
 * Inverse of `parseRoute` for all routes except `not-found`.
 */
export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'launch':
      return '#/';
    case 'records':
      return '#/records';
    case 'record':
      return `#/record/${encodeURIComponent(route.recordId)}`;
    case 'record-section':
      return `#/record/${encodeURIComponent(route.recordId)}/section/${encodeURIComponent(route.sectionId)}`;
    case 'record-prompt':
      return `#/record/${encodeURIComponent(route.recordId)}/prompt/${encodeURIComponent(route.promptId)}`;
    case 'record-search':
      return `#/record/${encodeURIComponent(route.recordId)}/search`;
    case 'record-export':
      return `#/record/${encodeURIComponent(route.recordId)}/export`;
    case 'packs':
      return '#/packs';
    case 'settings':
      return '#/settings';
    case 'not-found':
      return `#${route.path}`;
  }
}
