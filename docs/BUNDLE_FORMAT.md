# The Wolf Record Bundle Format, version 1

**Status: FROZEN.** This document specifies schema version 1 of the AXM Wolf portable formats: the record bundle (`.wolfrecord.json`) and the capture pack (`.wolfpack.json`). Version 1 is frozen as of 2026. If the formats ever evolve, later versions will use new `schemaVersion` numbers and this document will remain the complete, permanent specification of version 1. Version numbers are never reused, and conforming readers accept version 1 forever.

## Who this document is for

You may be reading this decades from now, holding a file whose software no longer runs. This specification assumes you have **only this document and the file**. Nothing else is required. The file is UTF-8 encoded JSON (ECMA-404 / RFC 8259): if you can parse JSON — in any language, in any era — you can fully recover the record.

**What these files are:** AXM Wolf was a local-first tool for capturing tacit institutional knowledge as structured, self-directed testimony. A *capture pack* is a library of questions. A *record bundle* is one person's answers to one pack, with full editing history. The testimony in a record bundle is a primary source: the subject's own words, verbatim, as typed or dictated. Derived works may summarize it; nothing may silently alter it.

## Reading a record in sixty seconds

For a `.wolfrecord.json` file, the minimal recipe:

1. Parse the JSON. Confirm `schemaVersion` is `1`.
2. The subject is `subject.displayName`. The record's title is `title`.
3. The questions live in `pack.snapshot`: iterate `pack.snapshot.sections` in array order; each section lists `promptIds`; look each ID up in `pack.snapshot.prompts` (match on `id`) for the question text.
4. The answers live in `responses`: for each entry, `promptId` names the question and **the last element of `revisions` is the current answer text** (`revisions[revisions.length - 1].text`).
5. Earlier elements of `revisions` are prior versions the subject later edited — kept deliberately, never deleted. Each revision's `capturedAt` says when; `source` says how (`typed`, `speech_transcript`, `mixed`, `imported`).
6. `drafts`, if present, are unfinished answers the subject never committed. Treat them as marginalia, not testimony.

That is the whole model. Everything below is precision.

## Conventions

- All timestamps are ISO-8601 strings (e.g. `2026-04-19T02:30:00Z`).
- All IDs are opaque strings; prompt, section, lens, and pack IDs are lowercase slugs (letters, digits, `.` and `-` separators) chosen to be human-meaningful (e.g. `flood.labor-day-timeline`).
- Array order is significant for presentation (sections, prompts within sections, revisions in time order). Identity is always the ID, never the array position.
- Fields marked *nullable* may be `null`; absent optional fields mean the same as `null`.

## The record bundle (`.wolfrecord.json`)

Top-level object:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | `1` | Format version. This document. |
| `recordId` | string | Stable unique ID of this record (typically a UUID). |
| `title` | string | Human title of the record. |
| `subject` | object | Who testified. See **Subject**. |
| `status` | string | `active`, `completed`, or `archived`. `completed` is a human declaration, not a computed state. |
| `createdAt` | ISO-8601 | When the record was created. |
| `updatedAt` | ISO-8601 | Last modification. |
| `pack` | object | The question library, embedded. See **Pack envelope**. |
| `responses` | array | The testimony. See **Responses and revisions**. |
| `drafts` | array | Uncommitted text, if the exporter chose to include drafts. See **Drafts**. |
| `provenance` | object | `engineVersion`, `appVersion` (software versions that produced the export) and `exportedAt` (ISO-8601). |

### Subject

| Field | Type | Meaning |
| --- | --- | --- |
| `displayName` | string | The subject's name. |
| `subtitle` | string, nullable | Framing line (e.g. "Oral History"). |
| `organization` | string, nullable | Affiliation, if any. |
| `role` | string, nullable | Role, if any. |

### Pack envelope

The bundle is **self-contained**: it embeds the complete pack it was answered against, so the record is intelligible with no other file.

| Field | Type | Meaning |
| --- | --- | --- |
| `packId` | string | Pack's stable ID. |
| `packVersion` | string | Pack's semantic version. |
| `packDigest` | string | SHA-256 hex digest of the canonicalized snapshot. See **Digest**. |
| `snapshot` | object | The full capture pack, exactly as installed when the record was created. See **The capture pack**. |

### Responses and revisions

`responses` is an array of:

| Field | Type | Meaning |
| --- | --- | --- |
| `promptId` | string | Which question this answers (resolves in `pack.snapshot.prompts`). |
| `revisions` | array | Append-only history, oldest first. Never empty for an answered prompt. |

Each revision:

| Field | Type | Meaning |
| --- | --- | --- |
| `revisionId` | string | Unique ID of this revision. |
| `text` | string | The testimony. Plain text; line breaks are `\n`. **This is the payload everything else exists to protect.** |
| `capturedAt` | ISO-8601 | When this version was committed. |
| `source` | string | `typed` (keyboard), `speech_transcript` (browser speech-to-text of live dictation — text only, never audio), `mixed` (both), `imported` (migrated from an earlier system). |
| `locale` | string | BCP-47 language tag, e.g. `en-US`. |
| `supersedesRevisionId` | string, nullable | ID of the revision this one replaced; `null` for the first. Forms a chain: revision *i* supersedes revision *i−1*. |

Semantics: an edit **appends**; nothing is overwritten. The current answer is the last revision. A prompt with no entry in `responses` was never answered. Prompts may be answered in any order; the record carries no ordering obligation.

### Drafts

Each draft: `promptId`, `text`, `updatedAt`. A draft is autosaved work-in-progress the subject never committed to the record. It is honest material but was not declared final — present it as such or omit it.

