import { useState } from 'react';
import { appConfig } from '../config.js';
import { navigate } from '../hooks/useHashRoute.js';
import { createAndSaveRecord, type WolfAppState } from '../hooks/useWolfApp.js';

/**
 * Launch and record library screen (DESIGN.md 10.1).
 *
 * In single-pack mode the bundled pack's title is emphasized and a one-tap
 * continue/create action is primary. In platform mode the AXM Wolf title is
 * shown with the full record library and pack list.
 */
export function LaunchScreen({ db, packs, records, refreshRecords }: WolfAppState): JSX.Element {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isSinglePack = appConfig.deployMode === 'single-pack';
  const defaultPackId = appConfig.defaultPackId;

  const primaryPack = isSinglePack
    ? packs.find((p) => p.packId === defaultPackId) ?? packs[0]
    : undefined;

  const title = isSinglePack && primaryPack ? primaryPack.pack.title : 'AXM Wolf';
  const subtitle = isSinglePack && primaryPack ? primaryPack.pack.subtitle : null;

  const mostRecent = records[0];

  async function handleCreateRecord(packId: string): Promise<void> {
    if (!db) return;
    const storedPack = packs.find((p) => p.packId === packId);
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
      <section>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
        {!isSinglePack ? (
          <p className="muted">
            A local-first place to capture institutional knowledge, one answer at a time.
          </p>
        ) : null}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="continue-heading">
        <h2 id="continue-heading">Continue</h2>
        {mostRecent ? (
          <p>
            <a className="btn" href={`#/record/${encodeURIComponent(mostRecent.recordId)}`}>
              Continue &ldquo;{mostRecent.title}&rdquo;
            </a>
          </p>
        ) : (
          <p className="muted">No records yet. Create one below to get started.</p>
        )}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="create-heading">
        <h2 id="create-heading">Create a record</h2>
        <div className="row">
          {packs.map((storedPack) => (
            <button
              key={storedPack.packId}
              type="button"
              className="btn"
              disabled={creating || !db}
              onClick={() => handleCreateRecord(storedPack.packId)}
            >
              {creating ? 'Creating…' : `New record from ${storedPack.pack.title}`}
            </button>
          ))}
        </div>
        {createError ? (
          <p role="alert" className="notice">
            {createError}
          </p>
        ) : null}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="import-heading">
        <h2 id="import-heading">Import a record</h2>
        <button type="button" className="btn btn--secondary" disabled aria-disabled="true">
          Import record (coming in wave 2)
        </button>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="packs-heading">
        <h2 id="packs-heading">Installed packs</h2>
        <ul className="card-list">
          {packs.map((storedPack) => {
            const sectionCount = storedPack.pack.sections.length;
            const promptCount = storedPack.pack.prompts.length;
            return (
              <li key={storedPack.packId} className="card">
                <h3>{storedPack.pack.title}</h3>
                {storedPack.pack.subtitle ? <p className="muted">{storedPack.pack.subtitle}</p> : null}
                <p className="meta">
                  {sectionCount} section{sectionCount === 1 ? '' : 's'} &middot; {promptCount} prompt
                  {promptCount === 1 ? '' : 's'} &middot; version {storedPack.pack.packVersion} &middot; trust:{' '}
                  {storedPack.trust}
                </p>
              </li>
            );
          })}
        </ul>
        <p>
          <a className="btn btn--secondary" href="#/packs">
            Manage packs
          </a>
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="install-heading">
        <h2 id="install-heading">Install this app</h2>
        <button type="button" className="btn btn--secondary" disabled aria-disabled="true">
          Install app (coming in wave 3)
        </button>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="data-heading">
        <h2 id="data-heading">Your data</h2>
        <p className="notice">
          Responses are stored only in this browser, on this device. Nothing is uploaded. Exporting a
          record is the backup mechanism &mdash; use the export screen to save a copy elsewhere.
        </p>
      </section>
    </div>
  );
}
