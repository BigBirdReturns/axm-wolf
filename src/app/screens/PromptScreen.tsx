import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCurrentResponse,
  type ResponseRevision,
  type WolfRecord,
} from '../../engine/index.js';
import { commitResponseAtomic, getDraft, loadRecord, type WolfDb } from '../../storage/index.js';
import type { CaptureSource } from '../../engine/types.js';
import { useDraftAutosave } from '../hooks/useDraftAutosave.js';
import { RevisionHistory } from '../components/RevisionHistory.js';
import { useSpeechInput } from '../speech/useSpeechInput.js';
import type { SpeechErrorKind } from '../speech/speechAdapter.js';
import '../styles/prompt.css';
import { guidedPackId } from '../lib/guided.js';
import { hostedSessionForRecord, syncHostedRecord } from '../lib/hosted.js';

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
      suggestedFollowUp={prompt.suggestedFollowUp ?? null}
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
  suggestedFollowUp: string | null;
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
  suggestedFollowUp,
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
  const [hostedSyncStatus, setHostedSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'pending'>('idle');

  const syncCurrentRecord = useCallback(async (): Promise<void> => {
    if (!hostedSessionForRecord(recordId)) return;
    setHostedSyncStatus('syncing');
    try {
      const latest = await loadRecord(db, recordId);
      if (latest) await syncHostedRecord(latest);
      setHostedSyncStatus('synced');
    } catch {
      setHostedSyncStatus('pending');
    }
  }, [db, recordId]);

  useEffect(() => {
    if (!hostedSessionForRecord(recordId)) return;
    const retry = () => void syncCurrentRecord();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [recordId, syncCurrentRecord]);

  const { text, setText, status, flush } = useDraftAutosave(db, recordId, promptId, initialText, syncCurrentRecord);

  const [followUpExpanded, setFollowUpExpanded] = useState(false);
  const isGuided = guidedPackId() === record.packId;

  // Source attribution for the next commit (DESIGN 10.3): two booleans
  // tracking whether the text currently in the textarea includes any
  // content the subject typed by hand vs. appended via voice transcript
  // since the last commit. Reset together after each commit.
  const [hasTypedSinceCommit, setHasTypedSinceCommit] = useState(false);
  const [hasTranscriptSinceCommit, setHasTranscriptSinceCommit] = useState(false);

  const textRef = useRef(text);
  textRef.current = text;

  const speech = useSpeechInput(
    'en-US',
    () => textRef.current,
    (next) => {
      setText(next);
      setHasTranscriptSinceCommit(true);
    },
  );

  function handleTextChange(value: string): void {
    setText(value);
    setHasTypedSinceCommit(true);
  }

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
      const source: CaptureSource =
        hasTranscriptSinceCommit && hasTypedSinceCommit
          ? 'mixed'
          : hasTranscriptSinceCommit
            ? 'speech_transcript'
            : 'typed';
      await commitResponseAtomic(db, recordId, promptId, text, source);
      const reloaded = await loadRecord(db, recordId);
      if (reloaded) {
        setRecord(reloaded);
        if (hostedSessionForRecord(recordId)) {
          try {
            setHostedSyncStatus('syncing');
            await syncHostedRecord(reloaded);
            setHostedSyncStatus('synced');
          } catch {
            setHostedSyncStatus('pending');
          }
        }
      }
      setHasTypedSinceCommit(false);
      setHasTranscriptSinceCommit(false);
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
      {isGuided ? (
        <section className="notice stack" aria-labelledby="answer-help-heading">
          <h2 id="answer-help-heading">How to answer this question</h2>
          <p><strong>1.</strong> Speak or type. <strong>2.</strong> Review the words. <strong>3.</strong> Tap <strong>Save to Record</strong>.</p>
          <p className="meta">Your draft saves while you work, but it is not part of the finished record until you tap Save to Record. You may stop and return at any time.</p>
        </section>
      ) : null}
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

      {suggestedFollowUp ? (
        <div className="prompt-screen__followup">
          <button
            type="button"
            className="prompt-screen__followup-toggle"
            aria-expanded={followUpExpanded}
            aria-controls="prompt-followup-text"
            onClick={() => setFollowUpExpanded((expanded) => !expanded)}
          >
            Go deeper
          </button>
          {followUpExpanded ? (
            <p id="prompt-followup-text" className="prompt-screen__followup-text">
              {suggestedFollowUp}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="prompt-screen__field">
        <label htmlFor="prompt-response">Your response</label>
        <textarea
          id="prompt-response"
          rows={10}
          value={text}
          onChange={(event) => handleTextChange(event.target.value)}
        />
      </div>

      <div className="row prompt-screen__actions">
        <button type="button" className="btn" disabled={commitDisabled} onClick={() => void handleCommit()}>
          Save to Record
        </button>
        {speech.supported ? (
          <button
            type="button"
            className="btn btn--secondary"
            aria-pressed={speech.listening}
            onClick={() => {
              if (speech.listening) {
                speech.stop();
              } else {
                speech.start();
              }
            }}
          >
            {speech.listening ? (
              <>
                <span className="speech-dot" aria-hidden="true" /> Stop listening
              </>
            ) : (
              isGuided ? 'Start voice input — speak your answer' : 'Start voice input'
            )}
          </button>
        ) : null}
      </div>

      {speech.supported ? (
        <div className="prompt-screen__speech">
          {speech.listening ? (
            <p className="prompt-screen__speech-status">Listening…</p>
          ) : null}
          {speech.error ? (
            <p role="alert" className="notice">
              {describeSpeechError(speech.error)}
            </p>
          ) : null}
          <p className="muted prompt-screen__speech-disclosure">
            Voice input availability and network use depend on your browser; transcription may be processed by the
            browser vendor and is not part of offline support.
          </p>
        </div>
      ) : null}

      <p aria-live="polite" className="prompt-screen__status">
        {autosaveStatusText}
        {commitStatusText ? <> &middot; {commitStatusText}</> : null}
      </p>
      {hostedSessionForRecord(recordId) ? (
        <p className="meta" role="status">
          {hostedSyncStatus === 'syncing' ? 'Synchronizing with the interviewer…' : hostedSyncStatus === 'synced' ? 'Synchronized with the interviewer.' : hostedSyncStatus === 'pending' ? 'Saved on this device. WOLF will retry synchronization when you are online.' : 'This interview synchronizes automatically when online.'}
        </p>
      ) : null}

      {isGuided && commitStatus === 'committed' ? (
        <p className="notice" role="status"><strong>Answer saved.</strong> Continue to the next question, choose another question, or stop and return later.</p>
      ) : null}

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
            {isGuided ? 'Previous question' : 'Previous'}
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" disabled aria-disabled="true">
            {isGuided ? 'Previous question' : 'Previous'}
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
            {isGuided ? 'Next question' : 'Next'}
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" disabled aria-disabled="true">
            {isGuided ? 'Next question' : 'Next'}
          </button>
        )}
        <a className="btn btn--secondary" href={`#/record/${encodeURIComponent(recordId)}`}>
          {isGuided ? 'Choose another question or finish' : 'Back to record'}
        </a>
      </nav>
    </div>
  );
}

function describeSpeechError(kind: SpeechErrorKind): string {
  switch (kind) {
    case 'permission-denied':
      return 'Microphone access was denied. Allow microphone access for this site in your browser settings to use voice input.';
    case 'no-speech':
      return 'No speech detected.';
    case 'network':
      return 'Voice input needs a network connection in this browser.';
    case 'unknown':
      return 'Voice input is unavailable right now.';
  }
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
