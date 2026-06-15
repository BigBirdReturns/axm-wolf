import { useState } from 'react';
import { WolfValidationError, sanitizeFilename, type CapturePack } from '../../engine/index.js';
import type { StoredPack, WolfAppState } from '../hooks/useWolfApp.js';
import { downloadText } from '../lib/download.js';
import { parsePackFromText, bundledPackToStoredPack } from '../lib/packImport.js';
import { EXAMPLE_PACKS } from '../lib/examplePacks.js';
import '../styles/data.css';

const TRUST_LABELS: Record<string, string> = {
  bundled: 'bundled',
  imported_unsigned: 'imported, unsigned',
  quarantined: 'quarantined',
};

const TRUST_CLASSES: Record<string, string> = {
  bundled: 'field-chip field-chip--trust-bundled',
  imported_unsigned: 'field-chip field-chip--trust-imported',
  quarantined: 'field-chip field-chip--trust-quarantined',
};

type ConflictState = {
  incoming: CapturePack;
  digest: string;
  existing: StoredPack;
};

/**
 * Installed packs (DESIGN.md 10.1, 9.4). Each stored pack row keeps the full
 * pack body (`StoredPack.pack`, see useWolfApp.ts), so section and prompt
 * counts are derived directly from that snapshot.
 *
 * Also provides pack import (DESIGN.md 4.1, 4.8, 5, 12.3): file selection,
 * validation via parsePackFromText, conflict handling when an incoming
 * packId already exists locally, and a per-row export for installed packs.
 */
