# AXM Wolf

A local-first engine for capturing tacit institutional knowledge through structured, self-directed testimony.

Capture packs define the questions. Wolf preserves the record.

The first bundled pack is The Wolf's Deposition, a primary-source record for William Sandhu's forty-year career in institutional IT.

## What the engine does

`src/engine/` is framework-independent TypeScript with no dependency on React, IndexedDB, or `src/packs/`. It:

- validates capture packs (`validatePack`)
- canonicalizes and digests packs for provenance (`canonicalizePack`, `digestPack`)
- creates records and commits response revisions (`createRecord`, `commitResponse`, `getCurrentResponse`)
- computes progress per section and overall (`computeProgress`)
- runs deterministic local lexical search (`searchRecords`)
- builds and imports portable record bundles (`buildRecordBundle`, `importRecordBundle`)
- renders Markdown and plain-text exports (`renderMarkdown`, `renderPlainText`)
- sanitizes export filenames (`sanitizeFilename`) and counts words (`countWords`)

The engine performs no inference. v0.1 is not an AI interviewer: it asks fixed prompts from a pack and stores what the subject types or dictates, verbatim.

## WOLF Ops prototype

`src/ops/` is a separate deterministic decision-support layer. It does not alter testimony. It:

- builds guided inspection plans that request the highest-value safe photograph, video, document, measurement, or spoken answer still missing from an asset model
- marks contractor and licensed-professional capture separately instead of instructing a subject to perform unsafe disassembly or energized testing
- preserves a Pareto frontier of materially different cost, recurrence, disruption, compliance, reversibility, attention, and evidence tradeoffs rather than collapsing a case to one answer
- enforces durable work-order closure so a temporary patch cannot be verified or closed as a permanent resolution
- includes first pilot templates for mixed discontinued recessed lighting and café display preventive care

The prototype defines the evidence and decision contract but does not yet interpret media or persist attachments. See [docs/OPS.md](docs/OPS.md).

## What a capture pack is

A capture pack is a validated JSON document (`*.wolfpack.json`) describing a question library: sections, prompts grouped by lens (a labeled angle on a topic), and presentation defaults. A pack contains no responses. The same engine and UI run any valid pack. See [docs/PACK_AUTHORING.md](docs/PACK_AUTHORING.md) for the full schema and a minimal example.

## The first pack: The Wolf's Deposition

`src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json` is a primary-source record for William Sandhu, framed as a Pulp Fiction-inspired deposition. It currently defines **7 sections and 58 prompts**. These counts are derived at runtime from the pack (`computeProgress`, `PacksScreen`) -- no UI string hard-codes them.

The legacy proof of concept (`reference/legacy-v0/`) carried a comment claiming "62 questions, 7 eras," but its source array contains only 58 prompt objects. The 58 prompts are the content authority; no prompts were invented to reach 62. The mismatch and the full migration from legacy `era__index` keys to stable semantic prompt IDs are documented in `reference/legacy-v0/AUDIT.md` and `src/packs/wolfs-deposition/legacy-id-migration-map.json`.

## Repository layers

| Layer | Path | May import from |
| --- | --- | --- |
| Engine | `src/engine/` | nothing else in the repo |
| Ops | `src/ops/` | only other files under `src/ops/` |
| Storage | `src/storage/` | `src/engine/` |
| Packs | `src/packs/`, `src/test-fixtures/` | (data only; no code imports) |
| App | `src/app/` | `src/engine/`, `src/storage/`, `src/packs/` |
| Reference | `reference/legacy-v0/` | nothing (preserved as-is, not built) |
| Tests | `tests/` | any of the above |

`src/engine/` must never import from `src/packs/`, `src/app/`, or `src/storage/`, and must contain no Wolf-specific content (no "William Sandhu," "HP," "The Room," etc.). This is enforced by `npm run lint` (`scripts/lint-boundary.mjs`).

