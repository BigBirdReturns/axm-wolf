import { useEffect, useState } from 'react';
import { appConfig, APP_VERSION } from '../config.js';
import { openWolfDb, type WolfDb } from '../../storage/index.js';
import { clearAllData } from '../../storage/maintenance.js';
import '../styles/data.css';

const CONFIRM_PHRASE = 'delete everything';

/**
 * Settings screen (DESIGN.md 10.1, 12.1, 12.4). States the local-first
 * storage model plainly, reports the app version and deploy mode, and
 * provides a wipe-all action that clears every IndexedDB store.
 *
 * App.tsx renders `<SettingsScreen />` with no props (it is a shared call
 * site that is off-limits for this change), so this screen opens its own
 * `WolfDb` handle in an effect rather than receiving one via props. This is
 * self-contained: the wipe-all action only needs a db handle long enough to
 * run `clearAllData`, after which the page reloads and `useWolfApp`
 * re-bootstraps (reinstalling the bundled pack) against a fresh connection.
 */
export function SettingsScreen(): JSX.Element {
  const [db, setDb] = useState<WolfDb | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  const [confirmInput, setConfirmInput] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const wolfDb = await openWolfDb();
        if (cancelled) return;
        setDb(wolfDb);
      } catch (err) {
        if (cancelled) return;
        setDbError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmed = acknowledged && confirmInput.trim().toLowerCase() === CONFIRM_PHRASE;

  async function handleWipeAll(): Promise<void> {
    if (!db || !confirmed) return;
    setWipeError(null);
    setWiping(true);
    try {
      await clearAllData(db);
      db.close();
      // Reload at the app root so useWolfApp re-bootstraps: reopens the
      // database, reinstalls the bundled pack, and shows an empty record
      // list.
      window.location.assign('#/');
      window.location.reload();
    } catch (err) {
      setWipeError(err instanceof Error ? err.message : String(err));
      setWiping(false);
    }
  }

  return (
    <div className="stack">
      <h1>Settings</h1>

      <section aria-labelledby="data-heading">
        <h2 id="data-heading">Your data</h2>
        <p className="notice">
          Responses are stored only in this browser profile, on this device. Clearing browser data
          (or this site&rsquo;s storage) removes a local record permanently &mdash; and the browser
          itself may evict stored data under storage pressure, without asking first. Exporting a
          record is the backup and transfer mechanism &mdash; no server receives your testimony in
          v0.1.
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="about-heading">
        <h2 id="about-heading">About this app</h2>
        <p className="meta">
          <span className="field-chip">version {APP_VERSION}</span>
          <span className="field-chip">deploy mode: {appConfig.deployMode}</span>
          {appConfig.deployMode === 'single-pack' && appConfig.defaultPackId ? (
            <span className="field-chip">default pack: {appConfig.defaultPackId}</span>
          ) : null}
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="danger-heading" className="danger-zone">
        <h2 id="danger-heading">Danger: delete all local data</h2>
        <p className="notice">
          This permanently erases every installed pack, record, response, draft, and setting stored in
          this browser profile. Export any records you want to keep first &mdash; export is the only
          backup mechanism, and this action cannot be undone.
        </p>

        <div className="checkbox-row">
          <input
            id="wipe-ack"
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <label htmlFor="wipe-ack">I have exported anything I want to keep, and understand this cannot be undone</label>
        </div>

        <label htmlFor="wipe-confirm">
          Type &ldquo;{CONFIRM_PHRASE}&rdquo; to confirm
        </label>
        <input
          id="wipe-confirm"
          type="text"
          value={confirmInput}
          onChange={(event) => setConfirmInput(event.target.value)}
          aria-describedby="wipe-confirm-help"
        />
        <p id="wipe-confirm-help" className="meta">
          This unlocks the delete button below. The phrase is case-insensitive.
        </p>

        <button type="button" className="btn" disabled={!confirmed || !db || wiping} onClick={handleWipeAll}>
          {wiping ? 'Deleting everything…' : 'Delete all local data'}
        </button>

        {dbError ? (
          <p role="alert" className="notice">
            Could not open the local database: {dbError}
          </p>
        ) : null}

        {wipeError ? (
          <p role="alert" className="notice">
            {wipeError}
          </p>
        ) : null}

        {wiping ? (
          <p role="status" className="meta">
            Deleting all local data and reloading&hellip;
          </p>
        ) : null}
      </section>
    </div>
  );
}
