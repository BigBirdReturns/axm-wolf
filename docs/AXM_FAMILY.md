# AXM Family Context

Where AXM Wolf sits in the AXM family, what it adopted from sibling
projects, and the vocabulary that aligns Wolf's concepts with theirs.

---

## 1. Where Wolf sits

AXM Wolf is a **spoke** in the AXM protocol family: a local-first
application that produces and consumes its own portable data formats
(`*.wolfpack.json`, `*.wolfrecord.json`), without depending on any other
family member at runtime.

- **`axm` (Forge / semantic compiler)** -- compiles source documents into
  candidate claims for sealing. Wolf does not use Forge; Wolf's "source
  document" is testimony captured directly from a human subject, not an
  extraction pipeline.
- **`axm-genesis` (cryptographic kernel)** -- the only package with write
  access to the signed shard format; seals knowledge and journal shards
  with BLAKE3 Merkle trees and signatures. Wolf does not produce Genesis
  shards. The relationship today is conceptual (see §3) and a future seam
  (see §3, FUTURE).
- **`axm-core` (hub)** -- the ecosystem hub referenced by the shared
  eco-nav. Wolf links to it as a sibling but has no functional dependency.
- **`axm-chat`, `axm-show`, `axm-embodied` (spokes)** -- other
  domain-specific applications in the family, linked from the shared
  eco-nav. No functional dependency from Wolf.
- **`axm-arc` (organizational simulation engine)** -- a sibling spoke
  whose engineering conventions (versioned saves, trust labels, deploy
  pattern, `STATUS.md`) were a direct reference for Wolf's own design (see
  §2).

Wolf's own one-line description: a local-first engine for capturing tacit
institutional knowledge through structured, self-directed testimony.

---

## 2. What Wolf adopted from Arc