## Privacy

All records, drafts, and installed packs live in this browser's IndexedDB (`AXMWolf`). Nothing is sent to a server. See [docs/PRIVACY.md](docs/PRIVACY.md) for the full model, including the one exception (browser-vendor speech recognition, if you use voice input).

## Quick start

```bash
npm ci
npm run dev
npm run check
```

`npm run check` runs lint (engine boundary check), typecheck, the test suite, and a production build.

## Tests

```bash
npm test         # compile tests and run with node --test
npm run test:watch
npm run typecheck
npm run lint     # engine boundary + content checks
npm run test:e2e # smoke script (scripts/e2e-smoke.mjs)
```

The suite covers engine logic, pack validation, storage through `fake-indexeddb`, the first-pack content audit, legacy migration, guided inspection, decision-frontier evaluation, and durable work-order closure.

## Deployment modes

The same build supports two modes, controlled by environment variables at build time:

- **Platform mode** (default): `VITE_DEPLOY_MODE=platform`. Shows the AXM Wolf record library first, with multiple packs and records.
- **Single-pack mode**: `VITE_DEPLOY_MODE=single-pack` and `VITE_DEFAULT_PACK_ID=wolfs-deposition`. Launch emphasizes one pack (e.g. The Wolf's Deposition) with one-tap continue; the pack library remains accessible but secondary.

The build uses a relative base path (`base: './'` in `vite.config.ts`), so the same `dist/` output works at a domain root or a sub-path. See [docs/DEPLOY.md](docs/DEPLOY.md) for hosting instructions, including Cloudflare Pages and GitHub Pages.

The app is installable as a PWA and works offline after the first load: the app shell, bundled pack, and core capture/search/export functions are available without a network connection. An update banner appears when a new version is ready, without forcing a reload over unsaved drafts.

## Pack authoring

To write your own capture pack, see [docs/PACK_AUTHORING.md](docs/PACK_AUTHORING.md) for the schema and [docs/METHODOLOGY.md](docs/METHODOLOGY.md) for the cognitive-interview foundation behind Wolf's lens system.

## Known limitations (v0.1)

- No hosted backend, accounts, or multi-device sync. Each browser profile holds its own data.
- No real-time interviewing, automatic summarization, semantic search, or generated follow-up questions.
- No audio recording or storage. Voice input is transcribed live by the browser and only the resulting text is kept.
- Voice transcription is a progressive enhancement: availability and network use depend on the browser, and it is not part of the offline guarantee.
- No at-rest application encryption and no cryptographic identity signatures. Pack and record digests detect accidental changes, not authorship.
- Imported packs must be schema-valid JSON with no HTML; only one response kind (`long_text`) is supported in v1.
- The Ops prototype does not yet interpret photographs or video, persist media evidence, or expose its models through the production UI.

## Roadmap

Architectural reserves for future versions (DESIGN.md Part 18), not v0.1 commitments:

- signed packs, building on the existing `packDigest` field
- encrypted record exports (wrapping the existing bundle format)
- a derived-knowledge layer (timelines, entity indexes, summaries) that always cites `recordId` / `promptId` / `revisionId` and never overwrites testimony
- media evidence, asset passports, guided inspection sessions, and source-cited operational decision cases
- multiple respondents combined into one knowledge collection
- optional hosted synchronization of encrypted bundles, with the local engine remaining fully functional without it

## AXM family

AXM Wolf is part of the AXM family of tools: `axm` (a semantic compiler), `axm-genesis` (a cryptographic kernel for signed knowledge shards), `axm-arc` (an organizational simulation engine), and `axm-wolf` (testimony capture, this repository). Wolf's `packDigest` field is the future seam for genesis-signed packs: a future pack format can carry an author signature over the same digested payload without changing the record model. See [docs/AXM_FAMILY.md](docs/AXM_FAMILY.md) for the full family context and Arc/Genesis transfer audit.
