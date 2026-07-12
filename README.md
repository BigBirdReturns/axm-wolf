# AXM Wolf

A local-first engine for capturing tacit institutional knowledge through structured, self-directed testimony.

Capture packs define the questions. Wolf preserves the record.

The first bundled pack is The Wolf's Deposition, a primary-source record for William Sandhu's forty-year career in institutional IT.

## What the testimony engine does

`src/engine/` is framework-independent TypeScript with no dependency on React, IndexedDB, `src/ops/`, or `src/packs/`. It:

- validates capture packs (`validatePack`)
- canonicalizes and digests packs for provenance (`canonicalizePack`, `digestPack`)
- creates records and commits response revisions (`createRecord`, `commitResponse`, `getCurrentResponse`)
- computes progress per section and overall (`computeProgress`)
- runs deterministic local lexical search (`searchRecords`)
- builds and imports portable record bundles (`buildRecordBundle`, `importRecordBundle`)
- renders Markdown and plain-text exports (`renderMarkdown`, `renderPlainText`)
- sanitizes export filenames (`sanitizeFilename`) and counts words (`countWords`)

The testimony engine performs no inference. v0.1 is not an AI interviewer: it asks fixed prompts from a pack and stores what the subject types or dictates, verbatim.

## WOLF Ops

`src/ops/` is a separate experimental operational layer for situations where testimony must become a durable local operating state. It adds:

- guided photograph, video, document, and measurement requests
- branch-changing fact prompts and safety blockers
- local evidence artifacts tied to the question they resolve
- conditional shot lists rather than one comprehensive inspection checklist
- Pareto-frontier decision comparison instead of one manufactured answer
- work-order states that distinguish temporary stabilization from verified closure
- recurrence linking for the same issue on the same asset

The first configurations cover mixed or discontinued recessed lighting and a customer-facing café display. The app exposes them at `#/ops`. Media is stored in IndexedDB and never sent to a server by this implementation. The current build organizes media and decision branches but does not yet infer facts from image pixels.

See [docs/WOLF_OPS.md](docs/WOLF_OPS.md) for the architecture, evidence model, decision rules, safety boundary, and first playbooks.

## What a capture pack is

A capture pack is a validated JSON document (`*.wolfpack.json`) describing a question library: sections, prompts grouped by lens (a labeled angle on a topic), and presentation defaults. A pack contains no responses. The same engine and UI run any valid pack. See [docs/PACK_AUTHORING.md](docs/PACK_AUTHORING.md) for the full schema and a minimal example.

## The first pack: The Wolf's Deposition

`src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json` is a primary-source record for William Sandhu, framed as a Pulp Fiction-inspired deposition. It currently defines **7 sections and 58 prompts**. These counts are derived at runtime from the pack (`computeProgress`, `PacksScreen`) -- no UI string hard-codes them.

The legacy proof of concept (`reference/legacy-v0/`) carried a comment claiming "62 questions, 7 eras," but its source array contains only 58 prompt objects. The 58 prompts are the content authority; no prompts were invented to reach 62. The mismatch and the full migration from legacy `era__index` keys to stable semantic prompt IDs are documented in `reference/legacy-v0/AUDIT.md` and `src/packs/wolfs-deposition/legacy-id-migration-map.json`.

## Repository layers

| Layer | Path | May import from |
| --- | --- | --- |
| Testimony engine | `src/engine/` | nothing else in the repo |
| WOLF Ops | `src/ops/` | its own content-free kernel and explicit playbooks |
| Storage | `src/storage/` | `src/engine/`, `src/ops/` types |
| Packs | `src/packs/`, `src/test-fixtures/` | data only; no code imports |
| App | `src/app/` | `src/engine/`, `src/ops/`, `src/storage/`, `src/packs/` |
| Reference | `reference/legacy-v0/` | nothing; preserved as-is and not built |
| Tests | `tests/` | any of the above |

`src/engine/` must never import from `src/packs/`, `src/app/`, `src/storage/`, or `src/ops/`, and must contain no Wolf-specific content. This is enforced by `npm run lint` (`scripts/lint-boundary.mjs`).

