# Durability

The 30-year plan for AXM Wolf, and the endstate analysis behind it.

Wolf's first record is a primary source: forty years of one person's institutional memory. The record's intended horizon is not the app's release cycle — it is *someone reading this in 2056*. That horizon is longer than the plausible lifespan of the repository, the hosting, npm, the PWA platform, and possibly the subject. This document reasons about every way the system can end, and defines the plan that makes the testimony survive all of them.

The governing principle, extending DESIGN.md 1.4:

> **The record must outlive the app. The app must outlive its hosting. The format must outlive both. Plain text outlives everything.**

---

## Part 1: Endstates

Durability is not one question. The system has four independent layers, and each reaches its own terminal state. The plan's job is to guarantee that *whatever combination of endstates occurs*, the testimony remains readable and trustworthy.

### 1.1 Data endstates

Where the testimony itself can land.

| Endstate | Description | Verdict |
| --- | --- | --- |
| **Exported and redundant** | Full `.wolfrecord.json` bundles plus human-readable renderings exist in multiple places on multiple media. | **Goal state.** Every other layer can fail and the record survives. |
| **Trapped in browser** | Testimony exists only in one browser profile's IndexedDB. Browser eviction, profile deletion, device loss, or an OS reinstall destroys it. | **Failure state.** Every record is in this state between first keystroke and first export. |
| **Partially preserved** | Some exports exist, but they predate the latest committed revisions, or omit drafts/revision history. | Degraded. The append-only revision model means older exports are still *true*, just incomplete. |
| **Contested** | The record survives but its authenticity is questioned decades later. | v0.1 digests detect tampering but do not prove authorship (DESIGN.md 12.5). Resolved by the signing reserve (Part 18.1). |

The single most important fact in this document: **IndexedDB is the only failure-prone link, and it holds the only copy until the first export.** Browsers may evict site data under storage pressure; Safari can evict storage for sites unused for extended periods; a well-meaning "clear browsing data" destroys everything. Nothing about the app's correctness protects against this — only export cadence does.

### 1.2 Application endstates

What can happen to the running software.

| Endstate | Description | Record impact |
| --- | --- | --- |
| **Maintained** | Someone updates deps, fixes browser drift, ships new packs. | None. Best case, unlikely to hold for 30 years. |
| **Frozen but hosted** | No development, but the static build stays served. Because Wolf has no backend, no accounts, and no runtime API (DESIGN.md 11.4), a frozen build keeps working until browsers break it. | None, as long as exports continue. |
| **Archived static** | Hosting lapses, but `dist/` survives as files. The build is fully static with a relative base path — a zip of `dist/` plus *any* static file server is a working installation, in any decade. | Capture ends; reading and re-export still possible wherever the archive can be served. |
| **Unrunnable** | Browser platform drift breaks the frozen build (service workers removed, IndexedDB deprecated, JS engine incompatibilities) and nobody rebuilds it. | **Must be survivable.** This is the expected endstate somewhere in years 10–20. The record must already be app-independent by then. |

The design already anticipates this: the engine is framework-independent TypeScript with no browser dependency, and the bundle format is pure validated JSON. A competent developer in 2045 could write a new reader for `.wolfrecord.json` in an afternoon *from the format specification alone* — provided the specification survives with the archives (see gap G2).

### 1.3 Format endstates

What can happen to the file formats.

| Endstate | Description | Verdict |
| --- | --- | --- |
| **Current** | Bundles open in a live Wolf installation. | Years 0–10, probably. |
| **Superseded but importable** | Newer schema versions exist; v1 bundles still import. `schemaVersion` discipline makes this safe: version numbers are never reused, and importers must accept v1 **forever**. | Acceptable indefinitely. |
| **Spec-only** | No running software understands the format, but the frozen written spec + JSON's universality make it recoverable. JSON, Markdown, and plain text are among the most durable encodings ever deployed; the risk is never parsing, only *interpretation* — which the spec covers. | Acceptable, **if** the spec travels with the archives. |
| **Opaque** | Bundles survive as bytes nobody can interpret. | Failure state. Only reachable if the spec is lost *and* the self-describing structure is insufficient. The mitigations in Part 3 make this effectively unreachable. |

Two properties of the existing formats do most of the work here:

1. **Bundles are self-contained.** Every record carries its full pack snapshot (DESIGN.md 2.9), so a bundle is intelligible without the originating pack, the app, or the repo. Question text and answer text live in the same file.
2. **Human-readable exports are self-contained prose.** The Markdown and plain-text renderings interleave exact prompt text with response text, subject metadata, timestamps, and pack identity. Even in the opaque-JSON worst case, the `.txt` export *is* the record, readable by eye.

### 1.4 Custody endstates

Files do not preserve themselves; people do. The custody chain has its own endstates.

| Endstate | Description | Plan requirement |
| --- | --- | --- |
| **Active subject** | The subject is capturing and exporting. | Export cadence discipline (Part 3, years 0–2). |
| **Named custodian** | Capture is complete; a named person (family, colleague, estate) holds the archive and knows what it is. | The archive must be legible to a non-technical custodian — hence the archive kit convention (G3). |
| **Institutional archive** | The record is deposited with an archive, library, or the AXM family's successor systems. | Provenance must be verifiable: digest, and eventually signature. |
| **Orphaned artifact** | Files survive on a drive, but nobody knows what they are or why they matter. | **Mitigated, not prevented**: the plain-text export opens with the record's title, subject, and framing — an orphaned `.txt` explains itself to whoever finds it. |

The custody analysis produces the least technical and most important rule in this plan: **every archive copy must be accompanied by its human-readable renderings and a plain-text README.** A `.wolfrecord.json` alone is an artifact; a folder containing `record.txt`, `record.md`, `record.wolfrecord.json`, and `WHAT_THIS_IS.txt` is an heirloom.

### 1.5 The goal composition

The plan succeeds if the system lands in:

```text
data:    exported and redundant
app:     any state, including unrunnable
format:  spec-only or better
custody: named custodian or better
```

Every action in Part 3 exists to force one of these four coordinates.

---

## Part 2: Durability audit of the current design

What v0.1 already gets right, and where the gaps are.

### 2.1 Properties already in the record's favor

| Property | Why it matters at 30 years |
| --- | --- |
| Records carry immutable pack snapshots (DESIGN.md 2.9) | A bundle is meaningful standing alone — no dependency on the pack registry, the app, or the repo. |
| Lossless export/import round trip, tested | The export *is* the record, not a lossy report of it. |
| Markdown and plain-text renderings | The archival bottom layer. Plain text has no known expiry. |
| Append-only revisions (DESIGN.md 2.5) | Old exports never become false, only incomplete. Any surviving copy is a valid historical snapshot. |
| No backend, no accounts, no runtime network (DESIGN.md 11.4) | Nothing server-side to lapse, be acquired, or be shut down. The failure surface is the browser and the media, nothing else. |
| Fully static build, relative base path (DESIGN.md 11.3) | The built app is itself archivable and re-hostable anywhere, indefinitely. |
| Canonical SHA-256 pack digest + bundle provenance block | Tamper-evidence for the pack; engine/app versions and export timestamps recorded in every bundle. |
| Stable semantic IDs (DESIGN.md 2.4) | `early.first-day-jack-in-the-box-brooklyn` is self-describing to a future reader; `era__3` is not. |
| Framework-independent engine | The format logic is not entangled with React, Vite, or IndexedDB — it is the seed of any future reader. |
| Bounded, validated, code-free pack format (DESIGN.md 2.3) | Archives cannot carry executable payloads; a 2050 reader can parse with no sandboxing concerns. |

This is a strong base. Most systems fail the 30-year test at the design layer; Wolf's design was built app-independent from the start. The gaps are operational, not architectural.

### 2.2 Gaps

**G1 — No persistent-storage request.** The app never calls `navigator.storage.persist()`. Without it, the `AXMWolf` database is best-effort storage the browser may evict under pressure. This is the cheapest meaningful durability improvement available: request persistence when the first record is created, surface the granted/denied result on the data screen, and treat a denial as an extra reason to nudge export.

**G2 — The bundle format spec is not a standalone frozen document.** The `.wolfrecord.json` and `.wolfpack.json` structures are specified inside DESIGN.md (Parts 5–6) and Zod schemas — both entangled with a living repo. The spec-only format endstate (1.3) requires a frozen, versioned `BUNDLE_FORMAT` document that can be zipped alongside archives, written for a reader who has *only that document and a bundle file*.

