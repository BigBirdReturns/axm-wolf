# The Night Superintendent's Deposition — demo record

**Everything in this folder is fiction.** Marisol Vega, the Ash Creek Municipal Water District, Gus Ferreira, the Labor Day flood — all invented. This is a demonstration of what a filled Wolf record looks like, authored so the app can be shown working without touching anyone's real testimony. The fictional disclaimer is embedded in the pack description and the subject metadata, so it survives into every export made from this record.

## Contents

| File | What it is |
| --- | --- |
| `testimony.json` | The authored source: responses, revisions, timestamps, one deliberately unfinished draft. Timestamps and revision order are content, written by hand. |
| `night-superintendents-deposition.demo.wolfrecord.json` | The importable record bundle, generated from the testimony through the real engine. |

The pack itself lives at `src/packs/night-superintendents-deposition/` and appears in the app's Example packs section.

## What the demo exercises

- 9 of 12 prompts answered (progress strips show partial completion; 2 prompts untouched)
- one response with **two revisions** — the flood-timeline answer, where the subject corrects a time against a colleague's log and revises "mine alone" to "mine first." Open its revision history.
- mixed capture sources: `typed`, `speech_transcript` (the main-break story reads like it was spoken), and `mixed`
- one live, mid-sentence **draft** (the final-walkthrough prompt) — autosaved, uncommitted
- a genuine pack digest and a bundle that passes `importRecordBundle` untouched

## How to load it

1. Run the app and open (or create) any record, then go to its **Export and data** screen.
2. Choose **Import** and select `night-superintendents-deposition.demo.wolfrecord.json`.
3. The record installs with its own pack snapshot — the pack does not need to be installed first.

To start a *fresh* record from the same questions instead, install the pack from the **Packs** screen (it's listed under Example packs) and create a new record from it.

## Regenerating

```bash
node scripts/generate-demo-record.mjs \
  --pack src/packs/night-superintendents-deposition/night-superintendents-deposition.wolfpack.json \
  --testimony examples/night-superintendent/testimony.json \
  --out examples/night-superintendent/night-superintendents-deposition.demo.wolfrecord.json
```

The script drives `validatePack → digestPack → createRecord → commitResponse → buildRecordBundle` and round-trips the result through `importRecordBundle` before writing, so the output is valid by construction. Revision IDs are freshly generated UUIDs on each run; everything else is deterministic from `testimony.json`.

## Authoring the next one

Fictional subjects are a renewable resource. To author another:

1. Write a pack under `src/packs/<id>/<id>.wolfpack.json` (see `docs/PACK_AUTHORING.md`). Mark the subject fictional in `description` and `subjectDefaults` — the disclaimer must travel with the data, not sit in a README.
2. Write a `testimony.json` in a new folder here: entries with `promptId` + revisions (`text`, `capturedAt`, `source`), optional drafts. Order revisions by `capturedAt`; the engine builds the supersedes chain.
3. Run the generator.
4. Add a pack test in `tests/packs/` and, if the record is checked in, a bundle test like `tests/examples/night-superintendent-record.test.ts`.

**Never author testimony for a real person.** Real records are captured, one keystroke at a time, by the person who lived them. That line is the product.
