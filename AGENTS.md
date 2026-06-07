# AGENTS.md

## Project authority

Read `DESIGN.md` completely before planning or editing this repository. It is the design authority for AXM Wolf.

The project is a local-first institutional knowledge capture engine. The first bundled pack is The Wolf's Deposition, but the engine must remain content-free.

## Non-negotiable invariants

- `src/engine/` has zero imports from `src/packs/`, `src/app/`, or `src/storage/`.
- Engine code contains no William Sandhu, HP, Agilent, EDS, Autonomy, or Wolf's Deposition domain knowledge.
- Capture packs are validated plain JSON and never executable.
- Stable semantic IDs identify prompts. Array indexes never identify stored responses.
- Response edits append revisions. They do not overwrite history.
- Drafts autosave and survive reloads.
- Core capture, search, import, and export work offline after first load.
- Voice transcription is optional and must not be described as offline.
- No backend, accounts, analytics, AI SDK, remote fonts, or runtime API calls in v0.1.
- All totals are derived from pack data.
- The legacy source contains 58 prompts across 7 sections despite copy that claims 62. Do not invent four prompts.
- Preserve first-pack wording during extraction.

## Required workflow

1. Inspect `reference/legacy-v0/`.
2. Follow the implementation phases in `DESIGN.md`.
3. Add or update tests with each behavior change.
4. Run `npm run check` before reporting completion.
5. Run `npm run test:e2e` for changes affecting persistence, routing, PWA behavior, import, or export.
6. Report commands and results honestly.

## Completion standard

Do not declare a phase complete with failing tests, placeholder code, hard-coded pack counts, broken offline behavior, or an engine/content boundary violation.
