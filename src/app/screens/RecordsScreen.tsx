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
  addHostedMember,
  createHostedWorkspace,
  createHostedSurvey,
  fetchHostedRecord,
  getHostedOperatorSession,
  isHostedDashboard,
  listHostedMembers,
  listHostedSurveys,
  updateHostedSurveyStatus,
  uploadHostedAnalysis,
  type HostedMember,
  type HostedOperatorSession,
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
  const [operatorSession, setOperatorSession] = useState<HostedOperatorSession | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [members, setMembers] = useState<HostedMember[]>([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<HostedMember['role']>('interviewer');
  const [workspaceName, setWorkspaceName] = useState('');
  const hostedDashboard = isHostedDashboard();
  const hostedUnlocked = Boolean(operatorSession && workspaceId);
  const selectedWorkspace = operatorSession?.workspaces.find((workspace) => workspace.id === workspaceId);
  const canManageMembers = operatorSession?.identity.isRoot || selectedWorkspace?.role === 'steward' || selectedWorkspace?.role === 'owner';

  const selectedPackId = packId || packs[0]?.packId || '';

  async function refreshAssignments(): Promise<void> {
    if (!db) return;
    setAssignments(await listSurveyAssignments(db));
  }

  useEffect(() => {
    void refreshAssignments();
  }, [db]);

  useEffect(() => {
    if (!hostedDashboard) return;
    void connectHostedDashboard();
  }, [hostedDashboard]);

  useEffect(() => {
    if (!hostedDashboard || !workspaceId) return;
    void refreshHostedDashboard(workspaceId);
    const interval = window.setInterval(() => void refreshHostedDashboard(workspaceId).catch(() => undefined), 30_000);
    return () => window.clearInterval(interval);
  }, [hostedDashboard, workspaceId]);

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

  async function refreshHostedDashboard(targetWorkspaceId = workspaceId): Promise<void> {
    if (!db || !targetWorkspaceId) return;
    const workspace = operatorSession?.workspaces.find((candidate) => candidate.id === targetWorkspaceId);
    const mayListMembers = operatorSession?.identity.isRoot || workspace?.role === 'steward' || workspace?.role === 'owner';
    const [surveys, remoteMembers] = await Promise.all([listHostedSurveys(targetWorkspaceId), mayListMembers ? listHostedMembers(targetWorkspaceId) : Promise.resolve([])]);
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
    setMembers(remoteMembers);
  }

  async function connectHostedDashboard(): Promise<void> {
    setWorking(true);
    setError(null);
    try {
      const session = await getHostedOperatorSession();
      setOperatorSession(session);
      const firstWorkspace = session.workspaces[0]?.id ?? '';
      setWorkspaceId((current) => current || firstWorkspace);
      if (!firstWorkspace) setError('Your email is authenticated but has not been assigned to a WOLF workspace.');
    } catch (err) {
      setOperatorSession(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function createWorkspace(): Promise<void> {
    if (!workspaceName.trim()) return;
    setWorking(true); setError(null);
    try {
      const workspace = await createHostedWorkspace(workspaceName.trim());
      const session = await getHostedOperatorSession();
      setOperatorSession(session); setWorkspaceId(workspace.id); setWorkspaceName('');
      setNotice(`${workspace.name} workspace created.`);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setWorking(false); }
  }

  async function inviteMember(): Promise<void> {
    if (!workspaceId || !memberEmail.trim()) return;
    setWorking(true); setError(null);
    try {
      await addHostedMember(workspaceId, memberEmail.trim(), memberRole);
      setMembers(await listHostedMembers(workspaceId)); setMemberEmail('');
      setNotice(`${memberEmail.trim()} can now open this workspace using a Cloudflare email code.`);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setWorking(false); }
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
        ? await createHostedSurvey(workspaceId, { packId: selectedPackId, recipientLabel: recipientLabel.trim(), surveyLabel: label })
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
      if (hosted) await refreshHostedDashboard(workspaceId);
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
      if (assignment?.hosted) await refreshHostedDashboard(workspaceId);
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
      await refreshHostedDashboard(workspaceId);
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
    if (hostedUnlocked) await refreshHostedDashboard(workspaceId);
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
          <h2 id="hosted-access-heading">Your WOLF workspace</h2>
          {operatorSession ? <>
            <p>Signed in as <strong>{operatorSession.identity.email}</strong>.</p>
            <label htmlFor="workspace-select">Workspace</label>
            <select id="workspace-select" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              {operatorSession.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} — {workspace.role}</option>)}
            </select>
            <div className="row"><span className="field-chip">email-code protected</span><button type="button" className="btn btn--secondary" onClick={() => void refreshHostedDashboard(workspaceId)}>Refresh now</button></div>
            <p className="meta"><a href="/cdn-cgi/access/logout">Sign out of this device</a></p>
            {operatorSession.identity.isRoot ? <div className="stack">
              <h3>Create another workspace</h3>
              <label htmlFor="workspace-name">Workspace name</label>
              <input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Helen's interviews" />
              <button type="button" className="btn" disabled={working || !workspaceName.trim()} onClick={() => void createWorkspace()}>Create workspace</button>
            </div> : null}
            {canManageMembers && workspaceId ? <div className="stack">
              <h3>Give someone operator access</h3>
              <p className="muted">They use their email and a one-time Cloudflare code. No Google account or WOLF password is required.</p>
              <label htmlFor="member-email">Email</label>
              <input id="member-email" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="helen@example.com" />
              <label htmlFor="member-role">Permission</label>
              <select id="member-role" value={memberRole} onChange={(event) => setMemberRole(event.target.value as HostedMember['role'])}>
                <option value="interviewer">Interviewer — create and manage interviews</option>
                <option value="viewer">Viewer — read only</option>
                {operatorSession.identity.isRoot ? <option value="steward">Steward — manage interviews and members</option> : null}
              </select>
              <button type="button" className="btn" disabled={working || !memberEmail.trim()} onClick={() => void inviteMember()}>Grant workspace access</button>
              {members.length ? <p className="meta">Current members: {members.map((member) => `${member.email} (${member.role})`).join(', ')}</p> : null}
            </div> : null}
          </> : <p>Cloudflare Access will ask for your email and send a single-use code. If you are authenticated but not invited, WOLF reveals no workspace data.</p>}
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="summary-heading">
        <h2 id="summary-heading">Pipeline</h2>
        <div className="row">
          {WORKFLOW_STATUSES.map((status) => <span className="field-chip" key={status}>{status}: {counts[status]}</span>)}
          <span className="field-chip">total: {assignments.length}</span>
        </div>
        <p className="meta">{hostedUnlocked ? `Hosted invitations in ${selectedWorkspace?.name ?? 'this workspace'} update automatically while recipients work online. This view refreshes every 30 seconds.` : 'Local-only invitations remain invited until their return file is imported here.'}</p>
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
