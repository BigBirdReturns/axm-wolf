// Section view screen (DESIGN.md 10.1 "Section view").
//
// Shows section label/range/description, and the prompt list in section
// order. Per DESIGN 2.6 there is no required order -- every prompt is
// tappable regardless of answered/draft state.

import { useEffect, useState } from 'react';
import { getCurrentResponse, type WolfRecord } from '../../engine/index.js';
import { loadRecord, type WolfDb } from '../../storage/index.js';
import { routeToHash } from '../routes.js';
import '../styles/record.css';

const PREVIEW_LENGTH = 140;

function previewText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
}

export function SectionScreen({
  db,
  recordId,
  sectionId,
  onNavigate,
}: {
  db: WolfDb;
  recordId: string;
  sectionId: string;
  onNavigate: (hash: string) => void;
}): JSX.Element {
  const [record, setRecord] = useState<WolfRecord | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecord(undefined);
    setError(null);

    loadRecord(db, recordId)
      .then((loaded) => {
        if (!cancelled) setRecord(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [db, recordId]);

  const recordHomeHash = routeToHash({ name: 'record', recordId });

  if (error) {
    return (
      <div className="stack">
        <h1>Section</h1>
        <p role="alert" className="notice">
          {error}
        </p>
        <p>
          <a className="btn btn--secondary" href="#/records">
            Back to records
          </a>
        </p>
      </div>
    );
  }

  if (record === undefined) {
    return (
      <div className="stack">
        <h1>Section</h1>
        <p aria-live="polite">Loading section&hellip;</p>
      </div>
    );
  }

  if (record === null) {
    return (
      <div className="stack">
        <h1>Record not found</h1>
        <p className="notice">No record with this ID exists on this device.</p>
        <p>
          <a className="btn btn--secondary" href="#/records">
            Back to records
          </a>
        </p>
      </div>
    );
  }

  const pack = record.packSnapshot;
  const section = pack.sections.find((s) => s.id === sectionId);

  if (!section) {
    return (
      <div className="stack">
        <h1>Section not found</h1>
        <p className="notice">This record's pack has no section with this ID.</p>
        <p>
          <a className="btn btn--secondary" href={recordHomeHash}>
            Back to record home
          </a>
        </p>
      </div>
    );
  }

  const lensLabelById = new Map(pack.lenses.map((l) => [l.id, l.label]));
  const promptById = new Map(pack.prompts.map((p) => [p.id, p]));
  const draftPromptIds = new Set(
    record.drafts.filter((d) => d.text.trim().length > 0).map((d) => d.promptId),
  );

  return (
    <div className="stack">
      <section>
        <p>
          <a className="btn btn--secondary" href={recordHomeHash}>
            &larr; {record.title}
          </a>
        </p>
        <h1>{section.label}</h1>
        {section.rangeLabel ? <p className="meta">{section.rangeLabel}</p> : null}
        {section.description ? <p className="muted">{section.description}</p> : null}
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="prompts-heading">
        <h2 id="prompts-heading">Prompts</h2>
        <ul className="prompt-list">
          {section.promptIds.map((promptId) => {
            const prompt = promptById.get(promptId);
            if (!prompt) return null;

            const lensLabel = lensLabelById.get(prompt.lensId) ?? prompt.lensId;
            const currentRevision = getCurrentResponse(record, promptId);
            const isAnswered = !!currentRevision && currentRevision.text.trim().length > 0;
            const hasDraft = draftPromptIds.has(promptId);
            const href = routeToHash({ name: 'record-prompt', recordId, promptId });

            return (
              <li key={promptId}>
                <a className="card-link" href={href}>
                  <div className="card">
                    <div className="prompt-card__head">
                      <span className="prompt-card__lens">{lensLabel}</span>
                      <span className="row" style={{ gap: '0.4rem' }}>
                        {isAnswered ? <span className="chip chip--answered">Answered</span> : null}
                        {hasDraft ? <span className="chip chip--draft">Draft</span> : null}
                        {!isAnswered && !hasDraft ? <span className="chip">Not started</span> : null}
                      </span>
                    </div>
                    <p className="prompt-card__text">{prompt.text}</p>
                    {isAnswered && currentRevision ? (
                      <p className="prompt-card__preview">{previewText(currentRevision.text)}</p>
                    ) : null}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <hr className="section-rule" />

      <p>
        <button type="button" className="btn" onClick={() => onNavigate(recordHomeHash)}>
          Back to record home
        </button>
      </p>
    </div>
  );
}
