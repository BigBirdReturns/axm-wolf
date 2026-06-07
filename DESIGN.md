# axm-wolf
## Institutional Knowledge Capture Engine - Design Authority Document v0.1

**Repository:** `BigBirdReturns/axm-wolf`  
**Product:** AXM Wolf  
**First bundled capture pack:** The Wolf's Deposition  
**First subject:** William Sandhu  
**Target:** Browser-first, mobile-optimized, offline-capable PWA  
**Stack:** TypeScript, React, Vite, Zod, IndexedDB, Vitest, Playwright  
**License:** Do not add or change a license without repository-owner approval.

---

## PREFACE: HOW THIS DOCUMENT GOT HERE

This project began as a single mobile web app for recording William Sandhu's institutional memory across a forty-year career. The first implementation fused the subject, question library, interface, persistence, export logic, branding, and PWA shell into one HTML file.

That implementation proved the interaction model:

1. A person holds knowledge that does not exist in formal documentation.
2. A structured question library helps that person recover it.
3. The person answers asynchronously and in any order.
4. The browser preserves the testimony locally.
5. The record can be exported into durable, portable formats.

The larger product is not a William Sandhu oral-history app. It is an institutional knowledge capture engine.

The Wolf's Deposition is not discarded when the system generalizes. It becomes the first valid capture pack, just as the first game content in AXM Arc became the first valid arc. The engine must be able to run the first pack without containing any knowledge of William Sandhu, HP, Agilent, EDS, Autonomy, careers, eras, or depositions.

The central design risk is layer collapse. This document exists to prevent it.

---

# PART 1: PRODUCT DEFINITION

## 1.1 Product thesis

AXM Wolf captures tacit institutional knowledge from people who were present when consequential work, decisions, failures, and informal practices occurred.

Traditional knowledge systems assume that knowledge will be documented while work is happening. That often fails because the people with the knowledge are occupied, politically constrained, or unable to recognize which details will later matter.

Wolf focuses on retrospective capture:

- retirees
- founders after exit
- departing operators
- senior engineers
- program leaders
- doctrine authors
- incident witnesses
- people whose experience exists primarily in memory

Wolf does not begin by summarizing or interpreting the subject. It first preserves the subject's own record.

## 1.2 Core promise

A valid Wolf deployment must provide:

- structured prompts organized into sections
- no required answering order
- durable local draft and response persistence
- explicit record provenance
- installable PWA behavior
- offline use for all core capture and export functions
- portable pack and record formats
- human-readable exports
- safe re-import and restore
- no account, cloud service, inference API, or backend requirement

## 1.3 What is the intellectual property

The interface is replaceable. The question library is not.

A capture pack contains the domain work:

- what should be asked
- how prompts are grouped
- which lenses are used
- what contextual cues help recover memory
- what order is suggested without being required
- what metadata makes the resulting record intelligible later

The engine must make capture packs portable without reducing them to a generic form builder.

## 1.4 Source of truth

The raw response record is the source of truth.

Search indexes, summaries, themes, timelines, entity lists, embeddings, and later AI-generated outputs are derived artifacts. They must never replace or silently modify the testimony from which they were produced.

## 1.5 v1 non-goals

The first engine release does not include:

- a hosted backend
- user accounts
- collaborative editing
- multi-device synchronization
- real-time interviewing
- audio-file recording or storage
- automatic summarization
- semantic search or embeddings
- generated follow-up questions
- organization-level permissions
- at-rest application encryption
- cryptographic identity signatures
- arbitrary HTML, CSS, or JavaScript inside imported packs

These may be added later without changing the source-record model.

---

# PART 2: ARCHITECTURAL INVARIANTS

These are build constraints, not suggestions.

## 2.1 Engine and content separation

`src/engine/` must have zero imports from:

- `src/packs/`
- `src/app/`
- `src/storage/`
- any file containing The Wolf's Deposition content

The engine operates on validated types only.

## 2.2 Content-free engine

The following strings and concepts must not appear in engine code except in tests that explicitly assert their absence:

- William Sandhu
- HP
- Agilent
- EDS
- Autonomy
- Wolf's Deposition
- oral history
- career era
- The Room
- The Decision
- The Person
- The Moment
- The Thing Nobody Said

The engine knows about packs, sections, prompts, records, responses, revisions, progress, imports, and exports.

## 2.3 Safe pack boundary

A capture pack is data, never executable code.

Imported packs:

- must be JSON
- must validate before installation
- must not contain HTML
- must not load remote scripts, styles, images, or fonts
- must not define JavaScript expressions
- must not inject markup through prompt text
- must be rendered through React text nodes, not `innerHTML`

## 2.4 Stable identity

Every pack, section, prompt, record, response, and revision has a stable ID.

Array position is presentation order, not identity.

