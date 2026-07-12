import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromptScreen } from '../../src/app/screens/PromptScreen.js';
import { openWolfDb, saveRecord } from '../../src/storage/index.js';
import { createRecord, validatePack, digestPack } from '../../src/engine/index.js';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };

/**
 * DESIGN.md 8.2, 10.2, 10.6: the prompt response textarea autosaves drafts
 * and announces status via an `aria-live="polite"` region.
 *
 * The full draft-saved announcement ('Draft saved — not yet on the
 * record.', PromptScreen.tsx `describeAutosaveStatus`) depends on a 600ms
 * debounce (useDraftAutosave.ts DEBOUNCE_MS) racing fake-indexeddb's own
 * async resolution. Rather than fake timers (which can deadlock against
 * fake-indexeddb's internal microtask/macrotask scheduling), this test
 * waits for the real debounce with a generous `findByText` timeout, which
 * is stable in practice for a single keystroke against an in-memory db.
 */
describe('PromptScreen', () => {
  afterEach(() => sessionStorage.clear());
  it('accepts textarea input and announces the draft-saved status via aria-live', async () => {
    const user = userEvent.setup();
    const pack = validatePack(genericPackJson);
    const digest = await digestPack(pack);
    const db = await openWolfDb();

    const record = createRecord({
      recordId: 'record-1',
      pack,
      packDigest: digest,
      appVersion: '0.1.0',
    });
    await saveRecord(db, record);

    const promptId = pack.prompts[0].id;
    render(<PromptScreen db={db} recordId={record.recordId} promptId={promptId} onNavigate={() => {}} />);

    // Source: PromptScreen.tsx -- `<label htmlFor="prompt-response">Your response</label>`.
    const textarea = await screen.findByLabelText('Your response');
    expect(textarea).toBeInTheDocument();

    // Source: PromptScreen.tsx -- `<p aria-live="polite" className="prompt-screen__status">`.
    const status = textarea.closest('.stack')!.querySelector('[aria-live="polite"]');
    expect(status).toBeTruthy();
    expect(status).toHaveAttribute('aria-live', 'polite');

    await user.type(textarea, 'A new draft answer');
    expect(textarea).toHaveValue('A new draft answer');

    // Source: PromptScreen.tsx `describeAutosaveStatus('saved')` ->
    // 'Draft saved — not yet on the record.'
    await screen.findByText(
      (content) => content.includes('Draft saved — not yet on the record.'),
      undefined,
      { timeout: 5000 },
    );
  }, 10000);

  it('explains voice, draft, commit, and stopping behavior in a guided session', async () => {
    const pack = validatePack(genericPackJson);
    const digest = await digestPack(pack);
    const db = await openWolfDb();
    const record = createRecord({ recordId: 'guided-record', pack, packDigest: digest, appVersion: '0.1.0' });
    await saveRecord(db, record);
    sessionStorage.setItem('axm-wolf-guided-pack', pack.packId);
    render(<PromptScreen db={db} recordId={record.recordId} promptId={pack.prompts[0].id} onNavigate={() => {}} />);

    expect(await screen.findByRole('heading', { name: 'How to answer this question' })).toBeInTheDocument();
    expect(screen.getByText(/Your draft saves while you work, but it is not part of the finished record/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose another question or finish' })).toBeInTheDocument();
    db.close();
  });
});
