import { useEffect, useState } from 'react';
import { loadRecord, saveRecord } from '../../storage/index.js';
import type { WolfRecord } from '../../engine/index.js';
import { createAndSaveRecord, type WolfAppState } from '../hooks/useWolfApp.js';
import {
  bootstrapHostedSurvey,
  hostedSessionForRecord,
  invitationToken,
  rememberHostedSession,
} from '../lib/hosted.js';
import { GuidedStartScreen } from './GuidedStartScreen.js';

export function HostedSurveyScreen({
  code,
  db, packs, records, refreshRecords,
  onNavigate,
  ...wolfApp
}: WolfAppState & { code: string; onNavigate: (hash: string) => void }): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ record: WolfRecord; packId: string; recipientLabel: string; surveyLabel: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!db) throw new Error('Local storage is unavailable.');
        const token = invitationToken() ?? hostedSessionForRecord(code)?.token;
        if (!token) throw new Error('This invitation is missing its private access key. Open the complete link that was sent to you.');
        const bootstrap = await bootstrapHostedSurvey(code, token);
        const pack = packs.find((candidate) => candidate.packId === bootstrap.packId);
        if (!pack) throw new Error('This question pack is not installed in the current WOLF build.');
        if (bootstrap.record) await saveRecord(db, bootstrap.record);
        let record = await loadRecord(db, code);
        if (!record) {
          await createAndSaveRecord(db, pack, refreshRecords, {
            recordId: code,
            title: `${bootstrap.surveyLabel} — ${bootstrap.recipientLabel}`,
            subject: { displayName: bootstrap.recipientLabel, subtitle: bootstrap.surveyLabel },
          });
          record = await loadRecord(db, code);
        }
        if (!record) throw new Error('The interview record could not be prepared.');
        rememberHostedSession({ code, token, revision: bootstrap.revision });
        if (!cancelled) setReady({ record, packId: bootstrap.packId, recipientLabel: bootstrap.recipientLabel, surveyLabel: bootstrap.surveyLabel });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [code, db, packs, refreshRecords, onNavigate]);

  if (error) return (
    <div className="stack"><h1>Interview unavailable</h1><p role="alert" className="notice">{error}</p></div>
  );
  if (!ready) return <p>Opening your private interview…</p>;
  const summary = { recordId: ready.record.recordId, title: ready.record.title, status: ready.record.status, updatedAt: ready.record.updatedAt, packId: ready.record.packId };
  return <GuidedStartScreen {...wolfApp} db={db} packs={packs} refreshRecords={refreshRecords} records={[summary, ...records.filter((record) => record.recordId !== summary.recordId)]} invitation={{ name: 'guided-start', packId: ready.packId, assignmentId: code, recipientLabel: ready.recipientLabel, surveyLabel: ready.surveyLabel }} onNavigate={onNavigate} />;
}
