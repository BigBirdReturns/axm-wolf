import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { buildRecordBundle, commitResponse, createRecord, digestPack, validatePack } from '../../src/engine/index.js';
import {
  listSurveyAssignments,
  loadRecord,
  openWolfDb,
  saveSurveyAssignment,
  type WolfDb,
} from '../../src/storage/index.js';
import { clearAllData } from '../../src/storage/maintenance.js';
import { RecordsScreen } from '../../src/app/screens/RecordsScreen.js';
import type { StoredPack, WolfAppState } from '../../src/app/hooks/useWolfApp.js';

describe('Survey dashboard', () => {
  let db: WolfDb | null = null;

  afterEach(() => {
    db?.close();
    db = null;
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('opens an authenticated operator inside only their assigned workspace', async () => {
    const { state } = await setupState();
    window.history.replaceState({}, '', '/wolf/dashboard');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
      if (path === '/wolf/api/operator/session') return new Response(JSON.stringify({ identity: { email: 'helen@example.com', isRoot: false }, workspaces: [{ id: 'helen', name: "Helen's interviews", slug: 'helen', role: 'steward' }] }), { status: 200 });
      if (path.endsWith('/surveys')) return new Response(JSON.stringify({ surveys: [] }), { status: 200 });
      if (path.endsWith('/members')) return new Response(JSON.stringify({ members: [{ email: 'helen@example.com', role: 'steward', status: 'active', created_at: '2026-07-12T10:00:00.000Z' }] }), { status: 200 });
      return new Response(JSON.stringify({ error: `Unexpected path ${path}` }), { status: 404 });
    }));

    const { unmount } = render(<RecordsScreen {...state} />);

    expect(await screen.findByText(/Signed in as/)).toHaveTextContent('helen@example.com');
    expect(screen.getByLabelText('Workspace')).toHaveValue('helen');
    expect(await screen.findByText(/Current members:/)).toHaveTextContent('helen@example.com (steward)');
    expect(await screen.findByText(/No live interviews have been created/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Helen → Lotus playtest' })).toBeInTheDocument();
    expect(screen.getByText(/neither person said them/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create another workspace' })).not.toBeInTheDocument();
    unmount();
  });

  async function setupState(): Promise<{ state: WolfAppState; pack: ReturnType<typeof validatePack> }> {
    const pack = validatePack(genericPackJson);
    const storedPack: StoredPack = { packId: pack.packId, packVersion: pack.packVersion, digest: await digestPack(pack), trust: 'bundled', installedAt: '2026-07-12T10:00:00.000Z', pack };
    db = await openWolfDb();
    await clearAllData(db);
    const state: WolfAppState = { db, packs: [storedPack], records: [], loading: false, error: null, refreshRecords: vi.fn(async () => {}), refreshPacks: vi.fn(async () => {}), migrationSummary: null };
    return { state, pack };
  }

  it('creates a labeled invitation and exposes it in the pipeline', async () => {
    const user = userEvent.setup();
    const { state } = await setupState();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<RecordsScreen {...state} />);

    await user.type(screen.getByLabelText('Recipient label'), 'Lotus');
    await user.type(screen.getByLabelText('Survey or campaign label'), 'July walkthrough');
    await user.click(screen.getByRole('button', { name: 'Create and copy invitation' }));

    expect(await screen.findByRole('heading', { name: 'Lotus' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Recipient label'), 'Orchid');
    await user.type(screen.getByLabelText('Survey or campaign label'), 'August walkthrough');
    await user.click(screen.getByRole('button', { name: 'Create and copy invitation' }));
    expect(await screen.findByRole('heading', { name: 'Orchid' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText.mock.calls[0]?.[0]).toContain('recipient=Lotus');
    const assignments = await listSurveyAssignments(db!);
    expect(assignments).toHaveLength(2);
    expect(new Set(assignments.map((assignment) => assignment.assignmentId)).size).toBe(2);
    expect(assignments.every((assignment) => assignment.status === 'invited')).toBe(true);
  });

  it('reviews synchronized raw testimony in place and keeps analysis separate', async () => {
    const user = userEvent.setup();
    const { state, pack } = await setupState();
    window.history.replaceState({}, '', '/wolf/dashboard');
    let record = createRecord({ recordId: 'SUR01', pack, packDigest: await digestPack(pack), appVersion: '0.4.0', subject: { displayName: 'Helen' } });
    record = commitResponse(record, 'operations.normal-day', 'I check the overnight notes first.', 'typed', '2026-07-13T16:00:00.000Z');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
      if (path === '/wolf/api/operator/session') return new Response(JSON.stringify({ identity: { email: 'owner@example.com', isRoot: true }, workspaces: [{ id: 'root', name: 'AXM', slug: 'axm', role: 'owner' }] }), { status: 200 });
      if (path === '/wolf/api/operator/workspaces/root/surveys') return new Response(JSON.stringify({ surveys: [{ code: 'SUR01', workspace_id: 'root', pack_id: pack.packId, recipient_label: 'Helen', survey_label: 'Field memory', status: 'submitted', revision: 2, has_record: 1, has_analysis: 0, analysis_created_at: null, analysis_consent: 1, analysis_consent_at: '2026-07-13T16:00:00.000Z', created_at: '2026-07-13T15:00:00.000Z', started_at: '2026-07-13T15:30:00.000Z', submitted_at: '2026-07-13T16:00:00.000Z', updated_at: '2026-07-13T16:00:00.000Z' }] }), { status: 200 });
      if (path === '/wolf/api/operator/workspaces/root/members') return new Response(JSON.stringify({ members: [] }), { status: 200 });
      if (path === '/wolf/api/operator/surveys/SUR01') return new Response(JSON.stringify({ code: 'SUR01', status: 'submitted', revision: 2, record, analysis: null, analysisConsent: true, analysisConsentAt: '2026-07-13T16:00:00.000Z' }), { status: 200 });
      return new Response(JSON.stringify({ error: `Unexpected path ${path}` }), { status: 404 });
    }));

    render(<RecordsScreen {...state} />);
    await user.click(await screen.findByRole('button', { name: 'Review interview here' }));
    expect(await screen.findByText('I check the overnight notes first.')).toBeInTheDocument();
    expect(screen.getByText('RAW TESTIMONY')).toBeInTheDocument();
    expect(screen.getByText(/No model return exists/)).toBeInTheDocument();
  });

  it('bulk-imports a matching returned record and moves it to received', async () => {
    const user = userEvent.setup();
    const { state, pack } = await setupState();
    const assignmentId = 'assignment-returned';
    await saveSurveyAssignment(db!, { assignmentId, packId: pack.packId, recipientLabel: 'Lotus', surveyLabel: 'July walkthrough', status: 'invited', createdAt: '2026-07-12T10:00:00.000Z', updatedAt: '2026-07-12T10:00:00.000Z', receivedAt: null });
    const record = createRecord({ recordId: assignmentId, pack, packDigest: await digestPack(pack), appVersion: '0.1.0', title: 'July walkthrough — Lotus', subject: { displayName: 'Lotus' } });
    const file = new File([JSON.stringify(buildRecordBundle(record, { includeDrafts: true }))], 'lotus.wolfrecord.json', { type: 'application/json' });
    render(<RecordsScreen {...state} />);

    await user.upload(screen.getByLabelText('Choose returned files'), file);
    expect(await screen.findByText(/Imported 1 return/)).toBeInTheDocument();
    await waitFor(async () => expect((await listSurveyAssignments(db!))[0]?.status).toBe('received'));
    expect(await loadRecord(db!, assignmentId)).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Open returned answers' })).toBeInTheDocument();
  });
});