The legacy pattern `era__index` must not survive as the primary identifier.

## 2.5 Raw testimony preservation

Committing an edit appends a new revision. It does not destroy the prior revision.

The UI may show only the current revision by default, but the full revision chain must remain exportable.

## 2.6 No required order

Progress is based on responses committed, not on traversal order.

A subject may begin with any section and any prompt.

## 2.7 Offline core

After the application shell and bundled pack have loaded once, these functions must work with the browser offline:

- open the app
- create or continue a record
- browse sections and prompts
- type and save drafts
- commit responses
- edit responses
- search local records
- export JSON, Markdown, and plain text
- import a previously exported record
- delete local data

Voice transcription is a progressive enhancement and is not part of the offline guarantee.

## 2.8 No silent data loss

Long-form drafts autosave before they are committed to the record.

A browser refresh, app close, or process termination must not erase the current draft.

## 2.9 Portable round trip

A record exported as a Wolf record bundle and imported into a clean installation must preserve:

- record metadata
- pack identity and version
- the exact pack snapshot used by the record
- all committed response revisions
- active drafts, when the user selects "include drafts"
- timestamps
- completion state
- archive state

Export followed by import must be semantically lossless.

## 2.10 Derived counts

Question counts, completion counts, and section totals are computed from the loaded pack.

No UI string may hard-code `62`, `58`, `7`, or any other pack-specific count.

---

# PART 3: LEGACY REFERENCE AUDIT

The legacy proof of concept is preserved under:

```text
reference/legacy-v0/
```

It is a behavior and content reference, not the architecture to retain.

## 3.1 What must be preserved

- the AXM visual language
- mobile-first navigation
- section cards with progress
- prompt cards with response state
- answer in any order
- explicit "Save to Record" action
- IndexedDB persistence
- JSON, Markdown, and plain-text export
- installable app behavior
- the first pack's exact wording and grouping
- the title-screen framing specific to The Wolf's Deposition

## 3.2 Known legacy defects to correct

1. **Count mismatch.** The copy claims 62 questions, but the source contains 58 prompt objects across 7 sections. The 58 prompts are the current content source of truth. Do not invent four prompts. Derive all counts dynamically. Document the mismatch in migration notes.

2. **Content and runtime are fused.** All prompts, subject metadata, UI, persistence, and export logic live in one HTML file.

3. **Fragile prompt IDs.** Responses use `sectionId__arrayIndex`. Reordering prompts would attach testimony to the wrong prompt.

4. **Revision loss.** Editing overwrites the prior response and timestamp.

5. **Draft loss.** Text exists only in the textarea until the user explicitly saves.

6. **Newline corruption during edit.** The legacy HTML-escaping helper converts line breaks to `<br>` before inserting text into a textarea.

7. **Incomplete offline shell.** The service worker does not explicitly precache icons or externally loaded fonts.

8. **Runtime network dependency.** Google Fonts are loaded remotely.

9. **Root-path assumptions.** `/sw.js` and `/` start URLs are not safe for subpath deployment.

10. **No import or restore.** Exports cannot be brought back into the app.

11. **No schema validation.** Future imported content would have no safe trust boundary.

12. **Unsafe future rendering model.** The legacy app uses generated HTML strings. Imported pack content must never be inserted through `innerHTML`.

13. **No test suite.**

14. **No update strategy.** A cache-first service worker can leave users on stale code without an update notice.

15. **Speech limitations are not disclosed.** Browser speech recognition may be unavailable, may require network access, and may use browser-vendor services.

## 3.3 Migration rule

The first bundled pack must be extracted programmatically or carefully mapped from the legacy `ERAS` array.

Every legacy prompt receives a semantic stable ID. Example:

```text
early.first-day-jack-in-the-box-brooklyn
agilent.hp-software-development-center-pudong
hp-autonomy.moment-decided-to-retire
aftermath.structural-truth-large-it-organizations
```

A checked-in migration map must connect each old key to its new prompt ID:

```json
{
  "early__0": "early.first-day-jack-in-the-box-brooklyn"
}
```

Do not depend on prompt text matching at runtime.

---

# PART 4: CORE DOMAIN MODEL

## 4.1 Capture Pack

A **Capture Pack** is a portable, validated question library.

A pack defines:

- identity and version
- title and descriptive copy
- optional subject defaults
- sections
- prompts
- prompt lenses or types
- tags
- presentation tokens
- export naming defaults
- minimum compatible engine version

A pack contains no responses.

Recommended extension:

```text
.wolfpack.json
```

## 4.2 Section

A **Section** groups prompts by time period, topic, event, organization, role, system, or any other author-defined frame.

A section has:

- stable ID
- display label
- optional range label
- optional description
- ordered prompt IDs

