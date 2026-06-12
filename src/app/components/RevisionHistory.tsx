import { useState } from 'react';
import type { ResponseRevision } from '../../engine/index.js';

const SOURCE_LABELS: Record<ResponseRevision['source'], string> = {
  typed: 'Typed',
  speech_transcript: 'Speech transcript',
  mixed: 'Typed and speech',
  imported: 'Imported',
};

/**
 * Revision history (DESIGN.md 2.5): append-only, collapsed by default,
 * newest-first when expanded. No delete or edit controls -- the full
 * revision chain remains exportable regardless of which revision the
 * prompt view shows as current.
 */
export function RevisionHistory({ revisions }: { revisions: ResponseRevision[] }): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);

  if (revisions.length < 1) {
    return null;
  }

  const newestFirst = [...revisions].reverse();

  return (
    <div className="revision-history">
      <button
        type="button"
        className="btn btn--secondary"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        Revision history ({revisions.length})
      </button>
      {expanded ? (
        <ol className="revision-history__list">
          {newestFirst.map((revision) => (
            <li key={revision.revisionId} className="revision-history__item card">
              <p className="meta">
                {formatTimestamp(revision.capturedAt)} &middot; {SOURCE_LABELS[revision.source]}
              </p>
              <p className="revision-history__text">{revision.text}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
