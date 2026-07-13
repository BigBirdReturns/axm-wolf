import type { WolfRecord } from '../../engine/index.js';

const HOSTED_SESSION_KEY = 'axm-wolf-hosted-session';

export type HostedSurveySession = {
  code: string;
  token: string;
  revision: number;
};

export type HostedBootstrap = {
  code: string;
  packId: string;
  recipientLabel: string;
  surveyLabel: string;
  status: string;
  revision: number;
  record: WolfRecord | null;
  analysis: { id: string; payload: unknown; createdAt: string } | null;
};

export type HostedSurveySummary = {
  code: string;
  workspace_id: string;
  pack_id: string;
  recipient_label: string;
  survey_label: string;
  status: string;
  revision: number;
  has_record: number;
  created_at: string;
  started_at: string | null;
  submitted_at: string | null;
  updated_at: string;
};

export type HostedWorkspace = { id: string; name: string; slug: string; role: 'owner' | 'steward' | 'interviewer' | 'viewer' };
export type HostedOperatorSession = { identity: { email: string; isRoot: boolean }; workspaces: HostedWorkspace[] };
export type HostedMember = { email: string; role: 'steward' | 'interviewer' | 'viewer'; status: string; created_at: string };

export function hostedSurveyCode(pathname = window.location.pathname): string | null {
  const match = pathname.match(/\/wolf\/(SUR\d+)\/?$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function isHostedDashboard(pathname = window.location.pathname): boolean {
  return /\/wolf\/dashboard\/?$/i.test(pathname);
}

export function invitationToken(hash = window.location.hash): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return params.get('k');
}

export function rememberHostedSession(session: HostedSurveySession): void {
  localStorage.setItem(HOSTED_SESSION_KEY, JSON.stringify(session));
}

export function hostedSessionForRecord(recordId: string): HostedSurveySession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOSTED_SESSION_KEY) ?? 'null') as HostedSurveySession | null;
    return parsed?.code === recordId && parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

export async function bootstrapHostedSurvey(code: string, token: string): Promise<HostedBootstrap> {
  return apiJson(`/wolf/api/surveys/${encodeURIComponent(code)}/bootstrap`, { headers: recipientHeaders(token) });
}

export async function syncHostedRecord(record: WolfRecord, submitted = false): Promise<{ revision: number; status: string }> {
  const session = hostedSessionForRecord(record.recordId);
  if (!session) throw new Error('This record is not connected to a hosted invitation.');
  const result = await apiJson<{ revision: number; status: string }>(
    `/wolf/api/surveys/${encodeURIComponent(session.code)}/${submitted ? 'submit' : 'sync'}`,
    {
      method: submitted ? 'POST' : 'PUT',
      headers: recipientHeaders(session.token),
      body: JSON.stringify({ baseRevision: session.revision, record }),
    },
  );
  rememberHostedSession({ ...session, revision: result.revision });
  return result;
}

export async function getHostedOperatorSession(): Promise<HostedOperatorSession> {
  return apiJson('/wolf/api/operator/session', { headers: jsonHeaders() });
}

export async function createHostedWorkspace(name: string): Promise<HostedWorkspace> {
  return apiJson('/wolf/api/operator/workspaces', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ name }) });
}

export async function listHostedMembers(workspaceId: string): Promise<HostedMember[]> {
  const result = await apiJson<{ members: HostedMember[] }>(`/wolf/api/operator/workspaces/${encodeURIComponent(workspaceId)}/members`, { headers: jsonHeaders() });
  return result.members;
}

export async function addHostedMember(workspaceId: string, email: string, role: HostedMember['role']): Promise<void> {
  await apiJson(`/wolf/api/operator/workspaces/${encodeURIComponent(workspaceId)}/members`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ email, role }) });
}

export async function listHostedSurveys(workspaceId: string): Promise<HostedSurveySummary[]> {
  const result = await apiJson<{ surveys: HostedSurveySummary[] }>(`/wolf/api/operator/workspaces/${encodeURIComponent(workspaceId)}/surveys`, { headers: jsonHeaders() });
  return result.surveys;
}

export async function createHostedSurvey(
  workspaceId: string,
  input: { packId: string; recipientLabel: string; surveyLabel: string },
): Promise<{ code: string; token: string; invitationUrl: string; createdAt: string; status: string }> {
  return apiJson(`/wolf/api/operator/workspaces/${encodeURIComponent(workspaceId)}/surveys`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
}

export async function updateHostedSurveyStatus(code: string, status: string): Promise<void> {
  await apiJson(`/wolf/api/operator/surveys/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function fetchHostedRecord(code: string): Promise<WolfRecord | null> {
  const result = await apiJson<{ record: WolfRecord | null }>(`/wolf/api/operator/surveys/${encodeURIComponent(code)}/record`, { headers: jsonHeaders() });
  return result.record;
}

export async function uploadHostedAnalysis(code: string, payload: unknown): Promise<void> {
  await apiJson(`/wolf/api/operator/surveys/${encodeURIComponent(code)}/analysis`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ payload }),
  });
}

export async function getHostedUpdates(recordId: string): Promise<{ status: string; analysis: { id: string; payload: unknown; createdAt: string } | null } | null> {
  const session = hostedSessionForRecord(recordId);
  if (!session) return null;
  return apiJson(`/wolf/api/surveys/${encodeURIComponent(session.code)}/updates`, { headers: recipientHeaders(session.token) });
}

function recipientHeaders(token: string): HeadersInit {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

function jsonHeaders(): HeadersInit { return { 'content-type': 'application/json' }; }

async function apiJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? `WOLF service returned ${response.status}.`);
  return payload;
}