The engine assigns no meaning to a section's organizing principle.

## 4.3 Prompt

A **Prompt** is one capture instruction presented to the subject.

v1 supports one response kind:

```text
long_text
```

A prompt may contain:

- stable ID
- lens or type label
- prompt text
- optional context cue
- optional tags
- optional required flag
- optional suggested follow-up text for human use

Suggested follow-ups are static pack content. The engine does not generate them.

## 4.4 Record

A **Record** is one subject's working and committed testimony against one capture pack.

A record stores:

- record ID
- title
- subject metadata
- pack ID and pack version
- immutable pack snapshot
- pack digest
- created and updated timestamps
- status
- response set
- draft set
- last export timestamp
- application version that created it

A record must remain intelligible even if the originating pack is later removed or updated.

## 4.5 Response

A **Response** belongs to one record and one prompt.

It contains a revision chain.

A response is considered answered when it has at least one committed, non-empty revision.

## 4.6 Revision

A **Revision** is an append-only committed version of a response.

It contains:

- revision ID
- text
- captured timestamp
- capture source
- locale
- optional supersedes revision ID

Allowed v1 sources:

```text
typed
speech_transcript
mixed
imported
```

The application does not claim that a speech transcript is an audio recording or verbatim certified transcript.

## 4.7 Draft

A **Draft** is uncommitted text associated with one record and one prompt.

Drafts:

- autosave after a short debounce
- survive reload and restart
- are not included in human-readable exports by default
- can be included in the full record bundle by explicit choice
- are cleared only after a successful commit or explicit discard

## 4.8 Pack trust

Every installed pack carries a trust level:

```text
bundled
imported_unsigned
quarantined
```

v1 behavior:

- `bundled`: shipped with the application
- `imported_unsigned`: schema-valid local import
- `quarantined`: retained for inspection but not runnable because validation or digest checks failed

Future levels may include verified and revoked.

---

# PART 5: PORTABLE PACK SCHEMA

## 5.1 Top-level shape

The exact implementation may use Zod-inferred TypeScript types, but the portable JSON must conform to this logical structure:

```json
{
  "schemaVersion": 1,
  "engineVersion": ">=0.1.0",
  "packId": "wolfs-deposition",
  "packVersion": "1.0.0",
  "title": "The Wolf's Deposition",
  "shortTitle": "Wolf's Dep.",
  "description": "A structured primary-source record.",
  "language": "en-US",
  "recordDefaults": {
    "title": "The Wolf's Deposition",
    "subject": {
      "displayName": "William Sandhu",
      "subtitle": "Oral History"
    }
  },
  "presentation": {
    "kicker": "Oral History · Primary Source",
    "abstract": "Forty years of primary source material. Pick any era, any question, any day. No order required. The record builds itself.",
    "accent": "#7a4a1e",
    "theme": "axm-paper"
  },
  "lenses": [
    {
      "id": "room",
      "label": "The Room"
    }
  ],
  "sections": [
    {
      "id": "early",
      "label": "The Early Years",
      "rangeLabel": "1976-1987",
      "description": null,
      "prompts": [
        {
          "id": "early.first-day-jack-in-the-box-brooklyn",
          "kind": "long_text",
          "lensId": "room",
          "text": "Describe your first day managing a Jack in the Box in Brooklyn. What did the physical space look like and who was already there when you arrived?",
          "context": "Brooklyn, 1976.",
          "required": false,
          "tags": ["career", "place", "first-day"]
        }
      ]
    }
  ],
  "exportDefaults": {
    "baseFilename": "wolfs-deposition",
    "documentTitle": "The Wolf's Deposition",
    "documentSubtitle": "William Sandhu"
  }
}
```

## 5.2 Validation requirements

A valid v1 pack must satisfy all of the following:

- `schemaVersion` equals `1`
- `packId`, section IDs, lens IDs, and prompt IDs use lowercase stable slugs
- `packVersion` is valid semantic versioning
- all IDs are unique in their scope
- every `lensId` reference resolves
- there is at least one section
- every section contains at least one prompt
- every prompt has non-empty plain text
- v1 prompt kind is `long_text`
- display strings have bounded lengths
- arrays have bounded sizes
- theme accent is a safe six-digit hex color
- imported strings are treated as plain text
- unknown fields are rejected by default
- incompatible `engineVersion` fails loudly
- invalid packs never partially install

Recommended safety bounds:

```text
sections: 1 to 100
prompts per section: 1 to 500
total prompts: 1 to 2,000
prompt text: 1 to 4,000 characters
context text: 0 to 2,000 characters
tags per prompt: 0 to 32
pack file size: maximum 5 MB
```

## 5.3 Canonical digest

On installation, the application computes a SHA-256 digest of canonicalized pack JSON.

Canonicalization must:

