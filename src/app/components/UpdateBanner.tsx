import type { ServiceWorkerUpdateState } from '../hooks/useServiceWorkerUpdate.js';

/**
 * Service-worker update banner (DESIGN.md 11.2).
 *
 * Shown only once a new service worker is installed and waiting. Reload is
 * always user-initiated -- drafts autosave continuously (DESIGN.md 8.2), so
 * clicking "Reload" cannot lose unsaved work.
 */
export function UpdateBanner({ updateAvailable, applyUpdate }: ServiceWorkerUpdateState): JSX.Element | null {
  if (!updateAvailable) return null;

  return (
    <div className="notice update-banner" role="status">
      <p>
        <strong>Update available.</strong> A new version of AXM Wolf is ready.
      </p>
      <button type="button" className="btn btn--secondary" onClick={applyUpdate}>
        Reload to update
      </button>
    </div>
  );
}