**G3 — No archive kit convention.** Export currently produces individual files. The custody analysis (1.4) calls for a defined *archive kit*: one folder or zip containing the full bundle (with revision history and drafts), the Markdown rendering, the plain-text rendering, the format spec, and a short plain-text cover note saying what the record is and how to read it. This can start as a documented manual procedure and later become a one-tap "Export archive kit" action.

**G4 — No wipe-versus-eviction distinction in user guidance.** The privacy doc says "clearing browser data removes the record" but the UI does not confront the user with the asymmetry: the browser can also do this *without asking*. Export reminders (DESIGN.md 12.2) exist; the copy should state the eviction risk plainly.

**G5 — Bus factor and repository succession.** One maintainer, one hosting account, one GitHub org. Mitigations are cheap: keep clones on ≥2 personal machines, rely on public-repo harvesting by Software Heritage / Internet Archive where applicable, and — more importantly — accept that the *repo* is the least durable layer and design so its loss is survivable (which G2 and G3 accomplish).

**G6 — No signature path exercised.** Digests detect accidental change, not authorship (DESIGN.md 12.5). For a record whose value is testimonial, the contested endstate (1.1) eventually matters. The reserve exists (Part 18.1, genesis-signed packs over the existing `packDigest`); the plan schedules when to spend it.

---

## Part 3: The 30-year plan

Organized by horizon. Each phase assumes the previous one happened; each phase also assumes every layer *after* it may fail.

### Years 0–2: Active capture — get the data out of the browser

The only interval where testimony is being created, and the interval of maximum data risk (trapped-in-browser is the default state of new words).

