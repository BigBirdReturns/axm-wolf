import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromptScreen } from '../../src/app/screens/PromptScreen.js';
import { openWolfDb, saveRecord } from '../../src/storage/index.js';
import { createRecord, validatePack, digestPack } from '../../src/engine/index.js';
import contractingPackJson from '../../src/packs/contracting-officers-deposition/contracting-officers-deposition.wolfpack.json' with { type: 'json' };

/**
 * docs/METHODOLOGY.md section 7: `suggestedFollowUp` is a reviewer-facing
 * "go deeper" hint authored on some prompts. It must be surfaced as a
 * secondary, opt-in, collapsed-by-default disclosure that never competes
 * with the prompt text or context cue.
 *
 * Source pack: contracting-officers-deposition.wolfpack.json --
 * `authority.closest-to-refusing` has a non-empty `suggestedFollowUp`,
 * while `authority.first-warrant-signature` has none.
 */
describe('PromptScreen suggestedFollowUp disclosure', () => {
  it('shows a collapsed "Go deeper" disclosure that reveals suggestedFollowUp on expand', async () => {
    const user = userEvent.setup();
    const pack = validatePack(contractingPackJson);
    const digest = await digestPack(pack);
    const db = await openWolfDb();

    const record = createRecord({
      recordId: 'record-followup',
      pack,
      packDigest: digest,
      appVersion: '0.1.0',
    });
    await saveRecord(db, record);

    const promptId = 'authority.closest-to-refusing';
    const prompt = pack.prompts.find((p) => p.id === promptId);
    const followUp = prompt?.suggestedFollowUp;
    expect(followUp).toBeTruthy();

    render(<PromptScreen db={db} recordId={record.recordId} promptId={promptId} onNavigate={() => {}} />);

    const toggle = await screen.findByRole('button', { name: /go deeper/i });
    expect(toggle).toBeInTheDocument();

    // Collapsed by default: the follow-up text is not visible.
    expect(screen.queryByText(followUp as string)).not.toBeInTheDocument();

    await user.click(toggle);

    expect(await screen.findByText(followUp as string)).toBeVisible();
  });

  it('renders no disclosure when the prompt has no suggestedFollowUp', async () => {
    const pack = validatePack(contractingPackJson);
    const digest = await digestPack(pack);
    const db = await openWolfDb();

    const record = createRecord({
      recordId: 'record-no-followup',
      pack,
      packDigest: digest,
      appVersion: '0.1.0',
    });
    await saveRecord(db, record);

    const promptId = 'authority.first-warrant-signature';
    const prompt = pack.prompts.find((p) => p.id === promptId);
    expect(prompt?.suggestedFollowUp ?? null).toBeNull();

    render(<PromptScreen db={db} recordId={record.recordId} promptId={promptId} onNavigate={() => {}} />);

    await screen.findByLabelText('Your response');

    expect(screen.queryByRole('button', { name: /go deeper/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/go deeper/i)).not.toBeInTheDocument();
  });
});