- recursively sort object keys
- preserve array order
- preserve string contents exactly
- omit no validated fields

The digest detects accidental or untracked pack changes. It does not prove author identity.

---

# PART 6: RECORD BUNDLE SCHEMA

## 6.1 Full portable archive

Recommended extension:

```text
.wolfrecord.json
```

Logical structure:

```json
{
  "schemaVersion": 1,
  "recordId": "uuid",
  "title": "The Wolf's Deposition",
  "subject": {
    "displayName": "William Sandhu",
    "subtitle": "Oral History",
    "organization": null,
    "role": null
  },
  "status": "active",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "pack": {
    "packId": "wolfs-deposition",
    "packVersion": "1.0.0",
    "packDigest": "sha256-hex",
    "snapshot": {}
  },
  "responses": [
    {
      "promptId": "early.first-day-jack-in-the-box-brooklyn",
      "revisions": [
        {
          "revisionId": "uuid",
          "text": "Response text",
          "capturedAt": "ISO-8601",
          "source": "typed",
          "locale": "en-US",
          "supersedesRevisionId": null
        }
      ]
    }
  ],
  "drafts": [],
  "provenance": {
    "engineVersion": "0.1.0",
    "appVersion": "0.1.0",
    "exportedAt": "ISO-8601"
  }
}
```

## 6.2 Record status

v1 statuses:

```text
active
completed
archived
```

`completed` is a user action. It is not automatically inferred from answering every prompt.

Progress and completion are separate concepts.

## 6.3 Import conflicts

When a record with the same `recordId` already exists, the user must choose:

- replace local record
- import as a copy with a new record ID
- cancel

Never overwrite silently.

## 6.4 Human-readable exports

The application exports:

- Markdown
- plain text

Human-readable exports contain:

- record title
- subject metadata
- export timestamp
- pack identity and version
- sections in pack order
- prompt lens
- exact prompt text
- current response text
- response timestamp
- optional revision history when selected

By default, unanswered prompts are omitted from human-readable exports.

The full Wolf record bundle always retains the complete pack snapshot.

---

# PART 7: ENGINE API

`src/engine/` is framework-independent TypeScript.

Minimum public functions:

```ts
validatePack(input: unknown): CapturePack

canonicalizePack(pack: CapturePack): string

digestPack(pack: CapturePack): Promise<string>

createRecord(input: CreateRecordInput): WolfRecord

commitResponse(
  record: WolfRecord,
  promptId: string,
  text: string,
  source: CaptureSource,
  timestamp?: string
): WolfRecord

getCurrentResponse(
  record: WolfRecord,
  promptId: string
): ResponseRevision | null

computeProgress(
  pack: CapturePack,
  record: WolfRecord
): ProgressSummary

searchRecords(
  query: string,
  records: WolfRecord[]
): SearchResult[]

buildRecordBundle(
  record: WolfRecord,
  options?: ExportOptions
): WolfRecordBundle

importRecordBundle(
  input: unknown
): WolfRecordBundle

renderMarkdown(
  bundle: WolfRecordBundle,
  options?: HumanExportOptions
): string

renderPlainText(
  bundle: WolfRecordBundle,
  options?: HumanExportOptions
): string

sanitizeFilename(input: string): string
```

## 7.1 Engine behavior

- functions do not access React state
- functions do not access IndexedDB directly
- functions do not access `window`, `document`, service workers, or speech APIs
- mutation should be avoided; return updated values
- invalid prompt IDs throw typed errors
- empty committed responses are rejected
- progress ignores stale response IDs not present in the record's pack snapshot
- search returns exact source references, never generated answers

## 7.2 Progress summary

```ts
type ProgressSummary = {
  totalPrompts: number
  answeredPrompts: number
  draftPrompts: number
  wordCount: number
  percentAnswered: number
  bySection: Array<{
    sectionId: string
    totalPrompts: number
    answeredPrompts: number
    draftPrompts: number
    percentAnswered: number
  }>
}
```

Word count must use one shared implementation across the UI and exports.

## 7.3 Search

v1 search is deterministic local lexical search.

It searches:

- record title
- subject metadata
- section labels
- range labels
- lens labels
- prompt text
- prompt tags
- current response text

Search results include:

```ts
type SearchResult = {
  recordId: string
  sectionId: string
  promptId: string
  field: "prompt" | "response" | "metadata"
  snippet: string
  score: number
}
```

No inference, embeddings, remote service, or generated summary is used.

---

# PART 8: STORAGE ARCHITECTURE

## 8.1 IndexedDB database

Database name:

```text
AXMWolf
```

Use Dexie or a comparably thin typed IndexedDB wrapper.

Recommended stores:

```text
packs
records
responses
drafts
settings
migrations
```

Suggested indexes:

```text
packs:       &packId, packVersion, trust, installedAt
records:     &recordId, packId, status, updatedAt
responses:   &[recordId+promptId], recordId, promptId, updatedAt
drafts:      &[recordId+promptId], recordId, promptId, updatedAt
settings:    &key
migrations:  &id, completedAt
```

Pack snapshots may be stored with the record or in a normalized snapshot store. The exported record must not depend on a separately installed current pack.

## 8.2 Draft autosave

- debounce target: 500 to 1,000 ms after typing stops
- show `Saving`, `Saved`, or `Save failed`
- flush pending draft on page visibility change when possible
- never mark a prompt answered from a draft alone
- successful commit clears the matching draft in the same transaction

## 8.3 Transaction boundaries

Committing a response must atomically:

1. read the current response
2. append a revision
3. update response timestamp
4. clear the draft
5. update record timestamp

A failure at any point must leave the prior committed state intact.

## 8.4 Legacy database migration

Legacy database:

```text
WolfsDeposition
```

Legacy store:

```text
answers
```

Legacy key form:

```text
<sectionId>__<arrayIndex>
```

If the new application runs on the same origin:

1. detect the legacy database
2. read all legacy answers
3. map keys through the checked-in migration map
4. create one Wolf record for William Sandhu
5. convert each answer to a single imported revision
6. preserve the legacy timestamp
7. mark the migration complete
8. do not delete the legacy database automatically
9. show a migration summary to the user

Unknown legacy keys are exported to a recovery report and never discarded silently.

---

# PART 9: APPLICATION ARCHITECTURE

## 9.1 Repository structure

Target structure:

```text
axm-wolf/
├── AGENTS.md
├── DESIGN.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── playwright.config.ts
├── public/
│   ├── icons/
│   └── robots.txt
├── reference/
│   └── legacy-v0/
│       ├── index.html
│       ├── sw.js
│       ├── manifest.json
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── engine/
│   │   ├── types.ts
│   │   ├── schema.ts
│   │   ├── validation.ts
│   │   ├── canonicalize.ts
│   │   ├── records.ts
│   │   ├── progress.ts
│   │   ├── search.ts
│   │   ├── export.ts
│   │   ├── import.ts
│   │   ├── filenames.ts
│   │   └── errors.ts
│   ├── storage/
│   │   ├── db.ts
│   │   ├── packRepository.ts
│   │   ├── recordRepository.ts
│   │   ├── draftRepository.ts
│   │   └── legacyMigration.ts
│   ├── packs/
│   │   ├── registry.ts
│   │   └── wolfs-deposition/
│   │       ├── pack.wolfpack.json
│   │       ├── legacy-id-map.json
│   │       └── README.md
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.ts
│   │   ├── config.ts
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── speech/
│   │   └── styles/
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/
│   ├── engine/
│   ├── storage/
│   ├── app/
│   ├── fixtures/
│   └── e2e/
└── scripts/
    ├── extract-legacy-pack.ts
    └── verify-engine-boundary.ts
```

## 9.2 Stack rules

Use:

- TypeScript in strict mode
- React
- Vite
- Zod for runtime schema validation
- IndexedDB through Dexie or a small typed adapter
- Vitest
- React Testing Library
- `fake-indexeddb` for storage tests
- Playwright for critical browser flows
- `vite-plugin-pwa` or an equivalent maintained Vite integration

Do not add:

- a server framework
- a database server
- authentication libraries
- analytics
- an AI SDK
- a rich-text editor
- a global state framework unless React state and focused hooks prove inadequate

## 9.3 Routing

Use hash-based or otherwise static-host-safe client routing.

Required route concepts:

```text
/
#/records
#/record/:recordId
#/record/:recordId/section/:sectionId
#/record/:recordId/prompt/:promptId
#/record/:recordId/search
#/record/:recordId/export
#/packs
#/settings
```

A refresh on any route must not require server rewrite rules.

## 9.4 Application modes

The same codebase supports two build-time deployment modes.

### Platform mode

```text
VITE_DEPLOY_MODE=platform
```

Behavior:

- AXM Wolf title
- record library first
- pack library available
- create or import record
- multiple packs and records

### Single-pack mode

```text
VITE_DEPLOY_MODE=single-pack
VITE_DEFAULT_PACK_ID=wolfs-deposition
```

Behavior:

- first launch emphasizes The Wolf's Deposition
- pack-specific title and PWA metadata
- one-tap continue
- pack library remains accessible but secondary
- no forked codebase

Cloudflare can deploy the same repository with single-pack configuration for William's app and platform configuration for the general product.

---

# PART 10: USER EXPERIENCE

## 10.1 Required screens

### Launch and record library

Shows:

- application or pack title based on deployment mode
- continue most recent record
- create record
- import record
- installed packs
- local-data notice
- install-app action when available