export function PacksScreen({ db, packs, refreshPacks }: WolfAppState): JSX.Element {
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImported, setLastImported] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /**
   * Shared install-from-text path used by both the file input and the
   * drag-and-drop zone (DESIGN.md 4.1, 4.8, 12.3): validates the text via
   * parsePackFromText, then either installs the pack directly or surfaces
   * the existing packId conflict flow for the user to resolve.
   */
  async function installFromText(text: string): Promise<void> {
    setImportError(null);
    setLastImported(null);
    setConflict(null);

    try {
      const { pack, digest } = await parsePackFromText(text);

      const existing = packs.find((p) => p.packId === pack.packId);
      if (existing) {
        setConflict({ incoming: pack, digest, existing });
        return;
      }

      if (!db) {
        throw new Error('The local database is not ready yet.');
      }

      const storedPack = bundledPackToStoredPack(pack, digest);
      await db.put('packs', storedPack);
      await refreshPacks();
      setLastImported(pack.packId);
    } catch (err) {
      if (err instanceof WolfValidationError) {
        setImportError(err.message);
      } else {
        setImportError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    await installFromText(text);
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragOver(false);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    setIsDragOver(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length !== 1) return;

    const file = files[0];
    if (!file) return;

    const text = await file.text();
    await installFromText(text);
  }

  /**
   * Installs a curated example pack (EXAMPLE_PACKS). The bundled JSON is
   * still validated through the same parsePackFromText path as a file
   * import -- it is never trusted blindly. Already-installed examples
   * disable the button rather than re-running the conflict flow, since
   * "Installed" is a simpler, equally-correct UX for a curated list.
   */
  async function handleInstallExample(examplePack: unknown): Promise<void> {
    setImportError(null);
    setLastImported(null);
    setConflict(null);

    try {
      const { pack, digest } = await parsePackFromText(JSON.stringify(examplePack));

      if (packs.some((p) => p.packId === pack.packId)) {
        return;
      }

      if (!db) {
        throw new Error('The local database is not ready yet.');
      }

      const storedPack: StoredPack = {
        packId: pack.packId,
        packVersion: pack.packVersion,
        digest,
        trust: 'bundled',
        installedAt: new Date().toISOString(),
        pack,
      };
      await db.put('packs', storedPack);
      await refreshPacks();
      setLastImported(pack.packId);
    } catch (err) {
      if (err instanceof WolfValidationError) {
        setImportError(err.message);
      } else {
        setImportError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  async function handleReplaceInstalled(): Promise<void> {
    if (!conflict || !db) return;
    try {
      const storedPack = bundledPackToStoredPack(conflict.incoming, conflict.digest);
      await db.put('packs', storedPack);
      await refreshPacks();
      setLastImported(storedPack.packId);
      setConflict(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCancelImport(): void {
    setConflict(null);
  }

  function handleExportPack(storedPack: StoredPack): void {
    const filename = `${sanitizeFilename(storedPack.packId)}.wolfpack.json`;
    downloadText(filename, 'application/json', JSON.stringify(storedPack.pack, null, 2));
  }

  return (
    <div className="stack">
      <h1>Packs</h1>

      <section aria-labelledby="import-pack-heading">
        <h2 id="import-pack-heading">Import pack</h2>
        <div
          className={isDragOver ? 'drop-zone drop-zone--active' : 'drop-zone'}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <label htmlFor="import-pack-file">Import a Wolf capture pack (.wolfpack.json)</label>
          <input
            id="import-pack-file"
            type="file"
            accept=".json,.wolfpack.json,application/json"
            onChange={handleImportFile}
          />
          <p className="meta">
            {isDragOver
              ? 'Drop the pack file to import it.'
              : 'Or drag and drop a .wolfpack.json file here.'}
          </p>
        </div>

        {importError ? (
          <p role="alert" className="notice">
            {importError}
          </p>
        ) : null}

        {lastImported ? (
          <p className="meta" role="status">
            Last imported: {lastImported}
          </p>
        ) : null}

        {conflict ? (
          <div className="notice">
            <p>
              A pack with id &ldquo;{conflict.existing.packId}&rdquo; (version {conflict.existing.packVersion}) is
              already installed. The file you selected is version {conflict.incoming.packVersion}. Choose how to
              proceed:
            </p>
            {conflict.existing.trust === 'bundled' ? (
              <p className="notice">
                Replacing this pack will change its trust from &ldquo;bundled&rdquo; to &ldquo;imported,
                unsigned&rdquo;.
              </p>
            ) : null}
            <div className="conflict-actions">
              <button type="button" className="btn" onClick={handleReplaceInstalled}>
                Replace installed pack
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleCancelImport}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="example-packs-heading">
        <h2 id="example-packs-heading">Example packs</h2>
        <p className="muted">
          Curated capture packs that ship with the app. Installing one adds it to your packs below with
          &ldquo;bundled&rdquo; trust.
        </p>
        <ul className="card-list">
          {EXAMPLE_PACKS.map((example) => {
            const exampleAsRecord = example.pack as { packId?: unknown };
            const examplePackId =
              typeof exampleAsRecord?.packId === 'string' ? exampleAsRecord.packId : undefined;
            const alreadyInstalled = examplePackId != null && packs.some((p) => p.packId === examplePackId);
            return (
              <li key={example.label} className="card">
                <h3>{example.label}</h3>
                <p className="muted">{example.blurb}</p>
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    disabled={alreadyInstalled}
                    onClick={() => handleInstallExample(example.pack)}
                  >
                    {alreadyInstalled ? 'Installed' : 'Install example'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <hr className="section-rule" />

      {packs.length === 0 ? (
        <p className="muted">No packs installed.</p>
      ) : (
        <ul className="card-list">
          {packs.map((storedPack) => {
            const sectionCount = storedPack.pack.sections.length;
            const promptCount = storedPack.pack.prompts.length;
            return (
              <li key={storedPack.packId} className="card">
                <h3>{storedPack.pack.title}</h3>
                {storedPack.pack.subtitle ? <p className="muted">{storedPack.pack.subtitle}</p> : null}
                <p className="meta">
                  <span className="field-chip">id: {storedPack.packId}</span>
                  <span className="field-chip">version {storedPack.packVersion}</span>
                  <span className={TRUST_CLASSES[storedPack.trust] ?? 'field-chip'}>
                    {TRUST_LABELS[storedPack.trust] ?? storedPack.trust}
                  </span>
                </p>
                <p className="meta">
                  {sectionCount} section{sectionCount === 1 ? '' : 's'} &middot; {promptCount} prompt
                  {promptCount === 1 ? '' : 's'} &middot; installed {storedPack.installedAt}
                </p>
                <div className="row">
                  <button type="button" className="btn btn--secondary" onClick={() => handleExportPack(storedPack)}>
                    Export
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