| Pattern | What Wolf did | Why |
| --- | --- | --- |
| Versioned-save / migration pattern | `DB_VERSION` and `STORE_NAMES` in `src/storage/db.ts`, plus `legacyMigration.ts` for migrating legacy `era__index` answer keys to stable semantic prompt IDs (idempotent, with a recovery report) | Records must survive schema changes across app versions without data loss |
| Trust-label vocabulary | `bundled` / `imported_unsigned` / `quarantined` trust tiers for installed packs (`PacksScreen.tsx`, engine validation, `digestPack`) | Gives users a clear, consistent signal about where a pack came from and whether it has been validated |
| Build-time variant mechanism | `VITE_DEPLOY_MODE` (`platform` / `single-pack`) and `VITE_DEFAULT_PACK_ID`, read and validated at startup in `src/app/config.ts` | One codebase, one `dist/`, multiple deployment shapes (general platform vs. a single subject's deposition) without forking |
| `STATUS.md` convention | `STATUS.md` at the repo root: phase table, what's live, Definition of Done matrix, known gaps, "how to pick this up" | Gives any contributor (human or agent) a cold-start orientation document that stays current |
| Actions-Pages deploy pattern | `docs/DEPLOY.md` describes building `dist/` in CI and deploying via `actions/upload-pages-artifact` + `actions/deploy-pages`, not committing `dist/` to the repo | Matches the arc-family pattern used by sibling AXM projects; keeps the repo free of build artifacts |

### What Wolf deliberately did NOT adopt from Arc

| Pattern (Arc) | Wolf's choice | Why not |
| --- | --- | --- |
| `localStorage` for saves | IndexedDB (`AXMWolf` database, custom thin adapter, no Dexie) | Long-form testimony (hundreds of revisions across 58 prompts) exceeds `localStorage`'s practical size and synchronous-API limits; IndexedDB supports structured, transactional, larger-volume storage |
| Fixed base path | Relative base path (`base: './'` in `vite.config.ts`) | The same `dist/` build must work at a domain root or a sub-path (e.g. a personal single-pack deployment vs. the general platform deployment), without rebuilding |

---

## 3. What Wolf adopted from Genesis

- **Eco-nav + landing conventions.** `docs/index.html` reuses the shared
  `.eco-nav` markup (brand, separators, kind-suffixed links, GitHub icon,
  auto-highlight script) and its `--eco-*` CSS custom-property theming
  contract, set to Wolf's own paper palette rather than genesis's dark
  amber. The status-chips row and `§ NN`-numbered section headers follow
  the same register as genesis's landing page, restated with Wolf's own
  facts (version, pack schema, first pack, test count, local-first claim).
- **Three-layer conceptual mapping.** AXM's knowledge / journal / hot-buffer
  layers (`docs/THREE_LAYERS.md` in axm-genesis) describe immutable
  reference material, an append-only decision journal, and ephemeral
  working memory sharing one container format. Wolf is not Genesis and
  seals no shards, but the same temporal shape recurs at engine scale: the
  capture pack is the immutable knowledge contract (digested via
  `packDigest`), committed response revisions are the append-only journal
  (testimony with provenance), and drafts are the hot buffer (autosaved
  working memory, never confused with the committed record). See
  `docs/index.html` §03 for the three-row presentation.
- **"Golden fixture" discipline.** Genesis treats its gold shard
  (`fm21-11-hemorrhage-v1`) as the definition of correctness: a verifier
  that breaks it is rejected, full stop. Wolf's analog is the bundled
  first pack, `wolfs-deposition.wolfpack.json` (7 sections, 58 prompts),
  together with its content-audit tests. Content extraction is never
  editorial: the 58 prompts are the content authority (the legacy "62
  questions, 7 eras" claim does not match its own source array of 58
  prompt objects), and `npm run lint` / the test suite pin the 7/58 counts
  so no UI string or future change can silently drift from the pack's
  actual content.

### FUTURE seam

- **`packDigest` as the signed-payload anchor.** `packDigest` is a
  SHA-256 hash over the canonicalized pack JSON (`canonicalizePack`,
  `digestPack`). DESIGN.md 18.1 reserves this field as the payload a
  future Genesis-signed pack format would sign over, without changing
  Wolf's record model.
- **Record bundles as candidate shard content.** A `.wolfrecord.json`
  bundle (pack snapshot + responses + revisions + provenance) is
  structurally close to the "entities/claims/evidence" shape Genesis
  shards expect. A future export path could treat a record bundle as
  candidate content for a Genesis knowledge or journal shard.

### What Wolf does NOT adopt today

- **Post-quantum signatures (ML-DSA-44 / FIPS 204).** Out of scope for a
  browser-local v0.1 with no cryptographic identity model (DESIGN.md 1.5,
  12.5). Roadmap item under §18.1.
- **Parquet.** Genesis shards use Apache Parquet + DuckDB for graph,
  evidence, and extension tables. Wolf's records are plain JSON; there is
  no analogous query layer in v0.1.
- **Merkle trees.** Genesis covers every shard byte with a BLAKE3 Merkle
  tree rooted and signed. Wolf's `packDigest` is a single SHA-256 digest
  over canonical JSON -- sufficient to detect tampering, not to build a
  verifiable tree of sub-claims. Listed as roadmap, not a v0.1 commitment.

---

## 4. Vocabulary table

| Wolf | Arc | Genesis | Notes |
| --- | --- | --- | --- |
| Pack (`*.wolfpack.json`) | Save / scenario definition | Shard (knowledge) | The reference / contract content that the application operates on |
| Record (`*.wolfrecord.json`), committed revisions | Save (versioned) | Journal shard | The append-only, provenance-bearing trace of what happened |
| `packDigest` (SHA-256 over canonical JSON) | -- | Merkle root (BLAKE3, signed) | Both are content-identity anchors; Genesis's is a signed Merkle tree, Wolf's is a single digest -- detects tampering, does not prove authorship |
| `bundled` / `imported_unsigned` / `quarantined` (pack trust tiers) | Trust-label vocabulary (origin of a save/asset) | Suite-identified signatures (`ed25519`, `axm-blake3-mldsa44`) -- "Stable" / "Post-Quantum" badges | All three describe how much a piece of content is trusted based on its origin and verification state |