### Record home

Shows:

- record title
- subject
- answered count
- draft count
- word count
- progress strip
- section cards
- search
- export
- data status

### Section view

Shows:

- section label and range
- prompt list
- answered state
- draft state
- current-response preview
- no forced order

### Prompt view

Shows:

- section context
- lens label
- full prompt
- optional context cue
- textarea
- autosave status
- commit action
- speech action when supported
- revision history action
- previous and next navigation

### Search view

Shows exact local matches with:

- record
- section
- prompt
- matching snippet
- direct navigation to source response

### Export and data view

Shows:

- full Wolf record bundle
- Markdown
- plain text
- revision-history option
- include-drafts option for the full bundle
- last export timestamp
- import
- archive
- delete with confirmation

## 10.2 Commit language

The UI distinction must be clear:

- typing creates a saved draft
- `Save to Record` commits a revision
- editing and saving creates another revision
- revision history remains available

Do not imply that autosaved draft text is already on the permanent record.

## 10.3 Speech input

Use the browser Speech Recognition API through an adapter.

Behavior:

- hide or disable the control when unsupported
- disclose that availability and network use depend on the browser
- do not claim offline voice transcription
- append final transcript to the draft
- visibly distinguish listening state
- handle permission denial
- handle no-speech and network errors
- preserve already typed text
- never commit automatically
- record `speech_transcript` or `mixed` only when the response is committed

## 10.4 Install behavior

Do not promise an automatic browser banner.

- capture `beforeinstallprompt` when available
- show an in-app install action
- provide manual Android Chrome instructions when the event is unavailable
- detect standalone display mode
- do not repeatedly nag after dismissal
- installation is optional

## 10.5 Visual system

Preserve the AXM paper interface:

- cream paper background
- near-black ink
- brick or brown accent
- condensed display face
- readable serif body
- monospaced metadata
- strong section rules
- no gradients
- no decorative animation that delays capture

Runtime assets must be local. Use licensed package-based fonts or robust local font stacks. The app must remain fully usable if custom fonts fail.

## 10.6 Accessibility

Minimum requirements:

- WCAG 2.2 AA contrast
- body text at least 16 px
- tap targets at least 44 by 44 CSS pixels
- visible keyboard focus
- semantic headings
- buttons for actions, links for navigation
- labels for textareas and status regions
- live region for save status
- reduced-motion support
- no color-only response state
- screen-reader-readable progress
- text zoom to 200 percent without loss of function

---

# PART 11: PWA AND OFFLINE BEHAVIOR

## 11.1 App shell

Precache:

- HTML shell
- compiled JavaScript and CSS
- local icons
- local font assets
- bundled pack JSON
- fallback route assets

Do not use an unrestricted cache-first handler for every request.

## 11.2 Update behavior

- detect a waiting service worker
- show `Update available`
- allow user-controlled activation
- do not reload while a draft is actively unsaved
- preserve IndexedDB data across application updates
- version storage migrations explicitly

## 11.3 Base-path safety

All asset and service-worker paths must work at:

```text
https://example.com/
https://example.com/axm-wolf/
```

Do not hard-code root absolute paths unless they are derived from Vite base configuration.

## 11.4 Runtime network policy

Core app operation must make no runtime network requests.

Allowed exception:

- browser-managed speech recognition initiated by the user

No analytics, telemetry, remote font, remote image, or API request is permitted in v1.

---

# PART 12: PRIVACY, SECURITY, AND PROVENANCE

## 12.1 Local-first notice

The application must state plainly:

- responses are stored in this browser profile on this device
- clearing browser data may remove the local record
- exporting a record is the backup and transfer mechanism
- no server receives the testimony in v1

## 12.2 Export reminders

Track `lastExportedAt`.

Show a non-blocking reminder when:

- a record has at least five committed responses and has never been exported
- ten or more new revisions have been committed since the last export
- the record has not been exported for a configurable period

Do not interrupt active writing.

## 12.3 Imported content

- parse JSON, never evaluate it
- validate before storage
- enforce file-size limits
- reject prototype-pollution keys
- render all content as text
- sanitize generated filenames
- do not follow URLs from packs
- do not load pack-provided remote assets

## 12.4 Data deletion

Deleting a record requires:

1. record title confirmation
2. a reminder to export
3. explicit irreversible confirmation

Deleting an installed pack must not delete records that contain their own pack snapshots.

## 12.5 Provenance model

v1 provenance includes:

- pack ID
- pack version
- pack digest
- application version
- engine version
- response revision timestamps
- capture-source labels
- export timestamp

Future signatures may attest identity, but v1 must not represent a plain digest as a signature.

---

# PART 13: FIRST BUNDLED PACK

## 13.1 Pack identity

