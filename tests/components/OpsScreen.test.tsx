import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OpsScreen } from '../../src/app/screens/OpsScreen.js';
import { clearAllData } from '../../src/storage/maintenance.js';
import { openWolfDb } from '../../src/storage/index.js';

describe('OpsScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });
  it('requires branch-changing facts before directing the first camera view', async () => {
    const db = await openWolfDb();
    await clearAllData(db);
    const view = render(<OpsScreen db={db} />);

    await screen.findByRole('heading', { name: 'See the system before choosing the fix' });
    expect(screen.getByRole('heading', { name: 'Send a frozen copy; keep working' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send for analysis' })).toBeInTheDocument();
    expect(screen.getByText(/Handoff files contain unencrypted operational evidence/)).toBeInTheDocument();
    expect(
      screen.getByText('Answer the required branch-changing facts to generate the next evidence request.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/smoke, sparking/), { target: { value: 'false' } });
    fireEvent.change(screen.getByLabelText(/multiple fixtures wink out/), { target: { value: 'unknown' } });
    fireEvent.change(screen.getByLabelText(/controlled by a dimmer/), { target: { value: 'unknown' } });
    fireEvent.change(screen.getByLabelText(/symptom change at a different dimmer position/), { target: { value: 'unknown' } });
    fireEvent.change(screen.getByLabelText(/manufacturer and model documented/), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText(/replacement or standardization path/), { target: { value: 'false' } });

    expect(await screen.findByRole('heading', { name: 'Whole-room fixture map' })).toBeInTheDocument();
    expect(
      screen.getByText(/Take one wide photograph showing the complete ceiling/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/non-dominated/).length).toBeGreaterThan(1);

    view.unmount();
    db.close();
  });

  it('switches to the cafe configuration without mixing the two local cases', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    await clearAllData(db);
    const view = render(<OpsScreen db={db} />);

    const selector = await screen.findByLabelText('Inspection configuration');
    await user.selectOptions(selector, 'cafe-display');

    expect(await screen.findByLabelText(/liquid intrusion/)).toBeInTheDocument();
    expect(screen.getByLabelText('Asset or system name *')).toHaveValue(
      'Customer-facing display inspection',
    );

    view.unmount();
    db.close();
  });

  it('persists an asset identity and records a source-separated symptom', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    await clearAllData(db);
    const view = render(<OpsScreen db={db} />);

    const assetName = await screen.findByLabelText('Asset or system name *');
    fireEvent.change(assetName, { target: { value: 'Unit B mixed recessed lights' } });
    fireEvent.change(screen.getByLabelText('Site'), { target: { value: 'Lotus' } });
    fireEvent.change(screen.getByLabelText('Exact location'), {
      target: { value: 'Unit B living room' },
    });
    await user.click(screen.getByRole('button', { name: 'Save asset passport' }));

    expect(
      await screen.findByRole('option', { name: /Unit B mixed recessed lights/ }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Observation kind'), 'reported_symptom');
    await user.selectOptions(screen.getByLabelText('Source class'), 'occupant_reported');
    fireEvent.change(screen.getByLabelText('Who or what supplied it'), {
      target: { value: 'Current occupant' },
    });
    fireEvent.change(screen.getByLabelText('Observation or report'), {
      target: { value: 'The lights wink out after they have been on for twenty minutes.' },
    });
    await user.click(screen.getByRole('button', { name: 'Add to observation ledger' }));

    expect(
      await screen.findByText('The lights wink out after they have been on for twenty minutes.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Current occupant/)).toBeInTheDocument();

    view.unmount();
    db.close();
  });

  it('opens and advances a persisted work order without skipping durable states', async () => {
    const user = userEvent.setup();
    const db = await openWolfDb();
    await clearAllData(db);
    const view = render(<OpsScreen db={db} />);

    await screen.findByLabelText('Stable issue code');
    fireEvent.change(screen.getByLabelText('Stable issue code'), {
      target: { value: 'lighting.intermittent' },
    });
    fireEvent.change(screen.getByLabelText('Work-order title'), {
      target: { value: 'Diagnose intermittent room lighting' },
    });
    await user.click(screen.getByRole('button', { name: 'Open work order' }));

    expect(await screen.findByRole('heading', { name: 'Diagnose intermittent room lighting' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Classify' }));
    expect(await screen.findByRole('button', { name: 'Triage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close durably' })).not.toBeInTheDocument();

    view.unmount();
    db.close();
  });

  it('appends a final spoken transcript to the editable observation without auto-saving', async () => {
    class FakeSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      start(): void {
        this.onstart?.();
        this.onresult?.({ resultIndex: 0, results: { 0: { 0: { transcript: 'Lights fail after twenty minutes' }, length: 1, isFinal: true }, length: 1 } });
        this.onend?.();
      }
      stop(): void { this.onend?.(); }
    }
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition);
    const user = userEvent.setup();
    const db = await openWolfDb();
    await clearAllData(db);
    const view = render(<OpsScreen db={db} />);

    const observation = await screen.findByLabelText('Observation or report');
    await user.click(screen.getByRole('button', { name: 'Speak observation' }));
    expect(observation).toHaveValue('Lights fail after twenty minutes');
    expect(screen.getByText('No sourced observations have been recorded for this case.')).toBeInTheDocument();

    view.unmount();
    db.close();
  });
});
