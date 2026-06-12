# Authoring a capture pack

A capture pack is a JSON document, conventionally named `*.wolfpack.json`, that defines a question library: sections, lenses, and prompts. The engine validates packs with `validatePack` (`src/engine/schema.ts`). Anything that does not match the schema below is rejected before installation -- invalid packs never partially install.

This document describes the schema as implemented, not an aspirational superset. The full reference implementation is `src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json` (7 sections, 58 prompts); a small structural fixture is `src/test-fixtures/generic-engineer.wolfpack.json` (2 sections, 5 prompts).

## Top-level fields

Only these keys are allowed at the top level. Unknown keys are rejected.

| Field | Type | Notes |
| --- | --- | --- |
| `schemaVersion` | number | must be exactly `1` |
| `packId` | string | lowercase stable slug, max 120 chars |
| `packVersion` | string | semantic version, e.g. `1.0.0` |
| `engineVersion` | string | compatibility range, must include the substring `0.1.0` (e.g. `">=0.1.0 <1.0.0"`) -- an incompatible value fails validation loudly |
| `title` | string | max 160 chars, no HTML |
| `subtitle` | string \| null | optional, max 240 chars, no HTML |
| `description` | string \| null | optional, max 1000 chars, no HTML |
| `subjectDefaults` | object \| omitted | see below |
| `theme` | object | `{ "accent": "#rrggbb" }` -- must be a 6-digit hex color |
| `lenses` | array | 1-100 entries |
| `sections` | array | 1-100 entries |
| `prompts` | array | 1-2000 entries |
| `exportDefaults` | object \| omitted | `{ "basename": string | null }`, max 160 chars |

### `subjectDefaults` (optional)

Allowed keys: `displayName` (required, max 160), `subtitle`, `organization`, `role` (each optional, nullable strings, max 160). Used to pre-fill a new record's subject metadata.

## Slug rules

`packId`, every lens `id`, every section `id`, and every prompt `id` must match:

```text
^[a-z0-9]+(?:[.-][a-z0-9]+)*$
```

Lowercase letters, digits, and internal `.` or `-` separators. IDs must be unique within their scope (lens IDs unique among lenses, section IDs unique among sections, prompt IDs unique among all prompts). Prompt IDs are the stable identifiers used by responses and revisions -- array position is never identity.

## Lenses

Each entry: `{ "id": "<slug>", "label": "<text>" }`. `id` max 80 chars, `label` max 80 chars, no HTML. Lenses are labels for a "kind" of question (e.g. "The Room," "System," "Failure Mode") -- the engine assigns no meaning to them beyond resolving the reference from prompts.

## Prompts

Each entry, allowed keys only: `id`, `kind`, `lensId`, `text`, `context`, `tags`, `required`, `suggestedFollowUp`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | slug, max 160 chars, unique |
| `kind` | string | must be `"long_text"` (the only v1 response kind) |
| `lensId` | string | must resolve to a declared lens `id` |
| `text` | string | 1-4000 chars, no HTML -- the exact prompt wording |
| `context` | string \| null | optional, 0-2000 chars, no HTML -- a context cue |
| `tags` | string[] | optional, 0-32 entries, each max 80 chars, no HTML |
| `required` | boolean | optional, defaults to `false` |
| `suggestedFollowUp` | string \| null | optional, 0-2000 chars, no HTML -- static text for human use; the engine does not generate follow-ups |

## Sections

Each entry, allowed keys only: `id`, `label`, `rangeLabel`, `description`, `promptIds`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | slug, max 120 chars, unique |
| `label` | string | max 120 chars, no HTML |
| `rangeLabel` | string \| null | optional, max 120 chars, no HTML (e.g. a date range) |
| `description` | string \| null | optional, max 600 chars, no HTML |
| `promptIds` | string[] | 1-500 entries; each must reference a prompt declared in the top-level `prompts` array |

Every prompt must be reachable from at least one section's `promptIds` for the pack to make sense in the UI, though the validator's hard requirement is only that referenced IDs exist.

## The no-HTML rule

Any field checked by `assertNoHtml` (`title`, `subtitle`, `description`, lens labels, prompt text/context/tags/suggestedFollowUp, section label/rangeLabel/description) is rejected if it contains:

- an HTML-like tag: `/<\/?[a-z][\s\S]*>/i`
- a `javascript:` URL

All pack content is rendered through React text nodes, never `innerHTML`. There is no way to inject markup or scripts through a pack.

## Other validation rules

- `packVersion` must match semantic versioning (`\d+\.\d+\.\d+` with optional pre-release/build suffix).
- Object keys `__proto__`, `prototype`, and `constructor` are rejected anywhere in the document (prototype-pollution guard).
- Unknown fields at any level are rejected -- there is no "extra data is ignored" behavior.
- A pack with zero sections, a section with zero prompts, or an unresolved `lensId` / `promptIds` reference fails validation.

