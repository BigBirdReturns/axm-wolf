import { useEffect, useState } from 'react';
import {
  getCurrentResponse,
  type ResponseRevision,
  type WolfRecord,
} from '../../engine/index.js';
import { commitResponseAtomic, getDraft, loadRecord, type WolfDb } from '../../storage/index.js';
import { useDraftAutosave } from '../hooks/useDraftAutosave.js';
import { RevisionHistory } from '../components/RevisionHistory.js';
import '../styles/prompt.css';

export type PromptScreenProps = {
  db: WolfDb;
  recordId: string;
  promptId: string;
  onNavigate: (hash: string) => void;
};

/**
 * The core capture screen (DESIGN.md 10.1 'Prompt view').
 *
 * Loads the record, resolves the prompt from the record's pack snapshot
 * (not the live pack -- the snapshot is what makes the record intelligible
 * even if the pack is later removed or updated, per DESIGN 4.4), and shows
 * the section context, lens label, full prompt text, optional context cue,
 * a draft textarea with autosave status, the commit action, revision
 * history, and previous/next navigation within the section.
 */
export function PromptScreen({ db, recordId, promptId, onNavigate }: PromptScreenProps): JSX.Element {
  const [record, setRecord] = useState<WolfRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialText, setInitialText] = useState<string | null>(null);
  const [commitStatus, setCommitStatus] = useState<'idle' | 'committing' | 'committed' | 'commit-failed'>('idle');
  const [commitError, setCommitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      setInitialText(null);
      setCommitStatus('idle');
      setCommitError(null);
      try {
        const loaded = await loadRecord(db, recordId);
        if (cancelled) return;
        if (!loaded) {
          setRecord(null);
          setLoading(false);
          return;
        }

        const draft = await getDraft(db, recordId, promptId);
        if (cancelled) return;

        const currentRevision = getCurrentResponse(loaded, promptId);

        // Textarea initialization (DESIGN 8.2, 10.2): a draft, if present,
        // takes precedence over the committed text -- it represents the
        // subject's most recent unsaved edits. If there is no draft, start
        // from the current revision's text (not empty) so that editing an
        // already-answered prompt begins from what is on the record.
        setInitialText(draft?.text ?? currentRevision?.text ?? '');
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
  }, [db, recordId, promptId]);

  if (loading || initialText === null) {
    return (
      <div className="stack">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="stack">
        <p role="alert" className="notice">
          {loadError}
        </p>
        <p>
          <a className="btn btn--secondary" href="#/records">
            Back to records
          </a>
        </p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="stack">
        <h1>Record not found</h1>
        <p className="notice">This record does not exist or has been removed.</p>
        <p>
          <a className="btn btn--secondary" href="#/records">
            Back to records
          </a>
        </p>
      </div>
    );
  }

  const prompt = record.packSnapshot.prompts.find((p) => p.id === promptId);

  if (!prompt) {
    return (
      <div className="stack">
        <h1>Prompt not found</h1>
        <p className="notice">
          This prompt is not present in this record&rsquo;s pack snapshot.
        </p>
        <p>
          <a className="btn btn--secondary" href={`#/record/${encodeURIComponent(recordId)}`}>
            Back to record
          </a>
        </p>
      </div>
    );
  }

  const section = record.packSnapshot.sections.find((s) => s.promptIds.includes(promptId));
  const lens = record.packSnapshot.lenses.find((l) => l.id === prompt.lensId);
  const currentRevision = getCurrentResponse(record, promptId);

  return (
    <PromptScreenBody
      db={db}
      recordId={recordId}
      promptId={promptId}
      record={record}
      setRecord={setRecord}
      promptText={prompt.text}
      contextCue={prompt.context ?? null}
      lensLabel={lens?.label ?? prompt.lensId}
      sectionLabel={section?.label ?? null}
      sectionRangeLabel={section?.rangeLabel ?? null}
      sectionPromptIds={section?.promptIds ?? []}
      currentRevisionText={currentRevision?.text ?? null}
      revisions={record.responses.find((r) => r.promptId === promptId)?.revisions ?? []}
      initialText={initialText}
      commitStatus={commitStatus}
      setCommitStatus={setCommitStatus}
      commitError={commitError}
      setCommitError={setCommitError}
      onNavigate={onNavigate}
    />
  );
}

type PromptScreenBodyProps = {
  db: WolfDb;
  recordId: string;
  promptId: string;
  record: WolfRecord;
  setRecord: (record: WolfRecord) => void;
  promptText: string;
  contextCue: string | null;
  lensLabel: string;
  sectionLabel: string | null;
  sectionRangeLabel: string | null;
  sectionPromptIds: string[];
  currentRevisionText: string | null;
  revisions: ResponseRevision[];
  initialText: string;
  commitStatus: 'idle' | 'committing' | 'committed' | 'commit-failed';
  setCommitStatus: (status: 'idle' | 'committing' | 'committed' | 'commit-failed') => void;
  commitError: string | null;
  setCommitError: (error: string | null) => void;
  onNavigate: (hash: string) => void;
};