```text
packId: wolfs-deposition
packVersion: 1.0.0
title: The Wolf's Deposition
subject: William Sandhu
sections: 7
prompts: 58 in the current legacy source
```

The UI must display the derived prompt count.

## 13.2 Content preservation

Preserve:

- section labels
- section ranges
- prompt lens labels
- exact prompt wording
- context cues
- Pulp Fiction-inspired deposition framing
- William-specific title and subtitle
- current accent and paper treatment

Correct only:

- typographic encoding
- inaccessible punctuation presentation
- implementation bugs
- stale hard-coded counts

Do not editorially rewrite the questions during engine extraction.

## 13.3 First pack as proof of generality

The first pack may be subject-specific. The engine may not be.

A second test fixture must prove structural generality. It does not need production-quality content.

Create a small test pack, not shown in the production library, with:

- 2 sections
- 5 prompts
- no dates or eras
- different lens labels
- a different title and accent
- a generic departing-engineer subject

All engine and UI tests that can use the generic fixture should use it. William-specific tests should be limited to content validation and migration.

---

# PART 14: TESTING REQUIREMENTS

## 14.1 Required scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "check": "npm run lint && npm run typecheck && npm test && npm run build"
  }
}
```

Exact tooling can vary slightly, but `npm run check` is the required local gate.

## 14.2 Engine unit tests

Cover:

- valid pack acceptance
- invalid schema rejection
- duplicate ID rejection
- unresolved lens rejection
- incompatible engine version rejection
- canonical digest stability
- record creation
- response commit
- revision append
- empty response rejection
- progress calculation
- draft exclusion from answered count
- word count
- lexical search
- filename sanitization
- Markdown rendering
- plain-text rendering
- record-bundle validation
- export and import round trip
- pack snapshot preservation
- record conflict behavior

## 14.3 First-pack tests

Assert:

- exactly 7 sections
- exactly 58 current prompts
- all prompt IDs are unique
- all legacy keys have a migration-map entry
- every migration-map target exists
- all original prompt text and context cues are present
- no UI or manifest copy hard-codes 62

This test makes the known mismatch explicit and prevents silent invention.

## 14.4 Storage tests

Using `fake-indexeddb`, cover:

- draft persistence
- commit transaction
- draft clear after commit
- failed commit retains prior state
- response revision history
- record list ordering
- pack installation
- record survives pack removal
- legacy migration
- unknown legacy-key recovery report
- migration idempotence

## 14.5 Component tests

Cover:

- launch screen in both deployment modes
- derived counts
- answered and draft visual states
- save-status announcements
- unsupported speech state
- permission-denied speech state
- import validation errors
- delete confirmation
- install-action fallback
- revision-history display

## 14.6 End-to-end tests

At minimum:

1. Launch single-pack mode.
2. Create the William Sandhu record.
3. Open a prompt out of order.
4. Type a draft.
5. Reload before commit.
6. Confirm the draft survives.
7. Commit the response.
8. Edit and commit a second revision.
9. Confirm both revisions exist.
10. Export a Wolf record bundle.
11. Clear application data.
12. Import the bundle.
13. Confirm exact restoration.
14. Set browser context offline.
15. Reload and continue capture.
16. Export Markdown while offline.

Also test platform mode with the generic fixture.

## 14.7 Boundary verification

Add a script or test that fails if files under `src/engine/` import from:

```text
src/packs
src/app
src/storage
```

Also scan engine source for first-pack-specific strings.

---

# PART 15: IMPLEMENTATION ORDER

Codex should implement in this order.

## Phase 0: Preserve and inspect

- place the legacy five-file app under `reference/legacy-v0/`
- verify the current prompt count
- generate a machine-readable inventory
- create the legacy ID migration map
- document the 62-versus-58 mismatch
- make no content edits

**Exit gate:** extraction tests prove 7 sections, 58 prompts, and complete migration mapping.

## Phase 1: Scaffold and schema

- initialize Vite, React, and strict TypeScript
- add Zod and test infrastructure
- define pack and record schemas
- implement validation and typed errors
- create the generic test fixture
- add engine-boundary test

**Exit gate:** schemas validate both the generic fixture and the first bundled pack.

## Phase 2: Pure engine

- implement record creation
- implement response revision commits
- implement progress
- implement lexical search
- implement canonical digest
- implement JSON bundle import/export
- implement Markdown and plain-text rendering
- implement filename sanitization

**Exit gate:** engine tests pass with no browser environment.

## Phase 3: Storage

- implement IndexedDB schema
- implement repositories
- implement draft autosave
- implement atomic commit
- implement legacy migration
- implement record import conflict handling

**Exit gate:** storage tests pass under `fake-indexeddb`.

## Phase 4: UI parity and improvement

- implement launch and record screens
- implement section and prompt navigation
- preserve AXM house style
- add draft state and save status
- add revision history
- add speech adapter
- add search
- add export and data controls

**Exit gate:** all legacy user-visible capture behavior exists, with the listed defects corrected.

## Phase 5: PWA and deployment modes

- add service worker and manifest generation
- bundle all runtime assets
- add update notice
- add install flow and manual fallback
- implement platform and single-pack modes
- confirm root and subpath builds

**Exit gate:** offline end-to-end test passes.

## Phase 6: Documentation and release

- write README
- document pack authoring
- document local privacy model
- document Cloudflare Pages deployment
- add screenshots only after the UI is stable
- run the full check suite

**Exit gate:** a new developer can clone, run, test, build, author a pack, and deploy without private instructions.

---

# PART 16: DEFINITION OF DONE

v0.1 is complete only when all conditions below are true.

## Architecture

- `src/engine/` contains no first-pack knowledge
- the first pack exists as validated portable data
- the generic fixture runs through the same engine and UI
- no imported pack can execute code or inject markup
- all IDs are stable and semantic

## Data integrity

- drafts survive reloads
- committed edits preserve prior revisions
- record export and import are lossless
- pack snapshots remain with records
- legacy answers can migrate on the same origin
- no hard-coded prompt totals remain

## Offline behavior

- the application opens offline after first load
- bundled packs work offline
- capture, edit, search, and export work offline
- all core fonts and assets are local
- speech is correctly labeled as optional and potentially network-dependent

## User experience

- answering in any order works
- progress is derived correctly
- the first deployment still feels like The Wolf's Deposition
- platform mode feels like AXM Wolf
- install guidance works without promising an automatic banner
- save state is always visible
- accessibility requirements are met

## Quality gate

These commands succeed from a clean checkout:

```bash
npm ci
npm run check
npm run test:e2e
```

The production build contains no runtime dependency on a backend or third-party API.

---

# PART 17: README REQUIREMENTS

The generated README must lead with the generalized engine, then identify the first pack.

Suggested opening:

```text
# AXM Wolf