1. **Export discipline is the durability mechanism, full stop.** During active capture: export a full bundle (with revision history) at least weekly, and after any substantial session. The app's export reminders (DESIGN.md 12.2) enforce the floor; the human enforces the habit.
2. **Close G1**: request `navigator.storage.persist()` on first record creation; show persistence state on the Export and data screen.
3. **Close G4**: eviction-risk copy in the local-data notice.
4. **Two devices, minimum.** Import the weekly bundle into a second browser/device. Round-trip import is tested and lossless; use it as live replication, not just recovery.
5. **3-2-1 from day one**: at least 3 copies of the latest bundle, on 2 kinds of media (device + cloud drive, or device + USB), 1 offsite (any cloud drive satisfies this; the bundle contains no server dependency and may be additionally encrypted at rest by the user's own means until 18.2 lands).
6. **Close G2 now, not later**: freeze `docs/BUNDLE_FORMAT.md` v1 while the authors are alive and the code is fresh. This document is written for the 2045 developer, not the 2026 one.

### Years 2–5: Record completion — produce the canonical archive

Capture winds down; the record's status moves to `completed` (a user action, DESIGN.md 6.2). The task shifts from *capturing* to *fixing the record in durable form*.

1. **The final export.** One canonical archive kit (G3): full bundle including complete revision history and any remaining drafts, Markdown, plain text, `BUNDLE_FORMAT.md`, and a cover note naming the subject, the span, and the custodian. Digest of the bundle file itself recorded in the cover note.
2. **The paper layer.** Print the plain-text rendering, or render to PDF/A. Paper and PDF/A are the only formats on this list with a *proven* multi-decade track record. One printed master with the family copy. This is not nostalgia; it is the lowest-technology rung on the ladder, and the ladder should reach the ground.
3. **Archive the app itself**: zip the final `dist/` build (both deploy modes if desired) into the archive kit. A static build plus any HTTP server is a working reader for as long as browsers run today's JavaScript — realistically well past year 10.
4. **Name the custodian.** Custody moves from *active subject* to *named custodian* (1.4) explicitly, not by default. The custodian receives a copy of the kit and one sentence of instruction: *"the `.txt` file is readable as-is; everything else is redundancy."*
5. **Distribute**: custodian copy, offsite/cloud copy, subject's own copy. Three geographic locations if possible.

### Years 5–15: App senescence — verify on a cycle, refresh the media

The app drifts toward *frozen* and then *unrunnable* (1.2). Expected and planned for; capture is over, so this costs the record nothing.

1. **Five-year verification ritual.** Every ~5 years, the custodian (or anyone) performs: open the plain-text export and read a page (custody + format check); parse the JSON bundle with any contemporary tool and check it loads (format check); if a Wolf installation still runs, import the bundle and re-export (full round-trip check).
2. **Media refresh on the same cycle.** Consumer drives and flash media degrade on 5–10 year scales; cloud accounts lapse with their owners. Every verification, copy the kit forward onto current media and confirm the recorded digest still matches. The archive's enemy at this horizon is not format death — it is bit rot and forgotten passwords.
3. **Spend the signing reserve if the record's standing warrants it** (G6): when genesis-signed packs/records exist, wrap the canonical bundle's digest in a signature while the subject can still attest. After the subject cannot, the signed digest is the record's best claim to authenticity.
4. **Format migrations wrap, never rewrite.** If a successor AXM system ingests the record (derived knowledge layer, DESIGN.md 18.3; multi-respondent collections, 18.4), the v1 bundle remains the source artifact and every derived claim cites `recordId`/`promptId`/`revisionId`. Migration produces *new containers around* the testimony, never new testimony. The 1976 Jack in the Box answer is never "cleaned up."

### Years 15–30: Format archaeology — the bottom layers hold

Assume the worst reasonable case: the app is unrunnable, the repo is gone, the AXM family has moved on or dissolved, and the custodian has changed hands once or twice.

What survives, by design:

1. **The plain-text export is the guarantee.** It requires no software beyond "display these bytes." Its interpretation requires no spec — it is prose with headings.
2. **The JSON bundle is the lossless record.** JSON parsing will outlive every current runtime; the frozen `BUNDLE_FORMAT.md` in the same folder resolves interpretation. Rebuilding a reader — or asking whatever passes for a coding assistant in 2050 to do it — is an afternoon's work against a self-contained, code-free, bounded format.
3. **The digest chain is the authenticity anchor.** SHA-256 remains sufficient for tamper-evidence at this horizon; the signature (if the reserve was spent) carries authorship.
4. **The paper copy is the fallback for total digital loss.**

The endstate composition this delivers, against Part 1.5:

```text
data:    exported and redundant     (phases 0–2 and 2–5)
app:     unrunnable — survivable    (archive kit is app-independent)
format:  spec-only — recoverable    (frozen spec travels with archives)
custody: named custodian            (explicit handoff, self-describing kit)
```

---

## Part 4: Principles

Distilled from the endstate analysis, in the spirit of DESIGN.md Part 2 — constraints, not suggestions:

1. **The export is the record.** The browser holds a working copy. Anything that exists only in IndexedDB does not yet exist.
2. **Every layer must be survivable by the layer below it.** App loss must be survivable by the bundle; bundle-interpretation loss by the spec; spec loss by the plain text; digital loss by paper.
3. **Redundancy is a human practice, not a feature.** Wolf can remind and make export effortless; it cannot hold the copies. The plan assigns that to named people on a named cycle.
4. **Never rewrite testimony to migrate it.** Wrap, cite, derive — the source revision chain is immutable across all future systems (DESIGN.md 1.4, 18.3).
5. **Write the spec for the reader who has nothing else.** The measure of `BUNDLE_FORMAT.md` is whether a stranger in 2045, holding one `.wolfrecord.json` and that document, can fully recover the record.
6. **Prefer boring formats.** JSON, Markdown, plain text, PDF/A, paper. Every exotic dependency added to the archive path is a new way to reach the opaque endstate.

## Part 5: Action summary

Near-term work items surfaced by this plan, in priority order:

| # | Action | Gap | Size |
| --- | --- | --- | --- |
| 1 | Request `navigator.storage.persist()` on first record; surface persistence state in the data screen | G1 | Small |
| 2 | Write and freeze `docs/BUNDLE_FORMAT.md` (v1 spec, standalone, written for a future stranger) | G2 | Medium |
| 3 | Document the manual archive-kit procedure in `docs/PRIVACY.md` or a new `docs/ARCHIVING.md`; later, a one-tap "Export archive kit" | G3 | Small, then medium |
| 4 | Add eviction-risk language to the local-data notice and export reminders | G4 | Small |
| 5 | Maintain ≥2 repo clones outside the hosting org; archive final `dist/` builds with the kit | G5 | Ongoing |
| 6 | Schedule the signing decision against genesis availability (Part 18.1) | G6 | Future |

None of these change the record model. That is the point: the durability plan is possible *because* the v0.1 invariants — snapshot-carrying records, lossless round trips, code-free formats, no backend — already did the architectural work. What remains is operational discipline and two documents.