## The capture pack (`.wolfpack.json`, and `pack.snapshot`)

A standalone pack file and an embedded snapshot have the identical shape. A pack contains **no responses** — it is a question library, safe plain data, never code.

Top-level object:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | `1` | Format version. |
| `packId` | string | Stable slug. |
| `packVersion` | string | Semantic version (`major.minor.patch`). |
| `engineVersion` | string | Version range of the engine the pack targets (informational for archival readers). |
| `title` | string | Pack title. |
| `subtitle` | string, nullable, optional | Subtitle. |
| `description` | string, nullable, optional | What this pack is. |
| `subjectDefaults` | Subject object, optional | Default subject metadata for new records. |
| `theme` | object | `{ accent }`: a six-digit hex color. Presentation only. |
| `lenses` | array | `{ id, label }` pairs. A *lens* is a labeled angle of inquiry (e.g. "The Room", "The Unwritten Ledger") used to vary how prompts approach a topic. |
| `sections` | array | See below. Order is presentation order. |
| `prompts` | array | See below. The authoritative prompt list. |
| `exportDefaults` | object, optional | `{ basename }`: suggested export filename stem. |
| `recommendedCadence` | string, optional | `once`, `weekly`, `biweekly`, `monthly`, or `campaign` — the authors' suggested answering rhythm. |

Section: `id`, `label`, `rangeLabel` (nullable — e.g. a year span), `description` (nullable), `promptIds` (ordered array; every ID resolves in `prompts`).

Prompt: `id`, `kind` (always `long_text` in v1), `lensId` (resolves in `lenses`), `text` (the question, plain text), `context` (nullable — a memory cue), `tags` (array of strings), `required` (boolean; advisory), `suggestedFollowUp` (nullable — a static deepening question for human use; never machine-generated).

## Digest

`packDigest` is the SHA-256 hash, as 64 lowercase hex characters, of the *canonicalized* pack JSON. Canonicalization:

1. Recursively sort all object keys lexicographically, at every nesting level.
2. Preserve array order exactly.
3. Preserve string contents exactly.
4. Omit fields whose value is `undefined`/absent; keep `null` fields.
5. Serialize with no whitespace (the compact form of ECMA-404 serialization, i.e. `JSON.stringify` semantics: separators `,` and `:`, strings with standard JSON escaping).
6. Encode the resulting string as UTF-8 and hash with SHA-256.

To verify a bundle's snapshot: canonicalize `pack.snapshot` by the rules above, hash it, and compare with `packDigest`. A match means the embedded questions are exactly what the subject answered. **The digest proves integrity, not authorship** — version 1 has no signatures. Treat a mismatch as tampering or corruption, not as a different author.

## Trust and safety notes for implementers of readers

- Packs and bundles are **data**. Nothing in them is executable and nothing in a conforming reader should evaluate, render as markup, or fetch anything found in them. All strings are plain text.
- Reject objects containing the keys `__proto__`, `prototype`, or `constructor` (prototype-pollution hygiene for JavaScript readers; harmless elsewhere).
- Unanswered prompts are normal. Do not confuse a pack's prompt count with an obligation.
- When re-exporting or migrating, **never rewrite revision text, timestamps, sources, or chain links**. Wrap the bundle in new containers if you must; the testimony inside is immutable by design.

## Worked minimal example

```json
{
  "schemaVersion": 1,
  "recordId": "0f0e0d0c-0b0a-4009-8807-060504030201",
  "title": "Example Record",
  "subject": { "displayName": "A. Subject", "subtitle": null, "organization": null, "role": null },
  "status": "active",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-02T00:00:00Z",
  "pack": {
    "packId": "example-pack",
    "packVersion": "1.0.0",
    "packDigest": "…64 hex chars…",
    "snapshot": {
      "schemaVersion": 1,
      "packId": "example-pack",
      "packVersion": "1.0.0",
      "engineVersion": ">=0.1.0 <1.0.0",
      "title": "Example Pack",
      "theme": { "accent": "#123456" },
      "lenses": [{ "id": "lens", "label": "The Lens" }],
      "sections": [{ "id": "one", "label": "Section One", "rangeLabel": null, "description": null, "promptIds": ["one.q"] }],
      "prompts": [{ "id": "one.q", "kind": "long_text", "lensId": "lens", "text": "What happened?", "context": null, "tags": [], "required": false, "suggestedFollowUp": null }]
    }
  },
  "responses": [
    {
      "promptId": "one.q",
      "revisions": [
        { "revisionId": "r1", "text": "First version.", "capturedAt": "2026-01-01T12:00:00Z", "source": "typed", "locale": "en-US", "supersedesRevisionId": null },
        { "revisionId": "r2", "text": "Corrected version.", "capturedAt": "2026-01-02T00:00:00Z", "source": "typed", "locale": "en-US", "supersedesRevisionId": "r1" }
      ]
    }
  ],
  "drafts": [],
  "provenance": { "engineVersion": "0.1.0", "appVersion": "0.1.0", "exportedAt": "2026-01-02T00:00:00Z" }
}
```

The current answer to "What happened?" is `"Corrected version."`; the record also preserves that it once read `"First version."` and when that changed. That preservation is the format's reason to exist.

---

*This specification corresponds to DESIGN.md Parts 5–6 and the reference implementation in `src/engine/` (schema.ts, bundle.ts, canonicalize.ts, digest.ts) at engine version 0.1.0. Where this document and any later implementation disagree about version 1, this document wins. Include a copy of this file alongside archived records — see docs/ARCHIVING.md.*
