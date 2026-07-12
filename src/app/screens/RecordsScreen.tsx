import { useEffect, useMemo, useState } from 'react';
import { importRecordBundle, WolfValidationError } from '../../engine/index.js';
import {
  listSurveyAssignments,
  loadRecord,
  markSurveyReceived,
  saveRecord,
  saveSurveyAssignment,
  updateSurveyAssignmentStatus,
  type SurveyAssignment,
  type SurveyWorkflowStatus,
} from '../../storage/index.js';
import { bundleToRecord } from '../lib/import.js';
import type { WolfAppState } from '../hooks/useWolfApp.js';
import { routeToHash } from '../routes.js';
import {
  createHostedSurvey,
  fetchHostedRecord,
  isHostedDashboard,
  listHostedSurveys,
  rememberAdminKey,
  storedAdminKey,
  unlockHostedDashboard,
  updateHostedSurveyStatus,
  uploadHostedAnalysis,
} from '../lib/hosted.js';
import '../styles/data.css';

const WORKFLOW_STATUSES: SurveyWorkflowStatus[] = ['invited', 'started', 'received', 'submitted', 'analyzing', 'completed'];

export function RecordsScreen({ db, packs, records, refreshRecords, migrationSummary }: WolfAppState): JSX.Element {
  const [assignments, setAssignments] = useState<SurveyAssignment[]>([]);
  const [recipientLabel, setRecipientLabel] = useState('');
  const [surveyLabel, setSurveyLabel] = useState('');
  const [packId, setPackId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SurveyWorkflowStatus>('all');
  const [packFilter, setPackFilter] = useState('all');
  const [surveyFilter, setSurveyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [availableRecordIds, setAvailableRecordIds] = useState<Set<string>>(() => new Set(records.map((record) => record.recordId)));
  const [remoteRecordIds, setRemoteRecordIds] = useState<Set<string>>(new Set());
  const [adminKeyInput, setAdminKeyInput] = useState(storedAdminKey());
  const [hostedUnlocked, setHostedUnlocked] = useState(false);
  const hostedDashboard = isHostedDashboard();

  const selectedPackId = packId || packs[0]?.packId || '';

  async function refreshAssignments(): Promise<void> {
    if (!db) return;
    setAssignments(await listSurveyAssignments(db));
  }

  useEffect(() => {
    void refreshAssignments();
  }, [db]);

  useEffect(() => {
    if (!hostedDashboard || !storedAdminKey()) return;
    void refreshHostedDashboard().catch(() => setHostedUnlocked(false));
    const interval = window.setInterval(() => void refreshHostedDashboard().catch(() => undefined), 30_000);
    return () => window.clearInterval(interval);
  }, [hostedDashboard]);

  useEffect(() => {
    setAvailableRecordIds(new Set(records.map((record) => record.recordId)));
  }, [records]);

  const assignmentIds = useMemo(() => new Set(assignments.map((assignment) => assignment.assignmentId)), [assignments]);
  const unassignedRecords = records.filter((record) => !assignmentIds.has(record.recordId));
  const surveyLabels = useMemo(() => Array.from(new Set(assignments.map((assignment) => assignment.surveyLabel))).sort(), [assignments]);

  const filteredAssignments = assignments.filter((assignment) => {
    if (statusFilter !== 'all' && assignment.status !== statusFilter) return false;
    if (packFilter !== 'all' && assignment.packId !== packFilter) return false;
    if (surveyFilter !== 'all' && assignment.surveyLabel !== surveyFilter) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${assignment.recipientLabel} ${assignment.surveyLabel} ${assignment.packId}`.toLowerCase().includes(needle);
  });

  function invitationUrl(assignment: SurveyAssignment): string {
    if (assignment.hosted && assignment.invitationToken) {
      return `${window.location.origin}/wolf/${assignment.assignmentId}#k=${assignment.invitationToken}`;
    }
    const hash = routeToHash({
      name: 'guided-start',
      packId: assignment.packId,
      assignmentId: assignment.assignmentId,
      recipientLabel: assignment.recipientLabel,
      surveyLabel: assignment.surveyLabel,
    });
    return new URL(hash, window.location.href).toString();
  }

  async function refreshHostedDashboard(): Promise<void> {
    if (!db) return;
    const surveys = await listHostedSurveys();
    const local = await listSurveyAssignments(db);
    const localById = new Map(local.map((assignment) => [assignment.assignmentId, assignment]));
    setAssignments(surveys.map((survey) => ({
      assignmentId: survey.code,
      packId: survey.pack_id,
      recipientLabel: survey.recipient_label,
      surveyLabel: survey.survey_label,
      status: survey.status as SurveyWorkflowStatus,
      createdAt: survey.created_at,
      updatedAt: survey.updated_at,
      receivedAt: survey.submitted_at ?? survey.started_at,
      hosted: true,
      invitationToken: localById.get(survey.code)?.invitationToken,
    })));
    setRemoteRecordIds(new Set(surveys.filter((survey) => Boolean(survey.has_record)).map((survey) => survey.code)));
    setHostedUnlocked(true);
  }

  async function connectHostedDashboard(): Promise<void> {
    setWorking(true);
    setError(null);
    try {
      await unlockHostedDashboard(adminKeyInput.trim());
      await refreshHostedDashboard();
      setNotice('Hosted dashboard connected.');
    } catch (err) {
      rememberAdminKey('');
      setHostedUnlocked(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function copyInvitation(assignment: SurveyAssignment): Promise<void> {
    const url = invitationUrl(assignment);
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`Invitation copied for ${assignment.recipientLabel}.`);
      setError(null);
    } catch {
      setNotice(null);
      setError(`Copy this invitation manually: ${url}`);
    }
  }

  async function createInvitation(): Promise<void> {
    if (!db || !selectedPackId || !recipientLabel.trim()) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const now = new Date().toISOString();
      const label = surveyLabel.trim() || packs.find((pack) => pack.packId === selectedPackId)?.pack.title || 'WOLF survey';
      const hosted = hostedDashboard && hostedUnlocked
        ? await createHostedSurvey({ packId: selectedPackId, recipientLabel: recipientLabel.trim(), surveyLabel: label })
        : null;
      const assignment: SurveyAssignment = {
        assignmentId: hosted?.code ?? crypto.randomUUID(),
        packId: selectedPackId,
        recipientLabel: recipientLabel.trim(),
        surveyLabel: label,
        status: 'invited',
        createdAt: hosted?.createdAt ?? now,
        updatedAt: hosted?.createdAt ?? now,
        receivedAt: null,
        hosted: Boolean(hosted),
        invitationToken: hosted?.token,
      };
      await saveSurveyAssignment(db, assignment);
      await refreshAssignments();
      await copyInvitation(assignment);
      if (hosted) await refreshHostedDashboard();
      setRecipientLabel('');
      setSurveyLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function changeStatus(assignmentId: string, status: SurveyWorkflowStatus): Promise<void> {
    if (!db) return;
    try {
      const assignment = assignments.find((candidate) => candidate.assignmentId === assignmentId);
      if (assignment?.hosted) await updateHostedSurveyStatus(assignmentId, status);
      await updateSurveyAssignmentStatus(db, assignmentId, status);
      if (assignment?.hosted) await refreshHostedDashboard();
      else await refreshAssignments();
      setNotice(`Survey moved to ${status}.`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openHostedRecord(code: string): Promise<void> {
    if (!db) return;
    setWorking(true);
    setError(null);
    try {
      const record = await fetchHostedRecord(code);
      if (!record) throw new Error('This survey has not synchronized any answers yet.');
      await saveRecord(db, record);
      setAvailableRecordIds((current) => new Set(current).add(code));
      await refreshRecords();
      window.location.hash = `#/record/${encodeURIComponent(code)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function importAnalysisReturn(event: React.ChangeEvent<HTMLInputElement>, code: string): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      await uploadHostedAnalysis(code, payload);
      await refreshHostedDashboard();
      setNotice(`Analysis return published to ${code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function importReturns(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!db || files.length === 0) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    let imported = 0;
    let duplicates = 0;
    const failures: string[] = [];
    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        const record = bundleToRecord(importRecordBundle(parsed));
        const existing = await loadRecord(db, record.recordId);
        const known = assignments.find((assignment) => assignment.assignmentId === record.recordId);
        if (existing) {
          await markSurveyReceived(db, {
            assignmentId: record.recordId,
            packId: existing.packId,
            recipientLabel: known?.recipientLabel ?? existing.subject.displayName ?? 'Unlabeled recipient',
            surveyLabel: known?.surveyLabel ?? existing.title,
          });
          duplicates += 1;
          continue;
        }
        await saveRecord(db, record);
        setAvailableRecordIds((current) => new Set(current).add(record.recordId));
        await markSurveyReceived(db, {
          assignmentId: record.recordId,
          packId: record.packId,
          recipientLabel: known?.recipientLabel ?? record.subject.displayName ?? 'Unlabeled recipient',
          surveyLabel: known?.surveyLabel ?? record.title,
        });
        imported += 1;
      } catch (err) {
        const message = err instanceof WolfValidationError || err instanceof Error ? err.message : String(err);
        failures.push(`${file.name}: ${message}`);
      }
    }
    await refreshRecords();
    if (hostedUnlocked) await refreshHostedDashboard();
    else await refreshAssignments();
    setWorking(false);
    setNotice(`Imported ${imported} return${imported === 1 ? '' : 's'}${duplicates ? `; skipped ${duplicates} existing record${duplicates === 1 ? '' : 's'}` : ''}.`);
    if (failures.length > 0) setError(failures.join(' '));
  }

  const counts = Object.fromEntries(WORKFLOW_STATUSES.map((status) => [status, assignments.filter((item) => item.status === status).length])) as Record<SurveyWorkflowStatus, number>;

  return (
    <div className="stack">
      <header>
        <p className="meta">LOCAL OPERATOR CONTROL</p>
        <h1>Survey dashboard</h1>
        <p className="muted">Create labeled invitations, receive many WOLF records, and move each response through analysis without mixing people or surveys.</p>
      </header>

      {migrationSummary ? <p className="notice" role="status">Migrated {migrationSummary.migrated} legacy answers.</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="notice" role="alert">{error}</p> : null}

      {hostedDashboard ? (
        <section className="card stack" aria-labelledby="hosted-access-heading">
          <h2 id="hosted-access-heading">Hosted dashboard access</h2>
          {hostedUnlocked ? (
            <div className="row"><span className="field-chip">connected</span><button type="button" className="btn btn--secondary" onClick={() => void refreshHostedDashboard()}>Refresh now</button></div>
          ) : (
            <><label htmlFor="admin-key">Dashboard key</label><input id="admin-key" type="password" value={adminKeyInput} onChange={(event) => setAdminKeyInput(event.target.value)} autoComplete="current-password" /><button type="button" className="btn" disabled={working || !adminKeyInput.trim()} onClick={() => void connectHostedDashboard()}>Unlock hosted dashboard</button></>
          )}
          <p className="meta">The key is kept only in this browser tab and is never included in the deployed files.</p>
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="summary-heading">
        <h2 id="summary-heading">Pipeline</h2>
        <div className="row">
          {WORKFLOW_STATUSES.map((status) => <span className="field-chip" key={status}>{status}: {counts[status]}</span>)}
          <span className="field-chip">total: {assignments.length}</span>
        </div>
        <p className="meta">{hostedUnlocked ? 'Hosted invitations update automatically while recipients work online. This view refreshes every 30 seconds.' : 'Local-only invitations remain invited until their return file is imported here.'}</p>
      </section>

      <section className="card stack" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Create a recipient invitation</h2>
        <label htmlFor="recipient-label">Recipient label</label>
        <input id="recipient-label" value={recipientLabel} onChange={(event) => setRecipientLabel(event.target.value)} placeholder="Lotus, Store 14, Night shift…" />
        <label htmlFor="survey-label">Survey or campaign label</label>
        <input id="survey-label" value={surveyLabel} onChange={(event) => setSurveyLabel(event.target.value)} placeholder="July field report" />
        <label htmlFor="invite-pack">Question pack</label>
        <select id="invite-pack" value={selectedPackId} onChange={(event) => setPackId(event.target.value)}>
          {packs.map((pack) => <option key={pack.packId} value={pack.packId}>{pack.pack.title}</option>)}
        </select>
        <button type="button" className="btn" disabled={working || !recipientLabel.trim() || !selectedPackId || (hostedDashboard && !hostedUnlocked)} onClick={() => void createInvitation()}>
          Create and copy invitation
        </button>
        <p className="meta">Use a label you recognize. It travels in the invitation URL and returned record, so do not put secrets in it.</p>
      </section>

      <section className="card stack" aria-labelledby="returns-heading">
        <h2 id="returns-heading">Import returned answers</h2>
        <p>Select one or many <code>.wolfrecord.json</code> files. Matching invitation IDs move automatically to received.</p>
        <label className="btn btn--secondary" htmlFor="return-files">Choose returned files</label>
        <input id="return-files" className="visually-hidden" type="file" multiple accept=".json,application/json" onChange={(event) => void importReturns(event)} />
      </section>

      <section className="stack" aria-labelledby="inbox-heading">
        <h2 id="inbox-heading">Response inbox</h2>
        <div className="row">
          <label htmlFor="survey-search">Search</label>
          <input id="survey-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Recipient or survey" />
          <label htmlFor="status-filter">Status</label>
          <select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | SurveyWorkflowStatus)}>
            <option value="all">All statuses</option>
            {WORKFLOW_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <label htmlFor="pack-filter">Pack</label>
          <select id="pack-filter" value={packFilter} onChange={(event) => setPackFilter(event.target.value)}>
            <option value="all">All packs</option>
            {packs.map((pack) => <option key={pack.packId} value={pack.packId}>{pack.pack.title}</option>)}
          </select>
          <label htmlFor="survey-filter">Survey</label>
          <select id="survey-filter" value={surveyFilter} onChange={(event) => setSurveyFilter(event.target.value)}>
            <option value="all">All surveys</option>
            {surveyLabels.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </div>

        {filteredAssignments.length === 0 ? <p className="muted">No invitations or returned surveys match these filters.</p> : (
          <ul className="card-list">
            {filteredAssignments.map((assignment) => {
              const hasRecord = availableRecordIds.has(assignment.assignmentId);
              const hasRemoteRecord = remoteRecordIds.has(assignment.assignmentId);
              return (
                <li className="card stack" key={assignment.assignmentId}>
                  <div>
                    <h3>{assignment.recipientLabel}</h3>
                    <p>{assignment.surveyLabel}</p>
                    <p className="meta"><span className="field-chip">{assignment.status}</span> <span className="field-chip">pack: {assignment.packId}</span></p>
                  </div>
                  <label htmlFor={`status-${assignment.assignmentId}`}>Workflow status</label>
                  <select id={`status-${assignment.assignmentId}`} value={assignment.status} onChange={(event) => void changeStatus(assignment.assignmentId, event.target.value as SurveyWorkflowStatus)}>
                    {WORKFLOW_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <div className="row">
                    <button type="button" className="btn btn--secondary" onClick={() => void copyInvitation(assignment)}>Copy invitation</button>
                    {assignment.hosted && hasRemoteRecord ? <button type="button" className="btn" onClick={() => void openHostedRecord(assignment.assignmentId)}>Open synchronized answers</button> : null}
                    {assignment.hosted && hasRemoteRecord ? <><label className="btn btn--secondary" htmlFor={`analysis-${assignment.assignmentId}`}>Publish analysis return</label><input id={`analysis-${assignment.assignmentId}`} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => void importAnalysisReturn(event, assignment.assignmentId)} /></> : null}
                    {hasRecord ? <a className="btn" href={`#/record/${encodeURIComponent(assignment.assignmentId)}`}>Open returned answers</a> : null}
                  </div>
                  <p className="meta">Created {assignment.createdAt}{assignment.receivedAt ? ` · received ${assignment.receivedAt}` : ''}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {unassignedRecords.length > 0 ? (
        <section className="stack" aria-labelledby="other-records-heading">
          <h2 id="other-records-heading">Other local records</h2>
          <p className="muted">Records created before the invitation dashboard remain available here.</p>
          <ul className="card-list">
            {unassignedRecords.map((record) => <li className="card" key={record.recordId}><a href={`#/record/${encodeURIComponent(record.recordId)}`}><h3>{record.title}</h3></a><p className="meta">{record.packId} · {record.status} · updated {record.updatedAt}</p></li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
