import type { WolfAppState } from '../hooks/useWolfApp.js';
import '../styles/data.css';

const TRUST_LABELS: Record<string, string> = {
  bundled: 'bundled',
  imported_unsigned: 'imported, unsigned',
  quarantined: 'quarantined',
};

/**
 * Installed packs (DESIGN.md 10.1, 9.4). Each stored pack row keeps the full
 * pack body (`StoredPack.pack`, see useWolfApp.ts), so section and prompt
 * counts are derived directly from that snapshot.
 */
export function PacksScreen({ packs }: WolfAppState): JSX.Element {
  return (
    <div className="stack">
      <h1>Packs</h1>

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
                  <span className="field-chip">{TRUST_LABELS[storedPack.trust] ?? storedPack.trust}</span>
                </p>
                <p className="meta">
                  {sectionCount} section{sectionCount === 1 ? '' : 's'} &middot; {promptCount} prompt
                  {promptCount === 1 ? '' : 's'} &middot; installed {storedPack.installedAt}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