function PromptScreenBody({
  db,
  recordId,
  promptId,
  record,
  setRecord,
  promptText,
  contextCue,
  lensLabel,
  sectionLabel,
  sectionRangeLabel,
  sectionPromptIds,
  currentRevisionText,
  revisions,
  initialText,
  commitStatus,
  setCommitStatus,
  commitError,
  setCommitError,
  onNavigate,
}: PromptScreenBodyProps): JSX.Element {
  const { text, setText, status, flush } = useDraftAutosave(db, recordId, promptId, initialText);

  const trimmed = text.trim();
  const unchanged = currentRevisionText !== null && text === currentRevisionText;
  const commitDisabled = trimmed.length === 0 || unchanged || commitStatus === 'committing';

  const index = sectionPromptIds.indexOf(promptId);
  const prevPromptId = index > 0 ? sectionPromptIds[index - 1] : null;
  const nextPromptId = index >= 0 && index < sectionPromptIds.length - 1 ? sectionPromptIds[index + 1] : null;

  async function handleCommit(): Promise<void> {
    setCommitStatus('committing');
    setCommitError(null);
    try {
      await flush();
      await commitResponseAtomic(db, recordId, promptId, text, 'typed');
      const reloaded = await loadRecord(db, recordId);
      if (reloaded) {
        setRecord(reloaded);
      }
      setCommitStatus('committed');
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : String(err));
      setCommitStatus('commit-failed');
    }
  }

  const autosaveStatusText = describeAutosaveStatus(status);
  const commitStatusText = describeCommitStatus(commitStatus, commitError);

  return (
    <div className="stack prompt-screen">
      {sectionLabel ? (
        <p className="meta prompt-screen__section">
          {sectionLabel}
          {sectionRangeLabel ? <> &middot; {sectionRangeLabel}</> : null}
        </p>
      ) : null}

      <p className="chip chip--lens">{lensLabel}</p>

      <h1 id="prompt-text" className="prompt-screen__text">
        {promptText}
      </h1>

      {contextCue ? <p className="prompt-screen__cue">{contextCue}</p> : null}

      <div className="prompt-screen__field">
        <label htmlFor="prompt-response">Your response</label>
        <textarea
          id="prompt-response"
          aria-labelledby="prompt-text prompt-response-label"
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <span id="prompt-response-label" className="visually-hidden">
          Your response
        </span>
      </div>

      <div className="row prompt-screen__actions">
        <button type="button" className="btn" disabled={commitDisabled} onClick={() => void handleCommit()}>
          Save to Record
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          disabled
          aria-disabled="true"
          title="Voice input arrives in a later phase"
        >
          Voice input
        </button>
      </div>

      <p aria-live="polite" className="prompt-screen__status">
        {autosaveStatusText}
        {commitStatusText ? <> &middot; {commitStatusText}</> : null}
      </p>

      <RevisionHistory revisions={revisions} />

      <hr className="section-rule" />

      <nav className="row prompt-screen__nav" aria-label="Prompt navigation">
        {prevPromptId ? (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              void flush();
              onNavigate(`#/record/${encodeURIComponent(recordId)}/prompt/${encodeURIComponent(prevPromptId)}`);
            }}
          >
            Previous
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" disabled aria-disabled="true">
            Previous
          </button>
        )}
        {nextPromptId ? (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              void flush();
              onNavigate(`#/record/${encodeURIComponent(recordId)}/prompt/${encodeURIComponent(nextPromptId)}`);
            }}
          >
            Next
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" disabled aria-disabled="true">
            Next
          </button>
        )}
        <a className="btn btn--secondary" href={`#/record/${encodeURIComponent(recordId)}`}>
          Back to record
        </a>
      </nav>
    </div>
  );
}

function describeAutosaveStatus(status: 'idle' | 'saving' | 'saved' | 'save-failed'): string {
  switch (status) {
    case 'idle':
      return '';
    case 'saving':
      return 'Saving draft…';
    case 'saved':
      return 'Draft saved — not yet on the record.';
    case 'save-failed':
      return 'Draft save failed. Your text is still here; try again or use Save to Record.';
  }
}

function describeCommitStatus(
  status: 'idle' | 'committing' | 'committed' | 'commit-failed',
  error: string | null,
): string {
  switch (status) {
    case 'idle':
      return '';
    case 'committing':
      return 'Saving to record…';
    case 'committed':
      return 'Saved to record. Editing and saving again will create another revision.';
    case 'commit-failed':
      return `Save to record failed${error ? `: ${error}` : '.'}`;
  }
}
