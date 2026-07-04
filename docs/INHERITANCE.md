# AXM-WOLF Inheritance

Law AXM-WOLF inherits from AXM-WORLD / AXM-ARC.

This document exists so WOLF does not become a **parallel system** with different
identity, custody, save, ledger, and evidence semantics. It records the
invariants proven in the world/arc line as **law WOLF must satisfy** — not a
code drop. No AXM-WORLD code is copied here, and no WOLF implementation is
started by this document.

> **Control question:** what must WOLF inherit as law so it does not become a
> parallel system with different identity, custody, save, ledger, and evidence
> semantics?

Tracking issue: [axm-wolf#7](https://github.com/BigBirdReturns/axm-wolf/issues/7).
Precedent: axm-world #47 (backbone), #48 (playable loop), #49 (reference
acceptance target), #50 (loader identity surface).

## Inherited laws

WOLF must satisfy each of these.

1. **Authored identity is computed, not claimed.** A cartridge's identity is the
   digest of its authored arc (`cartridgeDigest(cartridge.arc)`) — derived, never
   a value asserted in the manifest.
2. **Custody metadata must not perturb authored identity.** Trust labels,
   signature slots, and provenance ride in the manifest/envelope and are stripped
   before hashing; an imported, enveloped, or provenance-marked cartridge resolves
   to the **same** identity as the raw authored law.
3. **Reserved-key stripping is top-level only.** Reserved envelope keys are
   removed at the envelope's top level before the digest — not recursively — and
   that boundary is itself a digest-law invariant.
4. **Golden manifests are committed expectations, not self-generated outputs.**
   Expected digests are pinned and committed, and guard-tested against
   recomputation; the code never regenerates its own golden to match itself.
5. **Program of record binds a fixed tuple.** A program of record binds its
   program id, cartridge (id/name), computed authored digest, bundled assets,
   runtime surfaces, save schema version, and ledger schema version — all
   resolving to the same computed digest.
6. **Loader UI displays computed identity as product identity.** The entry/boot
   surface presents the computed digest as the cartridge's identity — not a debug
   line, not a manifest claim.
7. **Saves are isolated by program or digest.** Each authored program gets its own
   save slot keyed by its authored digest; a save restores **only** into the same
   authored program (digest + schema + arc guard). One program's save never
   clobbers, shadows, or resurrects into another.
8. **Ledger entries carry the same authored digest.** Every recorded result is
   stamped with the program's authored digest, so a ledger proves which authored
   cartridge produced it and can be checked against identity.
9. **Reference artifacts are acceptance targets, not dependencies.** Mature
   reference artifacts define acceptance pressure and ambition; they are **not**
   ingested as a second source of truth.
10. **Evidence claims distinguish their basis.** Always separate CI-gated
    (typecheck/vitest) from local tests, Playwright authored receipts (not
    CI-gated), and manual review — and never overstate one as another.

## WOLF acceptance

- Before WOLF implements **loader, save, ledger, or program-identity behavior**,
  it must either **conform to these laws**, or **explicitly document why the WOLF
  domain requires a different invariant** (in this file or a linked ADR).
- WOLF must **not fork AXM-WORLD semantics silently.** A divergence is only
  legitimate when it is written down and justified by a WOLF-domain need — never
  by drift or convenience.

## Boundary

- This document copies **no** AXM-WORLD code into WOLF and starts **no** WOLF
  implementation work.
- Nothing is smuggled in under "inheritance": no signing, publisher UX, trust
  badges, seats/CPU, presets, or reference-artifact ingestion. Those are out of
  scope for the inherited law captured here.
