# Legacy v0 Audit

`reference/legacy-v0/` preserves the original five-file proof-of-concept without content edits.

## Prompt inventory

The legacy `index.html` contains the comment `QUESTION LIBRARY — 62 questions, 7 eras`, but direct extraction of the `ERAS` array finds 7 sections and 58 prompt objects. The 58 prompts in source are the content authority for the first bundled pack. No additional prompts were invented to satisfy the stale copy.

The machine-readable audit is checked in at `prompt-inventory.json`.

## Migration

Legacy responses were keyed as `era__arrayIndex`. The complete checked-in map at `src/packs/wolfs-deposition/legacy-id-migration-map.json` maps each of the 58 legacy keys to a semantic prompt ID. Runtime migration must use this map, not prompt-text matching.
