# Component test layer (DESIGN.md 14.1, 14.5)

Vitest + jsdom + React Testing Library. Run with `npm run test:components`.
This layer is intentionally separate from the `npm run check` node:test gate
(see `vitest.config.ts` for the `include` restriction to `tests/components/**`).

## Coverage

- `LaunchScreen.test.tsx` -- platform vs single-pack deploy mode rendering.
- `RevisionHistory.test.tsx` -- revision list collapse/expand, newest-first ordering.
- `SettingsScreen.test.tsx` -- DESIGN 12.4 wipe-all confirmation gating
  (checkbox + confirm phrase, both required to enable "Delete all local data").
- `PacksScreen.test.tsx` -- invalid pack import (malformed JSON, and a
  structurally-invalid pack with a duplicate prompt id) surfaces a
  `role="alert"` validation message and installs nothing (`refreshPacks` not
  called).
- `PromptScreen.test.tsx` -- response textarea accepts input and the
  `aria-live="polite"` status region announces the draft-saved status
  ('Draft saved — not yet on the record.') after the autosave debounce.
- `speech.test.tsx` -- voice input control and disclosure are absent when
  `window.SpeechRecognition`/`webkitSpeechRecognition` are undefined, and
  present when a `SpeechRecognition` constructor is stubbed onto `window`.
- `install-fallback.test.tsx` -- LaunchScreen's manual "How to install"
  fallback appears when not standalone and no `beforeinstallprompt` was
  captured, and neither install action appears when
  `matchMedia('(display-mode: standalone)')` matches.

## Deferred

- `speech.test.tsx`: the permission-denied sub-case (a mocked
  `SpeechRecognition` whose `start()` fires an `onerror` with
  `error: 'not-allowed'`, surfacing "Microphone access was denied...") is
  deferred. Reliably observing the resulting `speech.error` state update
  without flakiness requires more event-loop choreography than the marginal
  coverage is worth; only the supported/unsupported control-visibility cases
  are covered.
