import { useEffect, useState } from 'react';
import {
  loadRecord,
  saveRecord,
  deleteRecord,
  listRecords,
  requestPersistentStorage,
  type PersistenceState,
  type WolfDb,
} from '../../storage/index.js';
import {
  buildRecordBundle,
  importRecordBundle,
  renderMarkdown,
  renderPlainText,
  sanitizeFilename,
  WolfValidationError,
  type WolfRecord,
} from '../../engine/index.js';
import { downloadText } from '../lib/download.js';
import { bundleToRecord, makeImportCopy } from '../lib/import.js';
import '../styles/data.css';

export type ExportScreenProps = {
  db: WolfDb;
  recordId: string;
  onNavigate: (hash: string) => void;
  onRecordDeleted: () => void;
};

type ConflictState = {
  incoming: WolfRecord;
};

/**
 * Export and data view (DESIGN.md 10.1, 6.4, 12). Provides JSON/Markdown/
 * plain-text export, record import with conflict handling, archive toggle,
 * delete-with-confirmation, and the local-first storage notice.
 */
export function ExportScreen({ db, recordId, onNavigate, onRecordDeleted }: ExportScreenProps): JSX.Element {
  const [record, setRecord] = useState<WolfRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [includeRevisionHistory, setIncludeRevisionHistory] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const [deleteTitleInput, setDeleteTitleInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [persistence, setPersistence] = useState<PersistenceState | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A record is open, so testimony exists: request persistence (idempotent)
    // and show the honest answer (docs/DURABILITY.md G1, G4).
    void requestPersistentStorage().then((state) => {
      if (!cancelled) setPersistence(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRecord(): Promise<void> {
    const loaded = await loadRecord(db, recordId);
    setRecord(loaded);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadRecord(db, recordId);
        if (cancelled) return;
        setRecord(loaded);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, recordId]);

  async function markExported(): Promise<void> {
    const current = await loadRecord(db, recordId);
    if (!current) return;
    const updated: WolfRecord = { ...current, lastExportedAt: new Date().toISOString() };
    await saveRecord(db, updated);
    setRecord(updated);
  }

  async function handleExportBundle(): Promise<void> {
    if (!record) return;
    setExportError(null);
    try {
      const bundle = buildRecordBundle(record, { includeDrafts });
      const filename = `${sanitizeFilename(record.title)}.wolfrecord.json`;
      downloadText(filename, 'application/json', JSON.stringify(bundle, null, 2));
      await markExported();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleExportMarkdown(): Promise<void> {
    if (!record) return;
    setExportError(null);
    try {
      const bundle = buildRecordBundle(record, { includeDrafts });
      const text = renderMarkdown(bundle, { includeRevisionHistory });
      const filename = `${sanitizeFilename(record.title)}.md`;
      downloadText(filename, 'text/markdown', text);
      await markExported();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleExportPlainText(): Promise<void> {
    if (!record) return;
    setExportError(null);
    try {
      const bundle = buildRecordBundle(record, { includeDrafts });
      const text = renderPlainText(bundle, { includeRevisionHistory });
      const filename = `${sanitizeFilename(record.title)}.txt`;
      downloadText(filename, 'text/plain', text);
      await markExported();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    setConflict(null);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new WolfValidationError('That file is not valid JSON.');
      }
      const bundle = importRecordBundle(parsed);
      const incoming = bundleToRecord(bundle);

      const existing = await listRecords(db);
      const conflicting = existing.find((r) => r.recordId === incoming.recordId);
      if (conflicting) {
        setConflict({ incoming });
        return;
      }

      await saveRecord(db, incoming);
      onNavigate(`#/record/${encodeURIComponent(incoming.recordId)}`);
    } catch (err) {
      if (err instanceof WolfValidationError) {
        setImportError(err.message);
      } else {
        setImportError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  async function handleReplaceLocal(): Promise<void> {
    if (!conflict) return;
    try {
      await saveRecord(db, conflict.incoming);
      const target = conflict.incoming.recordId;
      setConflict(null);
      onNavigate(`#/record/${encodeURIComponent(target)}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleImportAsCopy(): Promise<void> {
    if (!conflict) return;
    try {
      const newRecordId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `record-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const copy = makeImportCopy(conflict.incoming, newRecordId);
      await saveRecord(db, copy);
      setConflict(null);
      onNavigate(`#/record/${encodeURIComponent(copy.recordId)}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCancelImport(): void {
    setConflict(null);
  }

  async function handleToggleArchive(): Promise<void> {
    if (!record) return;
    setArchiveError(null);
    try {
      const nextStatus = record.status === 'archived' ? 'active' : 'archived';
      const updated: WolfRecord = { ...record, status: nextStatus, updatedAt: new Date().toISOString() };
      await saveRecord(db, updated);
      setRecord(updated);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!record) return;
    setDeleteError(null);
    try {
      await deleteRecord(db, recordId);
      onRecordDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return <p>Loading…</p>;
  }

  if (loadError || !record) {
    return (
      <p role="alert" className="notice">
        Could not load record: {loadError ?? 'not found'}
      </p>
    );
  }

  const deleteConfirmed = deleteTitleInput === record.title;

  return (
    <div className="stack">
      <h1>Export and data</h1>
      <p className="muted">{record.title}</p>

      <hr className="section-rule" />

      <section aria-labelledby="export-heading">
        <h2 id="export-heading">Export</h2>

        <div className="checkbox-row">
          <input
            id="include-drafts"
            type="checkbox"
            checked={includeDrafts}
            onChange={(event) => setIncludeDrafts(event.target.checked)}
          />
          <label htmlFor="include-drafts">Include drafts in the record bundle</label>
        </div>

        <div className="checkbox-row">
          <input
            id="include-revision-history"
            type="checkbox"
            checked={includeRevisionHistory}
            onChange={(event) => setIncludeRevisionHistory(event.target.checked)}
          />
          <label htmlFor="include-revision-history">Include revision history in Markdown/text exports</label>
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={handleExportBundle}>
            Download Wolf record bundle (.wolfrecord.json)
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleExportMarkdown}>
            Download Markdown (.md)
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleExportPlainText}>
            Download plain text (.txt)
          </button>
        </div>

        {exportError ? (
          <p role="alert" className="notice">
            {exportError}
          </p>
        ) : null}

        <p className="meta">
          Last exported: {record.lastExportedAt ? record.lastExportedAt : 'never'}
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="import-heading">
        <h2 id="import-heading">Import</h2>
        <label htmlFor="import-file">Import a Wolf record bundle (.json)</label>
        <input id="import-file" type="file" accept=".json,application/json" onChange={handleImportFile} />

        {importError ? (
          <p role="alert" className="notice">
            {importError}
          </p>
        ) : null}

        {conflict ? (
          <div className="notice">
            <p>
              A record with this ID already exists locally (&ldquo;{conflict.incoming.title}&rdquo; would
              replace or copy onto an existing record). Choose how to proceed:
            </p>
            <div className="conflict-actions">
              <button type="button" className="btn" onClick={handleReplaceLocal}>
                Replace local record
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleImportAsCopy}>
                Import as copy
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleCancelImport}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="archive-heading">
        <h2 id="archive-heading">Archive</h2>
        <p className="meta">Status: {record.status}</p>
        <button type="button" className="btn btn--secondary" onClick={handleToggleArchive}>
          {record.status === 'archived' ? 'Unarchive record' : 'Archive record'}
        </button>
        {archiveError ? (
          <p role="alert" className="notice">
            {archiveError}
          </p>
        ) : null}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="danger-heading" className="danger-zone">
        <h2 id="danger-heading">Danger zone</h2>
        <p className="notice">
          Deleting this record is permanent. Export a copy first if you want to keep it &mdash; this is the
          only backup mechanism.
        </p>
        <label htmlFor="delete-confirm">
          Type the record title (&ldquo;{record.title}&rdquo;) to confirm deletion
        </label>
        <input
          id="delete-confirm"
          type="text"
          value={deleteTitleInput}
          onChange={(event) => setDeleteTitleInput(event.target.value)}
        />
        <button type="button" className="btn" disabled={!deleteConfirmed} onClick={handleDelete}>
          Delete permanently
        </button>
        {deleteError ? (
          <p role="alert" className="notice">
            {deleteError}
          </p>
        ) : null}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="local-data-heading">
        <h2 id="local-data-heading">Your data</h2>
        <p className="notice">
          Responses are stored only in this browser, on this device. Clearing browser data removes this
          record &mdash; and the browser itself may evict stored data under storage pressure, without
          asking. Exporting a record is the backup and transfer mechanism &mdash; no server receives your
          testimony.
        </p>
        {persistence === 'persistent' ? (
          <p className="notice">
            Storage: <strong>persistent</strong> &mdash; this browser has agreed not to evict this app&rsquo;s
            data automatically. Exports are still the only copy that survives this device.
          </p>
        ) : null}
        {persistence === 'best-effort' ? (
          <p className="notice">
            Storage: <strong>best-effort</strong> &mdash; this browser has not granted persistent storage, so
            it may reclaim this data if the device runs low on space. Export regularly.
          </p>
        ) : null}
        {persistence === 'unsupported' ? (
          <p className="notice">
            Storage: this browser does not report whether stored data is protected from eviction. Treat
            exported files as the only durable copy.
          </p>
        ) : null}
      </section>
    </div>
  );
}