## Privacy

Records, drafts, installed packs, WOLF Ops cases, and operational media live in this browser's IndexedDB (`AXMWolf`). Nothing is sent to a server. Clearing browser data may remove them. See [docs/PRIVACY.md](docs/PRIVACY.md) for the full testimony model, including the one exception for browser-vendor speech recognition when voice input is used.

Operational media can contain private people, documents, credentials, tenant belongings, or business-sensitive material. Capture only what the evidence request requires. The wipe-all action removes WOLF Ops cases and evidence with the rest of the local database.

## Quick start

```bash
npm ci
npm run dev
npm run check
```

`npm run check` runs the engine-boundary lint, typecheck, node tests, component tests, and a production build.

## Tests

```bash
npm test              # compile tests and run with node --test
npm run test:watch
npm run test:components
npm run typecheck
npm run lint          # engine boundary + content checks
npm run test:e2e      # static PWA/build smoke
```

The suite covers testimony-engine logic, pack validation, IndexedDB persistence, migration, import/export, WOLF Ops inspection guidance, decision frontiers, durable closure, recurrence, routing, and component behavior.

## Deployment modes

The same build supports two modes, controlled by environment variables at build time:

- **Platform mode** (default): `VITE_DEPLOY_MODE=platform`. Shows the AXM Wolf record library first, with multiple packs and records.
- **Single-pack mode**: `VITE_DEPLOY_MODE=single-pack` and `VITE_DEFAULT_PACK_ID=wolfs-deposition`. Launch emphasizes one pack with one-tap continue; the pack library remains accessible but secondary.

The build uses a relative base path (`base: './'` in `vite.config.ts`), so the same `dist/` output works at a domain root or a sub-path. See [docs/DEPLOY.md](docs/DEPLOY.md) for hosting instructions, including Cloudflare Pages and GitHub Pages.

The app is installable as a PWA and works offline after the first load. The app shell, bundled pack, testimony capture/search/export, and deterministic WOLF Ops capture and decision functions are available without a network connection. An update banner appears when a new version is ready without forcing a reload over unsaved drafts.

## Pack authoring

To write a capture pack, see [docs/PACK_AUTHORING.md](docs/PACK_AUTHORING.md) for the schema and [docs/METHODOLOGY.md](docs/METHODOLOGY.md) for the cognitive-interview foundation behind Wolf's lens system.

## Known limitations

- No hosted backend, accounts, or multi-device sync. Each browser profile holds its own data.
- No automatic testimony summarization, semantic search, or generated follow-up questions.
- WOLF Ops captures and organizes photographs and videos but does not yet interpret their pixel content.
- WOLF Ops cases and media do not yet have a portable export/import bundle.
- No audio-file recording or storage. Voice input is transcribed live by the browser and only the resulting text is kept.
- Voice transcription is a progressive enhancement: availability and network use depend on the browser, and it is not part of the offline guarantee.
- No at-rest application encryption and no cryptographic identity signatures. Pack and record digests detect accidental changes, not authorship.
- Imported packs must be schema-valid JSON with no HTML; only one testimony response kind (`long_text`) is supported in v1.

## Roadmap

Architectural reserves and next operational steps include:

- source-cited observation and claim objects derived from local evidence
- a pluggable evidence interpreter that never overwrites the original media or testimony
- portable encrypted WOLF Ops case bundles
- exact local cost, quotation, service-history, and preference inputs replacing illustrative priors
- signed packs, building on the existing `packDigest` field
- encrypted testimony-record exports
- multiple respondents combined into one knowledge collection
- optional hosted synchronization of encrypted bundles, with the local engine remaining functional without it

## AXM family

AXM Wolf is part of the AXM family of tools: `axm` (a semantic compiler), `axm-genesis` (a cryptographic kernel for signed knowledge shards), `axm-arc` (an organizational simulation engine), and `axm-wolf` (testimony and operational capture, this repository). Wolf's `packDigest` field is the future seam for genesis-signed packs. See [docs/AXM_FAMILY.md](docs/AXM_FAMILY.md) for the family context and Arc/Genesis transfer audit.