## Minimal example pack

This is a complete, valid pack (adapted from `src/test-fixtures/generic-engineer.wolfpack.json`):

```json
{
  "schemaVersion": 1,
  "packId": "departing-engineer-handoff",
  "packVersion": "1.0.0",
  "engineVersion": ">=0.1.0 <1.0.0",
  "title": "Departing Engineer Handoff",
  "subtitle": "A generic operational knowledge capture fixture.",
  "description": "A small pack proving the engine accepts non-Wolf capture packs.",
  "subjectDefaults": {
    "displayName": "Departing Engineer",
    "subtitle": "Knowledge Transfer",
    "organization": null,
    "role": "Engineer"
  },
  "theme": { "accent": "#215f6d" },
  "lenses": [
    { "id": "system", "label": "System" },
    { "id": "failure-mode", "label": "Failure Mode" },
    { "id": "handoff", "label": "Handoff" }
  ],
  "sections": [
    {
      "id": "operations",
      "label": "Operations",
      "rangeLabel": null,
      "description": null,
      "promptIds": [
        "operations.normal-day",
        "operations.hidden-dependency",
        "operations.first-alert"
      ]
    },
    {
      "id": "continuity",
      "label": "Continuity",
      "rangeLabel": null,
      "description": null,
      "promptIds": ["continuity.safe-change", "continuity.next-owner"]
    }
  ],
  "prompts": [
    { "id": "operations.normal-day", "kind": "long_text", "lensId": "system", "text": "Describe a normal operating day for the system you know best.", "context": null, "tags": [] },
    { "id": "operations.hidden-dependency", "kind": "long_text", "lensId": "failure-mode", "text": "What dependency would surprise a new owner if it disappeared tomorrow?", "context": null, "tags": [] },
    { "id": "operations.first-alert", "kind": "long_text", "lensId": "failure-mode", "text": "What is the earliest sign that the system is drifting toward trouble?", "context": null, "tags": [] },
    { "id": "continuity.safe-change", "kind": "long_text", "lensId": "handoff", "text": "What change can be made safely by a new owner, and what should wait?", "context": null, "tags": [] },
    { "id": "continuity.next-owner", "kind": "long_text", "lensId": "handoff", "text": "What should the next owner read, watch, or ask before making decisions?", "context": null, "tags": [] }
  ],
  "exportDefaults": { "basename": "departing-engineer-handoff" }
}
```

## Validation errors

`validatePack(input)` throws a `WolfValidationError` (from `src/engine/errors.ts`) with a message identifying the offending path, e.g.:

```text
WolfValidationError: prompts[3].lensId is not allowed
WolfValidationError: pack.theme.accent must be a safe six-digit hex color
WolfValidationError: duplicate prompt id operations.normal-day
WolfValidationError: sections[0] references unknown prompt operations.missing
WolfValidationError: packVersion must be semantic versioning
```

A failed validation never installs the pack -- there is no partial state.

## Testing a pack

### Quick check with a node one-liner

After building the engine (`npm run build` or a one-off `tsc`), or from a small script in the project, you can call `validatePack` directly:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { validatePack } from './dist/engine/index.js';
const pack = JSON.parse(readFileSync('my-pack.wolfpack.json', 'utf8'));
console.log(validatePack(pack).packId, 'is valid');
"
```

(Adjust the import path to wherever the compiled engine output lands, or run it as a TypeScript test via `npm test`.)

### Adding a fixture test

The repository's pattern is to add a fixture under `src/test-fixtures/` and a test under `tests/engine/` (see `tests/engine/pack-schema.test.ts` and `tests/packs/wolfs-deposition.test.ts` for examples). A fixture test typically asserts:

- `validatePack(pack)` does not throw
- section and prompt counts match expectations
- every prompt ID is unique and every section's `promptIds` resolve
- (for packs derived from another source) a migration map covers every legacy key

## How packs are imported at runtime

Every installed pack carries a trust level: `bundled`, `imported_unsigned`, or `quarantined` (DESIGN.md 4.8). `bundled` packs ship with the application (currently only The Wolf's Deposition). A schema-valid pack imported by a user would be stored as `imported_unsigned`; a pack that fails validation or digest checks would be retained as `quarantined` for inspection but not run.

**Current implementation status:** the Export and data screen (`src/app/screens/ExportScreen.tsx`) implements *record* bundle import (`.wolfrecord.json`) with conflict handling (replace / copy / cancel). A UI flow for importing a new *pack* file (producing an `imported_unsigned` pack row in the `packs` store) is not yet implemented -- the `packs` store and trust-level field exist in storage (`src/storage/db.ts`, `PacksScreen`), but there is no file-upload entry point for packs yet. Until that lands, new packs are added by placing a validated `*.wolfpack.json` file under `src/packs/` and registering it in the app.
