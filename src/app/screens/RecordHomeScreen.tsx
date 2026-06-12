// Record home screen (DESIGN.md 10.1 "Record home").
//
// Shows record title, subject, derived progress counts (DESIGN 2.10 -- no
// hard-coded pack-specific counts), a progress strip, section cards in pack
// order, and links to search/export/records.

import { useEffect, useState } from 'react';
import { computeProgress, type WolfRecord } from '../../engine/index.js';
import { loadRecord, type WolfDb } from '../../storage/index.js';
import { routeToHash } from '../routes.js';
import { ProgressStrip } from '../components/ProgressStrip.js';
import { SectionCard } from '../components/SectionCard.js';
import '../styles/record.css';

export function RecordHomeScreen({
  db,
  recordId,
  onNavigate,
}: {
  db: WolfDb;
  recordId: string;
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

  if (error) {
    return (
      <div className="stack">
        <h1>Record</h1>
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
        <h1>Record</h1>
        <p aria-live="polite">Loading record&hellip;</p>
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
  const progress = computeProgress(pack, record);
  const progressById = new Map(progress.bySection.map((s) => [s.sectionId, s]));

  const exportHash = routeToHash({ name: 'record-export', recordId });
  const searchHash = routeToHash({ name: 'record-search', recordId });

  return (
    <div className="stack">
      <section>
        <h1>{record.title}</h1>
        <p className="muted">
          {record.subject.displayName}
          {record.subject.subtitle ? ` — ${record.subject.subtitle}` : ''}
        </p>
        <p className="meta">
          {pack.title}
          {pack.subtitle ? ` · ${pack.subtitle}` : ''} &middot; status: {record.status}
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading">Progress</h2>
        <div className="summary-grid">
          <div className="summary-grid__item">
            <span className="summary-grid__value">
              {progress.answeredPrompts} / {progress.totalPrompts}
            </span>
            <span className="summary-grid__label">Answered</span>
          </div>
          <div className="summary-grid__item">
            <span className="summary-grid__value">{progress.draftPrompts}</span>
            <span className="summary-grid__label">Draft{progress.draftPrompts === 1 ? '' : 's'}</span>
          </div>
          <div className="summary-grid__item">
            <span className="summary-grid__value">{progress.wordCount}</span>
            <span className="summary-grid__label">Words</span>
          </div>
          <div className="summary-grid__item">
            <span className="summary-grid__value">{progress.percentAnswered}%</span>
            <span className="summary-grid__label">Complete</span>
          </div>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <ProgressStrip percent={progress.percentAnswered} label="Record progress" />
        </div>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading">Sections</h2>
        <ul className="card-list">
          {pack.sections.map((section) => {
            const sectionProgress = progressById.get(section.id);
            const total = sectionProgress?.totalPrompts ?? section.promptIds.length;
            const answered = sectionProgress?.answeredPrompts ?? 0;
            const draftCount = sectionProgress?.draftPrompts ?? 0;
            const percent = sectionProgress?.percentAnswered ?? 0;
            return (
              <SectionCard
                key={section.id}
                href={routeToHash({ name: 'record-section', recordId, sectionId: section.id })}
                label={section.label}
                rangeLabel={section.rangeLabel}
                answered={answered}
                total={total}
                percent={percent}
                draftCount={draftCount}
              />
            );
          })}
        </ul>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading">Tools</h2>
        <div className="row">
          <button type="button" className="btn" onClick={() => onNavigate(searchHash)}>
            Search
          </button>
          <button type="button" className="btn" onClick={() => onNavigate(exportHash)}>
            Export &amp; data
          </button>
          <a className="btn btn--secondary" href="#/records">
            Back to records
          </a>
        </div>
      </section>
    </div>
  );
}
