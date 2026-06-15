import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PromptScreen } from '../../src/app/screens/PromptScreen.js';
import { openWolfDb, saveRecord } from '../../src/storage/index.js';
import { createRecord, validatePack, digestPack } from '../../src/engine/index.js';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };

/**
 * DESIGN.md 10.3, 2.7: speech input is a progressive enhancement gated on
 * `isSpeechSupported()` (speechAdapter.ts), which checks for
 * `window.SpeechRecognition` / `window.webkitSpeechRecognition`. When
 * neither is present, PromptScreen renders neither the voice control button
 * nor the speech disclosure block.
 *
 * Sub-case (b) -- a mocked SpeechRecognition whose `start()` synchronously
 * fires an `onerror` with `error: 'not-allowed'`, surfacing the
 * permission-denied message -- is DEFERRED. createSpeechSession (speechAdapter.ts)
 * wires `onstart`/`onresult`/`onerror`/`onend` onto a `new Ctor()` instance
 * created inside `start()`, and useSpeechInput only re-renders `speech.error`
 * after React processes the resulting state update; reliably triggering and
 * observing that update without flakiness needs more event-loop
 * choreography than is worth the marginal coverage here, so only (a) is
 * implemented.
 */
async function renderPromptScreen() {
  const pack = validatePack(genericPackJson);
  const digest = await digestPack(pack);
  const db = await openWolfDb();
  const record = createRecord({
    recordId: 'record-speech',
    pack,
    packDigest: digest,
    appVersion: '0.1.0',
  });
  await saveRecord(db, record);
  const promptId = pack.prompts[0].id;
  render(<PromptScreen db={db} recordId={record.recordId} promptId={promptId} onNavigate={() => {}} />);
}

describe('speech input availability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // Ensure no SpeechRecognition leaks between tests/files.
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  it('hides the voice control and disclosure when SpeechRecognition is unsupported', async () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    await renderPromptScreen();

    await screen.findByLabelText('Your response');

    // Source: PromptScreen.tsx -- `{speech.supported ? (<button ... aria-pressed={speech.listening}>...Start voice input</button>) : null}`.
    expect(screen.queryByRole('button', { name: 'Start voice input' })).not.toBeInTheDocument();

    // Source: PromptScreen.tsx -- the speech disclosure paragraph, rendered
    // only inside `{speech.supported ? (<div className="prompt-screen__speech">...` .
    expect(
      screen.queryByText(
        /Voice input availability and network use depend on your browser/,
      ),
    ).not.toBeInTheDocument();
  });

  it('shows the voice control when SpeechRecognition is present', async () => {
    class FakeSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: unknown = null;
      onerror: unknown = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      start(): void {}
      stop(): void {}
    }
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition);

    await renderPromptScreen();

    await screen.findByLabelText('Your response');

    expect(screen.getByRole('button', { name: 'Start voice input' })).toBeInTheDocument();
    expect(
      screen.getByText(/Voice input availability and network use depend on your browser/),
    ).toBeInTheDocument();
  });
});
