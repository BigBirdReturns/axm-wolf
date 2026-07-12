import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { commitResponse, createRecord, digestPack, validatePack } from '../../src/engine/index.js';
import { loadRecord, openWolfDb, saveRecord, type WolfDb } from '../../src/storage/index.js';
import { clearAllData } from '../../src/storage/maintenance.js';
import { GuidedStartScreen } from '../../src/app/screens/GuidedStartScreen.js';
import type { StoredPack, WolfAppState } from '../../src/app/hooks/useWolfApp.js';

describe('GuidedStartScreen', () => {
  let db: WolfDb | null = null;

  afterEach(() => {
    sessionStorage.clear();
    db?.close();
    db = null;
  });

  it('explains the complete workflow and opens the first question with one action', async () => {
    const user = userEvent.setup();
    const pack = validatePack(genericPackJson);
    const storedPack: StoredPack = {
      packId: pack.packId,
      packVersion: pack.packVersion,
      digest: await digestPack(pack),
      trust: 'bundled',
      installedAt: '2026-07-12T12:00:00.000Z',
      pack,
    };
    db = await openWolfDb();
    await clearAllData(db);
    const navigate = vi.fn();
    const state: WolfAppState = {
      db,
      packs: [storedPack],
      records: [],
      loading: false,
      error: null,
      refreshRecords: vi.fn(async () => {}),
      refreshPacks: vi.fn(async () => {}),
      migrationSummary: null,
    };

    render(<GuidedStartScreen {...state} invitation={{ name: 'guided-start', packId: pack.packId }} onNavigate={navigate} />);

    expect(screen.getByText(/There is no timer, no required order/)).toBeInTheDocument();
    expect(screen.getByText(/Voice input creates text; WOLF does not keep an audio recording/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Begin with the first question' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^#\/record\/[^/]+\/prompt\//)));
    expect(sessionStorage.getItem('axm-wolf-guided-pack')).toBe(pack.packId);
  });

  it('fails plainly when an invitation references an unavailable pack', async () => {
    db = await openWolfDb();
    await clearAllData(db);
    const state: WolfAppState = {
      db,
      packs: [],
      records: [],
      loading: false,
      error: null,
      refreshRecords: vi.fn(async () => {}),
      refreshPacks: vi.fn(async () => {}),
      migrationSummary: null,
    };
    render(<GuidedStartScreen {...state} invitation={{ name: 'guided-start', packId: 'missing' }} onNavigate={() => {}} />);
    expect(screen.getByRole('heading', { name: 'This invitation is not available' })).toBeInTheDocument();
    expect(screen.getByText(/Ask the sender for an updated link/)).toBeInTheDocument();
  });

  it('resumes an existing response at the next unanswered question', async () => {
    const user = userEvent.setup();
    const pack = validatePack(genericPackJson);
    const digest = await digestPack(pack);
    const storedPack: StoredPack = { packId: pack.packId, packVersion: pack.packVersion, digest, trust: 'bundled', installedAt: '2026-07-12T12:00:00.000Z', pack };
    db = await openWolfDb();
    await clearAllData(db);
    let record = createRecord({ recordId: 'existing-guided', pack, packDigest: digest, appVersion: '0.1.0' });
    record = commitResponse(record, pack.prompts[0].id, 'First answer', 'typed', '2026-07-12T12:00:00.000Z');
    await saveRecord(db, record);
    const navigate = vi.fn();
    const state: WolfAppState = { db, packs: [storedPack], records: [{ recordId: record.recordId, title: record.title, status: record.status, updatedAt: record.updatedAt, packId: pack.packId }], loading: false, error: null, refreshRecords: vi.fn(async () => {}), refreshPacks: vi.fn(async () => {}), migrationSummary: null };
    render(<GuidedStartScreen {...state} invitation={{ name: 'guided-start', packId: pack.packId }} onNavigate={navigate} />);

    await user.click(screen.getByRole('button', { name: 'Continue where I stopped' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(pack.prompts[1].id))));
  });

  it('uses invitation identity for the returned record and recipient-facing labels', async () => {
    const user = userEvent.setup();
    const pack = validatePack(genericPackJson);
    const storedPack: StoredPack = { packId: pack.packId, packVersion: pack.packVersion, digest: await digestPack(pack), trust: 'bundled', installedAt: '2026-07-12T12:00:00.000Z', pack };
    db = await openWolfDb();
    await clearAllData(db);
    const navigate = vi.fn();
    const state: WolfAppState = { db, packs: [storedPack], records: [], loading: false, error: null, refreshRecords: vi.fn(async () => {}), refreshPacks: vi.fn(async () => {}), migrationSummary: null };
    render(<GuidedStartScreen {...state} invitation={{ name: 'guided-start', packId: pack.packId, assignmentId: 'assignment-lotus', recipientLabel: 'Lotus', surveyLabel: 'July field report' }} onNavigate={navigate} />);

    expect(screen.getByText('Lotus')).toBeInTheDocument();
    expect(screen.getByText('July field report')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Begin with the first question' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const stored = await loadRecord(db, 'assignment-lotus');
    expect(stored?.subject.displayName).toBe('Lotus');
    expect(stored?.title).toContain('July field report');
  });
});
