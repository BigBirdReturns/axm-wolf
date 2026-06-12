// Speech input hook (DESIGN.md 10.3, 2.7).
//
// Thin React wrapper over speechAdapter. Appends final transcripts to the
// existing draft text via `appendTranscript`, preserving whatever the
// subject has already typed. Never commits anything itself.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSpeechSession,
  isSpeechSupported,
  type SpeechErrorKind,
  type SpeechSession,
  type SpeechState,
} from './speechAdapter.js';

export type UseSpeechInputResult = {
  supported: boolean;
  listening: boolean;
  error: SpeechErrorKind | null;
  start: () => void;
  stop: () => void;
};

/**
 * Appends `transcript` to `existingText`, inserting a single space
 * separator when `existingText` is non-empty and does not already end in
 * whitespace. Always preserves the existing text.
 */
export function appendTranscript(existingText: string, transcript: string): string {
  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript.length === 0) return existingText;
  if (existingText.length === 0) return trimmedTranscript;
  const needsSeparator = !/\s$/.test(existingText);
  return existingText + (needsSeparator ? ' ' : '') + trimmedTranscript;
}

/**
 * Provides voice input controls for the prompt response textarea.
 *
 * `getText`/`onAppend` are used (rather than a single current value) so
 * the caller can read the latest text at the moment a transcript arrives
 * without this hook needing to be re-created on every keystroke.
 */
export function useSpeechInput(
  lang: string,
  getText: () => string,
  onAppend: (newText: string) => void,
): UseSpeechInputResult {
  const [supported] = useState(() => isSpeechSupported());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechErrorKind | null>(null);

  const sessionRef = useRef<SpeechSession | null>(null);
  const getTextRef = useRef(getText);
  getTextRef.current = getText;
  const onAppendRef = useRef(onAppend);
  onAppendRef.current = onAppend;

  useEffect(() => {
    if (!supported) return;

    sessionRef.current = createSpeechSession({
      lang,
      onFinalTranscript: (text) => {
        setError(null);
        const next = appendTranscript(getTextRef.current(), text);
        onAppendRef.current(next);
      },
      onStateChange: (state: SpeechState) => {
        setListening(state === 'listening');
      },
      onError: (kind) => {
        setError(kind);
        setListening(false);
      },
    });

    return () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [supported, lang]);

  const start = useCallback(() => {
    setError(null);
    sessionRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  return { supported, listening, error, start, stop };
}
