import { useEffect, useState } from 'react';
import { appConfig, APP_VERSION } from '../config.js';
import { exportKnowledgeArchive, importKnowledgeArchive, openWolfDb, type WolfDb } from '../../storage/index.js';
import { clearAllData } from '../../storage/maintenance.js';
import { downloadText } from '../lib/download.js';
import '../styles/data.css';

const CONFIRM_PHRASE = 'delete everything';

/**
 * Settings screen (DESIGN.md 10.1, 12.1, 12.4). States the local-first
 * storage model, reports the app version and deploy mode, and provides a
 * wipe-all action that clears every IndexedDB store.
 */
export function SettingsScreen(): JSX.Element {
  const [db, setDb] = useState<WolfDb | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  const [confirmInput, setConfirmInput] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [knowledgeStatus, setKnowledgeStatus] = useState<string | null>(null);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

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
      // Reload at the app root so useWolfApp re-bootstraps, reopens the
      // database, reinstalls the bundled pack, and shows an empty record list.
      window.location.assign('#/');
      window.location.reload();
    } catch (err) {
      setWipeError(err instanceof Error ? err.message : String(err));
      setWiping(false);
    }
  }

  async function handleKnowledgeExport(): Promise<void> {
    if (!db) return;
    setKnowledgeError(null);
    try {
      const archive = await exportKnowledgeArchive(db);
      const date = archive.exportedAt.slice(0, 10);
      downloadText(`wolf-knowledge-${date}.wolfkb.json`, 'application/json', JSON.stringify(archive, null, 2));
      setKnowledgeStatus(`Exported ${archive.drops.length} knowledge details and ${archive.events.length} review events.`);
    } catch (err) {
      setKnowledgeStatus(null);
      setKnowledgeError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleKnowledgeRestore(file: File | undefined): Promise<void> {
    if (!db || !file) return;
    setKnowledgeError(null);
    try {
      const archive = await importKnowledgeArchive(db, await file.text());
      setKnowledgeStatus(`Restored ${archive.drops.length} knowledge details and ${archive.events.length} review events.`);
    } catch (err) {
      setKnowledgeStatus(null);
      setKnowledgeError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack">
      <h1>Settings</h1>

      <section aria-labelledby="data-heading">
        <h2 id="data-heading">Your data</h2>
        <p className="notice">
          Testimony records, drafts, WOLF Ops cases, and operational media are stored only in this
          browser profile on this device. Clearing browser data may remove them permanently. A testimony
          record export backs up that record, but it does not yet back up WOLF Ops photographs, videos,
          or inspection state. No server receives this data.
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="knowledge-backup-heading" className="stack">
        <h2 id="knowledge-backup-heading">Knowledge backup</h2>
        <p>
          Knowledge details are private, source-linked notes derived from saved testimony. Export them separately as
          a <code>.wolfkb.json</code> custody archive. To restore on another device, import the source
          <code>.wolfrecord.json</code> records first, then restore this knowledge backup.
        </p>
        <p className="notice">Knowledge backups are not encrypted. Store and send them as carefully as the testimony they cite.</p>
        <div className="row">
          <button type="button" className="btn btn--secondary" disabled={!db} onClick={() => void handleKnowledgeExport()}>
            Export knowledge backup
          </button>
          <label className="btn btn--secondary" htmlFor="knowledge-restore">Restore knowledge backup</label>
          <input
            id="knowledge-restore"
            type="file"
            accept=".json,.wolfkb.json,application/json"
            onChange={(event) => void handleKnowledgeRestore(event.currentTarget.files?.[0])}
          />
        </div>
        {knowledgeStatus ? <p role="status" className="meta">{knowledgeStatus}</p> : null}
        {knowledgeError ? <p role="alert" className="notice">Knowledge backup failed: {knowledgeError}</p> : null}
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
          This permanently erases every installed pack, testimony record, response, draft, setting,
          WOLF Ops inspection, knowledge detail, review event, and locally stored evidence artifact in this browser profile. Export any
          testimony records you want to keep first. Operational cases and media do not yet have a
          portable backup, and this action cannot be undone.
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
