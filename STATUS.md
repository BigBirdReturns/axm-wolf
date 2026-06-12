# Status

Where AXM Wolf is, and what's next. Read this cold before picking up work.

## Phases (DESIGN.md Part 15)

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Preserve legacy v0, audit prompt count, build migration map | Done -- `reference/legacy-v0/`, `AUDIT.md`, `legacy-id-migration-map.json` |
| 1 | Scaffold, schema, generic fixture, boundary test | Done -- `src/engine/schema.ts`, `src/test-fixtures/generic-engineer.wolfpack.json`, `scripts/lint-boundary.mjs` |
| 2 | Pure engine (records, progress, search, digest, bundles, rendering) | Done -- `src/engine/` |
| 3 | Storage (IndexedDB, repositories, draft autosave, atomic commit, legacy migration) | Done -- `src/storage/` |
| 4 | UI parity and improvement (screens, navigation, export/import, search) | Done -- `src/app/` |
| 5 | PWA and deployment modes (service worker, manifest, install flow, update banner, platform/single-pack) | In progress on this branch, concurrent with this documentation pass -- see "PWA" below |
| 6 | Documentation and release | This pass: README, `docs/PACK_AUTHORING.md`, `docs/PRIVACY.md`, `docs/DEPLOY.md`, this file |

## What's live on this branch

### Engine (`src/engine/`)

Framework-independent TypeScript, exported from `src/engine/index.ts`:

- validation: `validatePack` (`schema.ts`), `WolfValidationError` (`errors.ts`)
- provenance: `canonicalizePack`, `digestPack`
- records: `createRecord`, `commitResponse`, `getCurrentResponse`, `computeProgress` (`record.ts`)
- search: `searchRecords` (`search.ts`)
- bundles: `buildRecordBundle`, `importRecordBundle` (`bundle.ts`)
- rendering: `renderMarkdown`, `renderPlainText` (`render.ts`)
- utilities: `sanitizeFilename` (`filenames.ts`), `countWords` (`text.ts`)

200 tests pass (`npm test`, `node --test`, compiled via `tsconfig.test.json`). Engine-boundary and content checks run via `npm run lint` (`scripts/lint-boundary.mjs`), which fails if anything under `src/engine/` imports from `src/packs/`, `src/app/`, or `src/storage/`, or contains first-pack-specific strings.

### Storage (`src/storage/`)

Custom thin IndexedDB adapter over the native IndexedDB API (no Dexie), exported from `src/storage/index.ts`:

- `db.ts`: `DB_NAME` (`AXMWolf`), `DB_VERSION`, `STORE_NAMES` (`packs`, `records`, `responses`, `drafts`, `settings`, `migrations`), `WolfDb`, `openWolfDb`
- `recordRepository.ts`: `saveRecord`, `loadRecord`, `listRecords`, `deleteRecord`, `commitResponseAtomic`
- `draftRepository.ts`: `saveDraft`, `getDraft`, `deleteDraft`, `listDrafts`
- `legacyMigration.ts`: `migrateLegacyAnswers`

`commitResponseAtomic` performs the read-append-clear-draft-update-timestamp sequence in one transaction (DESIGN.md 8.3). Tested under `fake-indexeddb` in `tests/storage/`.

### Packs (`src/packs/`, `src/test-fixtures/`)

- `src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json`: the bundled first pack, 7 sections / 58 prompts, plus `legacy-id-migration-map.json` mapping every legacy `era__index` key to a semantic prompt ID.
- `src/test-fixtures/generic-engineer.wolfpack.json`: the generic 2-section / 5-prompt structural fixture (DESIGN.md 13.3).

### App (`src/app/`)

Screens in `src/app/screens/`:

- `LaunchScreen.tsx` -- launch / mode-aware entry
- `RecordsScreen.tsx` -- record library
- `RecordHomeScreen.tsx` -- record home, progress, sections
- `SectionScreen.tsx` -- section/prompt list
- `PromptScreen.tsx` -- prompt view, draft autosave, commit, revisions
- `SearchScreen.tsx` -- local lexical search
- `ExportScreen.tsx` -- export (bundle/Markdown/text), record import with conflict handling, archive, delete-with-confirmation
- `PacksScreen.tsx` -- installed packs, trust labels, derived counts
- `SettingsScreen.tsx`
- `PlaceholderScreens.tsx` -- any remaining stub routes

Routing is hash-based and pure-function parsed (`src/app/routes.ts`, unit-tested independent of React/DOM). Deployment mode is read and validated at startup from `import.meta.env` (`src/app/config.ts`): `VITE_DEPLOY_MODE` (`platform` default, or `single-pack`) and `VITE_DEFAULT_PACK_ID`.

### PWA (Phase 5, concurrent work)

Phase 5 (service worker, manifest generation, offline precache, install flow, update banner, confirming root and subpath builds) is being implemented concurrently with this documentation pass. `vite.config.ts` already sets `base: './'` for subpath safety (DESIGN.md 11.3). Treat the PWA install/offline/update-banner behavior described in the README and `docs/DEPLOY.md` as the target for that work landing on this branch; verify against the actual Phase 5 commit notes if it has not yet merged.

## Known gaps

- **End-to-end tests (Playwright)**: `npm run test:e2e` currently runs `scripts/e2e-smoke.mjs`, a smoke script, not the full Playwright flow described in DESIGN.md 14.6 (draft survival, offline reload, export/import round trip). Playwright is a declared dependency but its full e2e suite status should be checked against Phase 5 notes.
- **Component tests (React Testing Library)**: DESIGN.md 14.5 describes component-level tests (launch screen in both modes, save-status announcements, speech states, import validation errors, etc.). These are not yet present as a distinct RTL suite; current coverage is engine/storage/route unit tests under `tests/engine/`, `tests/storage/`, `tests/app/`, `tests/packs/`, `tests/scripts/`.
- **Pack import UI**: record bundle import (`.wolfrecord.json`) is implemented in `ExportScreen.tsx` with conflict handling. Importing a new *capture pack* file (producing an `imported_unsigned` row in the `packs` store) has no UI entry point yet -- see `docs/PACK_AUTHORING.md` for current status.

## How to pick this up

1. Read `DESIGN.md` in full -- it is the design authority and invariants win over convenience.
2. Read `AGENTS.md` for the non-negotiable invariants and required workflow.
3. Run `npm ci && npm run check` (lint, typecheck, test, build) to confirm a clean baseline.
4. Run `npm run test:e2e` for any change touching persistence, routing, PWA behavior, import, or export.
5. Check this file and `reference/legacy-v0/AUDIT.md` for the current prompt-count and migration facts before writing UI copy.
