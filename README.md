# AXM Wolf

A local-first engine for capturing tacit institutional knowledge through structured, self-directed testimony.

Capture packs define the questions. Wolf preserves the record.

This repository currently contains Phase 0 and Phase 1 architecture work from `DESIGN.md`: the preserved legacy proof of concept, an audited first capture pack, the legacy-ID migration map, strict TypeScript scaffolding, engine schemas, and boundary tests.

## Current implementation status

- Legacy v0 remains preserved under `reference/legacy-v0/`.
- The first bundled pack is extracted as portable JSON at `src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json`.
- The stale legacy 62-question claim is documented; source inventory verifies 58 prompts across 7 sections.
- The pure engine boundary begins in `src/engine/` and has no imports from pack, app, or storage layers.
- React, Vite, Zod, Dexie, Vitest, and Playwright dependencies are declared for the intended stack; dependency installation is blocked in this environment by registry 403 responses.

## Important commands

```bash
npm run lint
npm run typecheck
npm test
npm run check
```

`npm run check` is the Phase 0/1 gate used here.
