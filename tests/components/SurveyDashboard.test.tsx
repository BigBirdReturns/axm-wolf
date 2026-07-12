import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { buildRecordBundle, createRecord, digestPack, validatePack } from '../../src/engine/index.js';
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
