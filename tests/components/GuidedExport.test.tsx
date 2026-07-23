import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { createRecord, digestPack, validatePack } from '../../src/engine/index.js';
import { openWolfDb, saveRecord } from '../../src/storage/index.js';
import { clearAllData } from '../../src/storage/maintenance.js';
import { ExportScreen } from '../../src/app/screens/ExportScreen.js';
import { rememberHostedSession } from '../../src/app/lib/hosted.js';

describe('guided record delivery', () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens the device share flow with a complete record attachment', async () => {
    const user = userEvent.setup();
    const pack = validatePack(genericPackJson);
    const db = await openWolfDb();
    await clearAllData(db);
    const record = createRecord({ recordId: 'guided-export', pack, packDigest: await digestPack(pack), appVersion: '0.1.0' });
    await saveRecord(db, record);
    sessionStorage.setItem('axm-wolf-guided-pack', pack.packId);
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    render(<ExportScreen db={db} recordId={record.recordId} onNavigate={() => {}} onRecordDeleted={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Send your answers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to my answers' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Send my answers' }));

    expect(share).toHaveBeenCalledOnce();
    const data = share.mock.calls[0]?.[0] as ShareData;
    expect(data.files?.[0]?.name).toMatch(/\.wolfrecord\.json$/);
    expect(await screen.findByText(/opened its share options/)).toBeInTheDocument();
    db.close();
  });

  it('records an explicit optional manual-analysis choice on hosted submission', async () => {
    const user = userEvent.setup();
    const pack = validatePack(genericPackJson);
    const db = await openWolfDb();
    await clearAllData(db);
    const record = createRecord({ recordId: 'SUR01', pack, packDigest: await digestPack(pack), appVersion: '0.4.0' });
    await saveRecord(db, record);
    sessionStorage.setItem('axm-wolf-guided-pack', pack.packId);
    rememberHostedSession({ code: 'SUR01', token: 'private-token', revision: 0 });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ revision: 1, status: 'submitted' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ExportScreen db={db} recordId={record.recordId} onNavigate={() => {}} onRecordDeleted={() => {}} />);
    await user.click(await screen.findByLabelText(/Allow a frozen copy/));
    await user.click(screen.getByRole('button', { name: 'Submit my answers' }));

    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string).analysisConsent).toBe(true);
    expect(await screen.findByText(/Submitted. Your interviewer can now open/)).toBeInTheDocument();
    db.close();
  });
});
