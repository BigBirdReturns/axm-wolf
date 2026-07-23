import { useState } from 'react';
import { loadRecord } from '../../storage/index.js';
import { createAndSaveRecord, type WolfAppState } from '../hooks/useWolfApp.js';
import { beginGuidedSession, guidedDestination } from '../lib/guided.js';
import type { Route } from '../routes.js';
import { hostedSessionForRecord } from '../lib/hosted.js';

type GuidedInvitation = Extract<Route, { name: 'guided-start' }>;

export function GuidedStartScreen({
  invitation,
  db,
  packs,
  records,
  refreshRecords,
  onNavigate,
}: WolfAppState & { invitation: GuidedInvitation; onNavigate: (hash: string) => void }): JSX.Element {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { packId, assignmentId, recipientLabel, surveyLabel } = invitation;
  const pack = packs.find((candidate) => candidate.packId === packId);
  const isHosted = assignmentId ? hostedSessionForRecord(assignmentId) !== null : false;
  const existing = assignmentId
    ? records.find((record) => record.recordId === assignmentId)
    : records.find((record) => record.packId === packId);

  async function continueExisting(): Promise<void> {
    if (!db || !existing) return;
    setWorking(true);
    setError(null);
    try {
      const record = await loadRecord(db, existing.recordId);
      if (!record) throw new Error('Your saved record could not be opened');
      beginGuidedSession(packId);
      onNavigate(guidedDestination(record));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setWorking(false);
    }
  }

  async function beginNew(): Promise<void> {
    if (!db || !pack) return;
    setWorking(true);
    setError(null);
    try {
      const title = recipientLabel
        ? `${surveyLabel ?? pack.pack.title} — ${recipientLabel}`
        : surveyLabel ?? undefined;
      const recordId = await createAndSaveRecord(db, pack, refreshRecords, {
        ...(assignmentId ? { recordId: assignmentId } : {}),
        ...(title ? { title } : {}),
        ...(recipientLabel
          ? {
              subject: {
                displayName: recipientLabel,
                subtitle: surveyLabel ?? pack.pack.subtitle ?? null,
              },
            }
          : {}),
      });
      const record = await loadRecord(db, recordId);
      if (!record) throw new Error('Your new record could not be opened');
      beginGuidedSession(packId);
      onNavigate(guidedDestination(record));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setWorking(false);
    }
  }

  if (!pack) {
    return (
      <div className="stack">
        <h1>This invitation is not available</h1>
        <p className="notice">The requested question set is not installed in this version of WOLF. Ask the sender for an updated link.</p>
      </div>
    );
  }

  return (
    <div className="stack guided-start">
      <section className="card stack">
        <p className="meta">PRIVATE GUIDED RESPONSE</p>
        <h1>{pack.pack.title}</h1>
        {recipientLabel ? <p><strong>For:</strong> {recipientLabel}</p> : null}
        {surveyLabel ? <p><strong>Survey:</strong> {surveyLabel}</p> : null}
        {pack.pack.subtitle ? <p className="muted">{pack.pack.subtitle}</p> : null}
        <p>You were sent this page to answer a set of questions in your own words. There is no timer, no required order, and no need to finish in one sitting.</p>
      </section>

      <section className="card stack" aria-labelledby="guided-how-heading">
        <h2 id="guided-how-heading">What you do</h2>
        <ol>
          <li>Read one question.</li>
          <li>Tap <strong>Start voice input</strong> and speak, or type your answer.</li>
          <li>Review the text, then tap <strong>Save to Record</strong>.</li>
          <li>Stop whenever you want. This link brings you back to your saved work on this device.</li>
        </ol>
        <p className="notice">{isHosted ? 'Your answers save on this device and synchronize to this private interview when you are online.' : 'Your answers stay in this browser on this device until you choose to export or share them.'} Voice input creates text; WOLF does not keep an audio recording.</p>
        {isHosted ? <p className="muted">At submission, you can separately allow or decline a frozen manual analysis copy for the interviewer’s approved ChatGPT or Claude subscription. Declining does not prevent submission. Any resulting claims must cite your exact words and cannot change your answers.</p> : null}
      </section>

      <section className="card stack" aria-labelledby="guided-start-heading">
        <h2 id="guided-start-heading">Ready?</h2>
        {existing ? (
          <>
            <p>Saved work was found on this device.</p>
            <button type="button" className="btn" disabled={working} onClick={() => void continueExisting()}>
              {working ? 'Opening your work…' : 'Continue where I stopped'}
            </button>
            <details>
              <summary>Start a separate new response instead</summary>
              <button type="button" className="btn btn--secondary" disabled={working} onClick={() => void beginNew()}>Begin another response</button>
            </details>
          </>
        ) : (
          <button type="button" className="btn" disabled={working} onClick={() => void beginNew()}>
            {working ? 'Preparing your first question…' : 'Begin with the first question'}
          </button>
        )}
        {error ? <p role="alert" className="notice">{error}</p> : null}
      </section>

      <p className="muted">If microphone access is requested, choose Allow to use voice input. You can always type instead.</p>
    </div>
  );
}
