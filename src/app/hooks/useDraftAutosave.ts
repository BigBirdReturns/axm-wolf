// Draft autosave hook (DESIGN.md 8.2, 2.8, 10.6).
//
// Debounces saveDraft calls while the subject is typing, surfaces a
// status string suitable for an aria-live='polite' region, and exposes a
// `flush` function that saves immediately (used on visibilitychange and
// before commit).

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDraft, type WolfDb } from '../../storage/index.js';

export type DraftAutosaveStatus = 'idle' | 'saving' | 'saved' | 'save-failed';

const DEBOUNCE_MS = 600;

/**
 * Pure scheduling helper, extracted so the debounce behavior is testable
 * under node:test without React or the DOM.
 *
 * `schedule(run)` cancels any previously scheduled call and arranges for
 * `run` to be invoked after `delayMs`. `cancel()` cancels a pending call
 * without running it. `flush()` runs (and clears) any pending call
 * immediately, synchronously.
 */
export function createDebounceScheduler(delayMs: number): {
  schedule: (run: () => void) => void;
  cancel: () => void;
  flush: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  }

  function schedule(run: () => void): void {
    cancel();
    pending = run;
    timer = setTimeout(() => {
      timer = null;
      const fn = pending;
      pending = null;
      if (fn) fn();
    }, delayMs);
  }

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const fn = pending;
    pending = null;
    if (fn) fn();
  }

  return { schedule, cancel, flush };
}

export type UseDraftAutosaveResult = {
  text: string;
  setText: (text: string) => void;
  status: DraftAutosaveStatus;
  /** Saves the current text immediately, bypassing the debounce. */
  flush: () => Promise<void>;
};

/**
 * Manages draft text for one (recordId, promptId), autosaving via
 * `saveDraft` after `DEBOUNCE_MS` of inactivity.
 *
 * `initialText` seeds the textarea on mount (see PromptScreen for how this
 * is chosen between an existing draft and the current revision text).
 */
export function useDraftAutosave(
  db: WolfDb | null,
  recordId: string,
  promptId: string,
  initialText: string,
  afterLocalSave?: () => Promise<void>,
): UseDraftAutosaveResult {
  const [text, setTextState] = useState(initialText);
  const [status, setStatus] = useState<DraftAutosaveStatus>('idle');

  const textRef = useRef(text);
  textRef.current = text;

  const schedulerRef = useRef(createDebounceScheduler(DEBOUNCE_MS));

  const save = useCallback(async (value: string) => {
    if (!db) return;
    setStatus('saving');
    try {
      await saveDraft(db, recordId, promptId, value);
      setStatus('saved');
      if (afterLocalSave) await afterLocalSave().catch(() => undefined);
    } catch {
      setStatus('save-failed');
    }
  }, [afterLocalSave, db, recordId, promptId]);

  const flush = useCallback(async () => {
    schedulerRef.current.cancel();
    await save(textRef.current);
  }, [save]);

  const setText = useCallback((value: string) => {
    setTextState(value);
    schedulerRef.current.schedule(() => {
      void save(value);
    });
  }, [save]);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'hidden') {
        void flush();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      schedulerRef.current.cancel();
    };
  }, [flush]);

  return { text, setText, status, flush };
}