A local-first engine for capturing tacit institutional knowledge through structured, self-directed testimony.

Capture packs define the questions. Wolf preserves the record.

The first bundled pack is The Wolf's Deposition, a primary-source record for William Sandhu's forty-year career in institutional IT.
```

The README must include:

- what the engine does
- what a capture pack is
- what the first pack is
- repository layer table
- privacy model
- quick start
- test commands
- deployment modes
- pack-authoring link
- known limitations
- roadmap
- AXM family context

Do not call the application an AI interviewer. v0.1 performs no inference.

---

# PART 18: FUTURE-COMPATIBLE EXTENSIONS

These are architectural reserves, not v0.1 requirements.

## 18.1 Signed packs

A future pack may include author identity and a signature chain through AXM verification tooling.

The existing `packDigest` field must remain useful as the signed payload digest.

## 18.2 Encrypted exports

A future record export may be encrypted with a passphrase or recipient key.

Encryption wraps the existing Wolf record bundle. It does not change the internal record model.

## 18.3 Derived knowledge layer

Future processing may create:

- timelines
- entity indexes
- decision registers
- contradiction maps
- topic summaries
- searchable embeddings
- question suggestions

Every derived claim must cite:

```text
recordId
promptId
revisionId
exact source span when available
```

Derived artifacts never overwrite testimony.

## 18.4 Multiple respondents

A future project may combine records from multiple subjects under one knowledge collection.

The unit of provenance remains the individual response revision.

## 18.5 Attachments and audio

Future revisions may reference local or external evidence objects.

The text response model remains valid when attachments are absent.

## 18.6 Hosted synchronization

A future sync layer may replicate encrypted record bundles.

The local engine and portable formats must continue to function without that service.

---

# PART 19: CODEX EXECUTION CONTRACT

Before changing code, Codex must:

1. read this document completely
2. inspect `reference/legacy-v0/`
3. report the legacy prompt count from source
4. identify the engine/content/UI boundaries
5. present a phase-by-phase implementation plan
6. begin with Phase 0 unless the repository already proves that phase complete

During implementation:

- do not invent the four prompts implied by the stale `62` claim
- do not rewrite first-pack questions
- do not collapse the first pack back into React components
- do not add a backend
- do not add AI or analytics
- do not sacrifice revision history for a simpler overwrite model
- do not claim speech recognition is offline
- do not mark work complete while tests are failing
- do not leave placeholder implementations in a completed phase
- do not silently weaken validation to accept malformed fixtures

When a phase is complete, Codex must report:

- files changed
- invariants verified
- tests added
- commands run
- results
- remaining known issues

The design authority is this document. When implementation convenience conflicts with an invariant, the invariant wins.
