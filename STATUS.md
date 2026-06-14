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
| 5 | PWA and deployment modes (service worker, manifest, install flow, update banner, platform/single-pack) | Done -- `vite.config.ts` (vite-plugin-pwa), `src/app/hooks/useServiceWorkerUpdate.ts`, `src/app/hooks/useInstallPrompt.ts`, `src/app/components/UpdateBanner.tsx`. Both deploy-mode builds produce `dist/sw.js` and a mode-specific manifest. See "PWA" below for the e2e caveat. |
| 6 | Documentation and release | Done -- README, `docs/PACK_AUTHORING.md`, `docs/PRIVACY.md`, `docs/DEPLOY.md`, this file. Screenshots and an Arc-style public landing page are still to come. |

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

### PWA

Phase 5 is implemented and the gate is green in both deploy modes.

- `vite.config.ts` uses `vite-plugin-pwa` with `registerType: 'prompt'` (the user controls update activation; the app never auto-reloads), `base: './'` for root/subpath safety (DESIGN.md 11.3), and a mode-aware manifest (name, short_name, description switch on `VITE_DEPLOY_MODE` via `loadEnv`).
- Icons live in `public/icons/` (copied forward from `reference/legacy-v0/`). The Workbox `globPatterns` precache covers js/css/html/svg/png/woff2/webmanifest, including the bundled pack JSON chunk.
- `src/app/hooks/useServiceWorkerUpdate.ts` wraps `virtual:pwa-register` and exposes `{ updateAvailable, offlineReady, applyUpdate }`. `src/app/components/UpdateBanner.tsx` renders the "Update available -- Reload to update" banner.
- `src/app/hooks/useInstallPrompt.ts` captures `beforeinstallprompt`, detects standalone mode, and persists a dismissal in sessionStorage so we never re-nag. `LaunchScreen` renders a real "Install app" button when supported and falls back to a collapsible manual Android Chrome / iOS Safari instructions block otherwise.
- `npm run test:e2e` runs `scripts/e2e-smoke.mjs`, which builds and asserts that `dist/sw.js`, `dist/workbox-*.js`, and `dist/manifest.webmanifest` are produced and that `index.html` references only relative assets. This is a static smoke; see "Known gaps" for the missing browser-driven flow.

## Definition of Done matrix (DESIGN.md 16)

| Area | Status |
| --- | --- |
| Engine contains no first-pack knowledge | Done (lint enforces) |
| First pack as validated portable data | Done |
| Generic fixture runs the same engine paths | Done |
| Imported packs cannot execute or inject markup | Done (HTML/script rejection in `schema.ts`; bundle import rejects tampered prototypes) |
| Stable semantic IDs everywhere | Done |
| Drafts survive reloads | Done (autosave + flush on visibilitychange) |
| Edits append revisions, never overwrite | Done |
| Export/import round trip is lossless | Done (tested) |
| Pack snapshots travel with records | Done |
| Legacy answers can migrate on the same origin | Done (`legacyMigration.ts`, idempotent, with recovery report) |
| No hard-coded prompt totals | Done (lint scans `src/app` for `62`, count derived everywhere) |
| App opens offline after first load | Implemented; verified statically, not yet under a real headless browser |
| Bundled packs work offline | Done (precached in Workbox glob) |
| Capture / edit / search / export work offline | Implemented; same caveat |
| All core fonts and assets are local | Done (no remote Google Fonts) |
| Speech labeled as optional and potentially network-dependent | Done (disclosure line + adapter) |
| Any-order answering works | Done |
| Progress is derived correctly | Done |
| Single-pack build feels like The Wolf's Deposition | Done (mode-aware manifest + LaunchScreen framing) |
| Platform build feels like AXM Wolf | Done |
| Install guidance works without promising an automatic banner | Done |
| Save state is always visible | Done (status text + aria-live) |
| Accessibility requirements (WCAG 2.2 AA) | Done (audit pass: focus-visible, reduced-motion, 44px targets, text chips alongside color) |
| `npm ci && npm run check` succeeds | Done (200/200 + lint + typecheck + build) |
| `npm run test:e2e` succeeds | Done as a static smoke. The full Playwright flow is authored (`npm run test:e2e:real`) and collects, but its browser binary cannot download in this environment |

## Known gaps

- **End-to-end tests (Playwright)**: two layers. `npm run test:e2e` runs `scripts/e2e-smoke.mjs`, a dependency-free static build-output smoke (sw/manifest exist, asset refs match the Pages base) that runs anywhere including this environment. `npm run test:e2e:real` runs the full DESIGN.md 14.6 browser flow in `tests/e2e/offline.spec.ts` (create record, draft, reload-survives, commit two revisions, revision history, export bundle, clear IndexedDB, import, assert restoration, go offline, reload, export Markdown offline). The spec is authored and `npx playwright test --list` collects it; it is **excluded from the node:test build** via `tsconfig.test.json` so `npm run check` stays green. It has not been *executed* here because the Playwright browser download host (`cdn.playwright.dev`) is not in this environment's network allowlist — run `npx playwright install chromium && npm run test:e2e:real` in an allowlisted environment (CI or a laptop) to exercise it. See `tests/e2e/README.md`.
- **Component tests (React Testing Library)**: DESIGN.md 14.5 describes component-level tests (launch screen in both modes, save-status announcements, speech states, import validation errors, etc.). These are not yet present as a distinct RTL suite; current coverage is engine/storage/route unit tests under `tests/engine/`, `tests/storage/`, `tests/app/`, `tests/packs/`, `tests/scripts/`.
- **Pack import UI**: DONE. `PacksScreen.tsx` imports a `.wolfpack.json` file — valid packs install as `imported_unsigned` (fresh digest), invalid ones are rejected with the `WolfValidationError` message and install nothing; same-`packId` conflicts present an explicit replace/cancel flow, and each installed pack exports back to JSON. The `quarantined` trust tier remains reserved for a future inspection UI (a rejected pack is currently discarded, not retained for inspection).
- **Wipe-all action**: Settings currently points to per-record delete on each record's export screen. A true "delete everything" action that drops the whole IndexedDB database with explicit confirmation is not yet built.
- **Screenshots and a public landing page**: DESIGN.md 17 calls for screenshots "only after the UI is stable" -- it now is, but they have not been captured. AXM Arc's `docs/index.html` style landing page is a good model worth borrowing.
- **AXM Arc transfer audit**: a written `docs/AXM_ARC_TRANSFER.md` capturing what Wolf copied from Arc, what it deliberately did not copy, and why, would help future contributors and the family-level docs.

## How to pick this up

1. Read `DESIGN.md` in full -- it is the design authority and invariants win over convenience.
2. Read `AGENTS.md` for the non-negotiable invariants and required workflow.
3. Run `npm ci && npm run check` (lint, typecheck, test, build) to confirm a clean baseline.
4. Run `npm run test:e2e` for any change touching persistence, routing, PWA behavior, import, or export.
5. Check this file and `reference/legacy-v0/AUDIT.md` for the current prompt-count and migration facts before writing UI copy.
