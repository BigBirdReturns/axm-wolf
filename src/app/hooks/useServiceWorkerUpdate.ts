import { useEffect, useRef, useState } from 'react';

/**
 * Service-worker update flow (DESIGN.md 11.2).
 *
 * Activation must be user-controlled: this hook never reloads the page on
 * its own. Drafts autosave continuously (DESIGN.md 8.2), so reloading after
 * the user explicitly clicks "Reload" is safe -- any in-progress draft has
 * already been persisted to IndexedDB.
 *
 * The `virtual:pwa-register` module only exists in the Vite app build (it is
 * injected by vite-plugin-pwa). The Node test build (tsconfig.test.json)
 * compiles this file too, so the import is loaded dynamically behind a
 * runtime guard and wrapped in try/catch -- under `node --test` the module
 * specifier is never resolved, and `import.meta.env`/`window` are absent.
 */
export type ServiceWorkerUpdateState = {
  /** A new service worker is installed and waiting to activate. */
  updateAvailable: boolean;
  /** The app is ready to work offline (first install only). */
  offlineReady: boolean;
  /** Activates the waiting service worker and reloads the page. */
  applyUpdate: () => void;
};

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateSwRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // import.meta.env is only meaningful under Vite; guard for Node tests.
    const env = (import.meta as unknown as { env?: { PROD?: boolean } }).env;
    if (!env) return;

    let cancelled = false;

    (async () => {
      try {
        // Dynamic + string-concatenated to avoid a static resolution attempt
        // by `tsc` under tsconfig.test.json, where the virtual module and
        // its ambient types are not present.
        const specifier = 'virtual:pwa-register';
        const mod: unknown = await import(/* @vite-ignore */ specifier);
        if (cancelled || !mod || typeof mod !== 'object') return;

        type RegisterSW = (options?: {
          immediate?: boolean;
          onNeedRefresh?: () => void;
          onOfflineReady?: () => void;
        }) => (reload?: boolean) => Promise<void>;

        const registerSW = (mod as { registerSW?: RegisterSW }).registerSW;
        if (typeof registerSW !== 'function') return;

        const update = registerSW({
          immediate: true,
          onNeedRefresh() {
            if (!cancelled) setUpdateAvailable(true);
          },
          onOfflineReady() {
            if (!cancelled) setOfflineReady(true);
          },
        });
        updateSwRef.current = update;
      } catch {
        // No service worker support, dev mode, or the virtual module is
        // unavailable (e.g. under `node --test`). Updates simply stay
        // unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function applyUpdate(): void {
    // User-controlled activation only (DESIGN.md 11.2) -- never called
    // automatically.
    void updateSwRef.current?.(true);
  }

  return { updateAvailable, offlineReady, applyUpdate };
}
