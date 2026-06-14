import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RecordHomeScreen } from '../../src/app/screens/RecordHomeScreen.js';
import { openWolfDb, saveRecord } from '../../src/storage/index.js';
import { createRecord, validatePack, digestPack } from '../../src/engine/index.js';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };

/**
 * The generic fixture has no recommendedCadence, so for the "recurring
 * cadence" case we clone it and add a 'weekly' cadence (7-day interval).
 * createRecord's `now` input lets us pin `createdAt`/`updatedAt` to a
 * timestamp far enough in the past (30 days) that the record is stale
 * relative to the weekly cadence, without needing fake timers.
 */
describe('cadence nudge', () => {
  it('shows a dismissible nudge for a stale record from a recurring-cadence pack', async () => {
    const user = userEvent.setup();
    const packJson = { ...genericPackJson, recommendedCadence: 'weekly' };
    const pack = validatePack(packJson);
    const digest = await digestPack(pack);
    const db = await openWolfDb();

    const staleTimestamp = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const record = createRecord({
      recordId: 'record-stale',
      pack,
      packDigest: digest,
      appVersion: '0.1.0',
      now: staleTimestamp,
    });
    await saveRecord(db, record);

    render(<RecordHomeScreen db={db} recordId={record.recordId} onNavigate={() => {}} />);

    const nudge = await screen.findByText(/This pack suggests a weekly rhythm/);
    expect(nudge).toBeInTheDocument();

    const dismiss = screen.getByRole('button', { name: 'Dismiss cadence reminder' });
    await user.click(dismiss);

    expect(screen.queryByText(/This pack suggests a weekly rhythm/)).not.toBeInTheDocument();
  });

  it('shows no nudge for a recently-updated record', async () => {
    const packJson = { ...genericPackJson, recommendedCadence: 'weekly' };
    const pack = validatePack(packJson);
    const digest = await digestPack(pack);
    const db = await openWolfDb();

    const record = createRecord({
      recordId: 'record-fresh',
      pack,
      packDigest: digest,
      appVersion: '0.1.0',
    });
    await saveRecord(db, record);

    render(<RecordHomeScreen db={db} recordId={record.recordId} onNavigate={() => {}} />);

    await screen.findByText(record.title);
    expect(screen.queryByText(/suggests a weekly rhythm/)).not.toBeInTheDocument();
  });

  it('shows no nudge for a stale record from a "once" pack', async () => {
    const packJson = { ...genericPackJson, recommendedCadence: 'once' };
    const pack = validatePack(packJson);
    const digest = await digestPack(pack);
    const db = await openWolfDb();

    const staleTimestamp = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const record = createRecord({
      recordId: 'record-once-stale',
      pack,
      packDigest: digest,
      appVersion: '0.1.0',
      now: staleTimestamp,
    });
    await saveRecord(db, record);

    render(<RecordHomeScreen db={db} recordId={record.recordId} onNavigate={() => {}} />);

    await screen.findByText(record.title);
    expect(screen.queryByRole('button', { name: 'Dismiss cadence reminder' })).not.toBeInTheDocument();
  });
});
