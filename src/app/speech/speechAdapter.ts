// Speech recognition adapter (DESIGN.md 10.3, 2.7).
//
// Wraps the browser's SpeechRecognition API behind a small interface so
// that no component touches the vendor API directly. This is a
// progressive enhancement: it is not part of the offline guarantee
// (DESIGN 2.7, AGENTS.md invariants).
//
// Only FINAL transcripts are surfaced (continuous: false,
// interimResults: false), per DESIGN 10.3.

export type SpeechState = 'idle' | 'listening';

export type SpeechErrorKind = 'permission-denied' | 'no-speech' | 'network' | 'unknown';

export type SpeechSessionOptions = {
  lang: string;
  onFinalTranscript: (text: string) => void;
  onStateChange: (state: SpeechState) => void;
  onError: (kind: SpeechErrorKind) => void;
};

export type SpeechSession = {
  start: () => void;
  stop: () => void;
};

// Minimal shape of the vendor SpeechRecognition API -- only what this
// adapter uses. Avoids depending on @types/dom-speech-recognition or
// similar, which are not part of this project's dependencies.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { [index: number]: SpeechRecognitionResultLike; length: number };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether the browser exposes a SpeechRecognition implementation. */
export function isSpeechSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

function mapErrorKind(error: string): SpeechErrorKind {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied';
    case 'no-speech':
      return 'no-speech';
    case 'network':
      return 'network';
    default:
      return 'unknown';
  }
}

/**
 * Creates a speech recognition session. Returns `start`/`stop` controls
 * and reports final transcripts, listening state changes, and errors via
 * the provided callbacks.
 *
 * Returns a no-op session if the browser does not support speech
 * recognition; callers should check `isSpeechSupported()` first.
 */
export function createSpeechSession(opts: SpeechSessionOptions): SpeechSession {
  const Ctor = getSpeechRecognitionConstructor();
  if (!Ctor) {
    return {
      start: () => {
        opts.onError('unknown');
      },
      stop: () => {},
    };
  }

  let recognition: SpeechRecognitionLike | null = null;

  function teardown(): void {
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      recognition = null;
    }
  }

  return {
    start(): void {
      teardown();
      const instance = new Ctor();
      instance.lang = opts.lang;
      instance.continuous = false;
      instance.interimResults = false;

      instance.onstart = () => {
        opts.onStateChange('listening');
      };

      instance.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) {
            const transcript = result[0]?.transcript ?? '';
            if (transcript.trim().length > 0) {
              opts.onFinalTranscript(transcript);
            }
          }
        }
      };

      instance.onerror = (event) => {
        opts.onError(mapErrorKind(event.error));
      };

      instance.onend = () => {
        opts.onStateChange('idle');
      };

      recognition = instance;
      instance.start();
    },
    stop(): void {
      if (recognition) {
        recognition.stop();
      }
    },
  };
}
