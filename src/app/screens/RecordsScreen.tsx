import { createAndSaveRecord, type WolfAppState } from '../hooks/useWolfApp.js';
import { navigate } from '../hooks/useHashRoute.js';
import { useState } from 'react';
import '../styles/data.css';

/**
 * Full record library (DESIGN.md 10.1, 8.4 step 9). Lists every stored
 * record with its status and pack, links to each record's home, offers a
 * "new record" shortcut for the bundled pack, and surfaces the legacy
 * migration summary (if a migration ran during this session).
 */
export function RecordsScreen({ db, packs, records, refreshRecords, migrationSummary }: WolfAppState): JSX.Element {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleNewRecord(): Promise<void> {
    if (!db) return;
    const storedPack = packs[0];
    if (!storedPack) return;

    setCreating(true);
    setCreateError(null);
    try {
      const recordId = await createAndSaveRecord(db, storedPack, refreshRecords);
      navigate(`#/record/${encodeURIComponent(recordId)}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="stack">
      <h1>Records</h1>

      {migrationSummary ? (
        <p className="notice" role="status">
          Migrated {migrationSummary.migrated} legacy answer
          {migrationSummary.migrated === 1 ? '' : 's'} into &ldquo;
          {packs[0]?.pack.title ?? 'The Wolf&rsquo;s Deposition'}&rdquo;.
          {migrationSummary.skippedUnknown > 0
            ? ` ${migrationSummary.skippedUnknown} legacy answer${
                migrationSummary.skippedUnknown === 1 ? '' : 's'
              } could not be matched and were skipped.`
            : ''}
        </p>
      ) : null}

      <hr className="section-rule" />

      <section aria-labelledby="library-heading">
        <h2 id="library-heading">Your records</h2>

        {records.length === 0 ? (
          <p className="muted">
            No records yet. <a href="#/">Create one from the launch screen</a> to get started.
          </p>
        ) : (
          <ul className="card-list">
            {records.map((record) => (
              <li key={record.recordId} className="card">
                <a className="card-link" href={`#/record/${encodeURIComponent(record.recordId)}`}>
                  <h3>{record.title}</h3>
                </a>
                <p className="meta">
                  <span className="field-chip">{record.status}</span>
                  <span className="field-chip">pack: {record.packId}</span>
                  <span className="field-chip">updated {record.updatedAt}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="new-record-heading">
        <h2 id="new-record-heading">New record</h2>
        <p>
          <button type="button" className="btn" disabled={creating || !db || packs.length === 0} onClick={handleNewRecord}>
            {creating ? 'Creating…' : 'New record'}
          </button>
        </p>
        {createError ? (
          <p role="alert" className="notice">
            {createError}
          </p>
        ) : null}
        <p className="muted">
          {records[0] ? (
            <>
              To import a record from a file, open{' '}
              <a href={`#/record/${encodeURIComponent(records[0].recordId)}/export`}>
                &ldquo;{records[0].title}&rdquo;&rsquo;s export and data screen
              </a>{' '}
              and use the import action there &mdash; importing there can replace or copy onto any
              record.
            </>
          ) : (
            'Importing a record from a file is available from any record&rsquo;s export and data screen.'
          )}
        </p>
      </section>
    </div>
  );
}
