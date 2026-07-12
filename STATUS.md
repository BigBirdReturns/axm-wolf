# Status

Where AXM Wolf is, and what is next. Read this cold before picking up work.

## Phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Preserve legacy v0, audit prompt count, build migration map | Done |
| 1 | Scaffold, schema, generic fixture, boundary test | Done |
| 2 | Pure testimony engine: records, progress, search, digest, bundles, rendering | Done |
| 3 | IndexedDB storage, draft autosave, atomic commit, migration | Done |
| 4 | Capture UI, navigation, search, export and import | Done |
| 5 | PWA, offline shell, deployment modes, update flow | Done |
| 6 | Documentation and v0.1 release foundation | Done |
| 7 | WOLF Ops guided evidence, decision ranges, recurrence, and durable closure | Implemented on `agent/wolf-ops-guided-inspection`; validation and review pending |

## Architectural boundary

The repository now contains two distinct product layers.

`src/engine/` remains the v0.1 testimony engine. It validates capture packs, preserves append-only response revisions, computes progress, performs deterministic lexical search, and imports or exports portable testimony records. It performs no inference and has no dependency on React, IndexedDB, packs, or WOLF Ops.

`src/ops/` is an experimental operational layer. It organizes local evidence and decision state without overwriting testimony. It contains the guided-inspection state machine, decision comparison, recurrence logic, work-order closure rules, and explicit domain playbooks.

## What is live

### Testimony engine (`src/engine/`)

- pack validation and typed errors
- canonicalization and SHA-256 pack digests
- record creation and append-only response commits
- progress and word-count calculation
- deterministic local lexical search
- portable record bundles
- Markdown and plain-text rendering
- filename sanitization

The boundary lint rejects imports from application, storage, pack, or operational layers and rejects first-pack-specific content inside the testimony engine.

### WOLF Ops (`src/ops/`)

The operational kernel provides:

- branch-changing fact prompts
- conditional evidence requests
- safety blockers that can stop ordinary capture
- explicit completion or deferral of each requested observation
- source-classified evidence artifacts
- Pareto-frontier decision comparison
- preservation of options with missing evidence
- explicit benefits, burdens, assumptions, and reopening triggers
- work-order transitions from observation through verified closure
- a hard distinction between temporary stabilization and closure
- recurrence matching for the same issue on the same asset

The first playbooks are:

- `recessed-lighting`: mixed or discontinued fixtures, common-cause diagnosis, compatible replacement, spares, room standardization, and staged property standardization
- `cafe-display`: service and preventive maintenance, repair, supported replacement, system standardization, and removal of an operational display dependency

The metric values shipped with both decision cases are relative priors. Local evidence, quotations, service history, installation constraints, failure frequency, and owner preferences must replace them before a consequential decision is treated as settled.

### Storage (`src/storage/`)

The database remains `AXMWolf` and is now schema version 2.

Stores:

- `packs`
- `records`
- `responses`
- `drafts`
- `settings`
- `migrations`
- `opsCases`
- `opsEvidence`

Operational evidence is stored as local IndexedDB data, including Blob content where supplied by the browser. Evidence capture and inspection-state advancement commit in one transaction. Deleting an operational case removes its linked evidence. The wipe-all action clears operational data with the testimony stores.

### Application (`src/app/`)

The existing testimony screens remain available. `#/ops` adds a mobile-oriented guided-inspection screen that:

- selects a domain playbook
- preserves a separate local case for each playbook version
- gathers required safety and branch-changing facts first
- requests one consequential photograph, video, document, or measurement at a time
- opens the device camera where supported
- previews locally stored photograph and video evidence
- records explicit deferrals rather than treating missing evidence as observed
- displays the complete decision range and current non-dominated option set
- exposes benefits, burdens, assumptions, and reopening conditions for every path

The current interface organizes media and evidence requests. It does not yet interpret image pixels or generate derived observations from photographs or video.

### PWA and deployment

The application remains buildable in platform and single-pack modes. The service worker, relative asset paths, update prompt, install flow, and offline shell remain unchanged. Deterministic WOLF Ops capture and decision functions are part of the local application bundle and require no backend or runtime API.

## Data integrity and trust

The following invariants remain non-negotiable:

- testimony revisions append rather than overwrite
- derived or operational artifacts never replace testimony
- pack content is validated plain JSON and cannot execute code
- stable semantic IDs identify stored objects
- core operation remains local-first
- speech recognition is optional and may use browser-vendor network services
- operational media is not automatically treated as an interpreted fact
- missing decision evidence remains visible as missing
- a temporary patch cannot be recorded as durable closure
- verification requires a named test and evidence

## Validation coverage added for WOLF Ops

The branch adds tests for:

- conditional evidence requests and request priority
- safety blocking
- required-fact gating
- explicit deferral reasons
- ready-for-review gating
- Pareto dominance and multi-option frontiers
- missing-evidence preservation
- preference reweighting without mutation
- stabilization versus closure
- verification-test and evidence requirements
- recurrence linking
- operational case and Blob persistence
- atomic evidence and case writes
- case deletion with linked evidence cleanup
- schema-version-1 to schema-version-2 database upgrade
- wipe-all coverage for operational stores
- routing and guided-inspection component behavior

The required repository gates remain:

```bash
npm ci
npm run check
npm run test:e2e
```

Do not mark Phase 7 complete until those gates have been run in an environment with the repository checkout and the result has been recorded honestly.

## Known gaps

- No media interpreter converts photograph or video pixels into observations. The current UI captures, labels, stores, requests, and portably backs up evidence only.
- WOLF Ops backups are unencrypted JSON with embedded media and can become large.
- Analysis handoffs and returns now support an asynchronous human/subscription interpretation loop without a runtime inference API. Handoffs remain unencrypted pending owner-key configuration.
- Guided recipient links now provide one-tap start/resume, writing-screen coaching, simplified navigation, and a native share/download delivery path for testimony records.
- The local survey dashboard creates uniquely labeled invitations, matches returned records by assignment ID, accepts multiple return files, filters by recipient/survey/pack, and tracks invited/received/analyzing/completed workflow states.
- The optional Glass Onion v0.2 adapter serves friendly `/wolf/SUR##` interviews, synchronizes local records through D1, protects recipient and dashboard access separately, and carries operator-uploaded analysis returns back to the participant page without runtime AI calls.
- The initial decision metrics are relative priors rather than local quotations or calibrated lifetime-cost estimates.
- No browser-driven camera and Blob-restoration end-to-end test has run yet.
- Existing full Playwright coverage still requires a browser binary in an allowlisted environment; the dependency-free static PWA smoke remains the portable gate.
- Operational evidence is not encrypted at rest.
- Screenshots and a public landing page remain to be produced after the interface stabilizes.

## How to pick this up

1. Read `DESIGN.md`, `AGENTS.md`, and `docs/WOLF_OPS.md`.
2. Run `npm ci && npm run check` from a clean checkout.
3. Run `npm run test:e2e` for persistence, routing, PWA, import, or export changes.
4. Exercise `#/ops` on a mobile browser with the recessed-lighting and café-display playbooks.
5. Treat all bundled option values as provisional until replaced by local evidence.
6. Preserve the 7-section, 58-prompt first-pack authority documented in `reference/legacy-v0/AUDIT.md`.
