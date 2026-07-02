// Persistent-storage request (docs/DURABILITY.md, gap G1).
//
// By default the AXMWolf IndexedDB database is "best-effort" storage: the
// browser may evict it under storage pressure without asking. The Storage
// API's `navigator.storage.persist()` asks the browser to exempt this
// origin from automatic eviction. Chromium grants it silently based on
// engagement/install heuristics; Firefox may show a permission prompt --
// which is why this is requested only once testimony actually exists (a
// record was created or found), never on a cold first visit.
//
// A denied or unsupported result is not an error: it means exports remain
// the only durable copy, and the UI says so (DESIGN.md 12.1, 12.2).

export type PersistenceState = 'persistent' | 'best-effort' | 'unsupported';

type StorageManagerLike = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
};

type NavigatorLike = { storage?: StorageManagerLike };

function resolveStorage(nav?: NavigatorLike): StorageManagerLike | null {
  const n = nav ?? (globalThis as { navigator?: NavigatorLike }).navigator;
  const storage = n?.storage;
  if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') {
    return null;
  }
  return storage;
}

/**
 * Reports the current persistence state without prompting or requesting
 * anything.
 */
export async function getPersistenceState(nav?: NavigatorLike): Promise<PersistenceState> {
  const storage = resolveStorage(nav);
  if (!storage) return 'unsupported';
  try {
    return (await storage.persisted!()) ? 'persistent' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

/**
 * Requests persistent storage for this origin, returning the resulting
 * state. Idempotent: if persistence is already granted, no new request is
 * made. Never throws -- a failed or rejected request degrades to
 * 'best-effort'.
 */
export async function requestPersistentStorage(nav?: NavigatorLike): Promise<PersistenceState> {
  const storage = resolveStorage(nav);
  if (!storage) return 'unsupported';
  try {
    if (await storage.persisted!()) return 'persistent';
    return (await storage.persist!()) ? 'persistent' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}
