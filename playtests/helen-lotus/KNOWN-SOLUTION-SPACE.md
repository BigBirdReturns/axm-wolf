# WOLF known-solution-space contract

## Corrected product thesis

The survey is an ingestion surface, not the product.

Helen and Lotus already spend their days doing the work. WOLF must not hand them a new knowledge-management job or a stack of subscriptions. They speak, type, photograph, correct, or approve in the course of ordinary work. WOLF turns those moments into durable source records, detects when a drop belongs to a known solution space, resolves the local context that changes the answer, and offers a small number of compatible operating recipes.

The durable value loop is:

```text
lived event
  -> source-preserved knowledge drop
  -> normalized operational pattern
  -> address + jurisdiction + asset + constraint context
  -> known-solution candidates
  -> current code/rule/availability verification
  -> human-reviewed solution card
  -> reusable operating recipe
  -> outcome and recurrence evidence
  -> stronger prior for the next occurrence
```

## What WOLF should collect from an answer

One answer may emit multiple **knowledge drops**. A drop is smaller than a survey response but always points back to the exact response revision and source span.

Each drop carries:

- the words Helen or Lotus actually supplied;
- person, role, profession, organization, site, and asset context;
- event, symptom, workaround, constraint, decision, failure mode, or unwritten rule;
- time horizon: current, historical, recurring, or superseded;
- source class: operator report, direct observation, official source, manufacturer material, contractor document, vendor availability, or system inference;
- confidence and review state;
- the outcomes that later confirmed or weakened it.

The original revision remains immutable. Classification and matching are derived layers.

## Context envelope

Before WOLF says a solution is compatible, it resolves the smallest context envelope that could change the answer:

| Context | Examples | Required source |
|---|---|---|
| Location | normalized address, parcel, municipality, county, state | authoritative address/jurisdiction source |
| Authority | building, fire, health, licensing, utility, landlord, historic district | responsible authority’s current material |
| Rules | adopted code edition, local amendments, permit triggers, inspection steps | dated official publication |
| Profession | role, license boundary, safety limitations, standard operating grammar | official or recognized professional source |
| Site | occupancy/use, hours, access, hazards, utilities, installed systems | operator observation plus documents |
| Asset | manufacturer, model, serial, age, configuration, service history | label, manual, invoice, or direct evidence |
| Availability | part stock, compatible substitutes, local service coverage, lead time, price | dated vendor/manufacturer evidence |
| Preference | acceptable disruption, aesthetics, budget, reversibility, maintenance burden | named human decision |

Every volatile field carries `checkedAt`, `sourceUrl` or artifact ID, effective date when available, and an expiry/recheck policy. WOLF should say **verification needed**, not guess, when this envelope is incomplete.

## Known solution space

A solution pattern is not a product recommendation. It is a reusable decision structure:

- recognizable triggers and disqualifiers;
- facts that change the branch;
- safety and license boundaries;
- address/jurisdiction checks;
- compatible asset/configuration requirements;
- required evidence;
- ordinary implementation steps;
- verification and rollback steps;
- expected maintenance burden;
- historical outcomes and recurrence rate;
- current availability observations;
- provenance for every consequential claim.

A candidate moves through these states:

```text
pattern match
  -> context incomplete
  -> context compatible
  -> field verified
  -> owner approved
  -> implemented
  -> outcome verified
  -> reusable local recipe
```

It never jumps from “the LLM recognized something” to “do this.”

## Revised Helen loop

Synthetic playtest answer: Helen says that the shared calendar has no clear owner and promises quietly drift.

WOLF should produce:

1. A source drop: `coordination state becomes unreliable when ownership is implicit`.
2. A recurrence query across Helen’s prior records and the local KB.
3. Candidate solution patterns such as single-state ownership, change receipts, and a brief discrepancy review.
4. A compatibility check against tools already in use.
5. A no-new-subscription recipe: name an owner, expose last-updated state, and record changes inside the existing calendar/dashboard.
6. A question for Helen only where her judgment changes the branch: “Who can legitimately own this state?”
7. A visible explanation: “This helps because the same failure no longer has to be rediscovered or explained from scratch.”

The rejected playtest proposal—automatically restructuring her workflow—remains rejected because it skipped ownership and compatibility.

## Revised Lotus loop

Synthetic playtest answer: Lotus says she walks the site before trusting the dashboard and that useful exceptions live in an unowned Airtable view.

WOLF should produce:

1. Two source drops: physical-versus-digital discrepancy is an early warning; exception knowledge has no durable owner.
2. A match to inspection reconciliation and exception-register patterns.
3. An address/site context request only if it changes applicable rules, service options, or the decision branch.
4. A no-new-subscription recipe: retain the existing tool, add an owner and checked-at receipt, and make “site and dashboard disagree” a first-class exception.
5. An outcome check on the next walkthrough: did the checkpoint expose an issue earlier, and did someone close it?
6. Promotion to a reusable local recipe only after that outcome is recorded.

## Dashboard information architecture

The owner dashboard should answer five questions without opening ten tools:

1. **What dropped?** New sourced observations, workarounds, constraints, and decisions.
2. **Where else does this occur?** Recurrence clusters across people, sites, assets, and time.
3. **Is this a known solution space?** Candidate patterns with visible match reasons and disqualifiers.
4. **What is locally compatible now?** Jurisdiction, codes, asset fit, availability, burden, and verification freshness.
5. **What is the smallest durable move?** One proposed recipe, named owner, proof step, rollback, and next review date.

The recipient-facing receipt should show:

- what they said;
- what WOLF recognized;
- what was verified externally;
- what the owner accepted or rejected;
- what will change, if anything;
- how the result reduces future explanation or repeated work.

## LLM role without runtime token APIs

The operator should never need to manage a model subscription while doing the work.

Model-assisted batching is a back-office maintenance action:

1. WOLF accumulates unresolved drops locally or in D1.
2. The owner exports a frozen batch with source references and context gaps.
3. The owner runs that batch manually in an existing ChatGPT or Claude subscription.
4. The model returns candidate classifications, recurrence links, missing-context questions, and solution-pattern matches.
5. WOLF validates citations and imports every result as pending derived material.
6. Deterministic code and authoritative lookups verify addresses, jurisdiction, rules, and availability.
7. A human approves the proposed recipe.

The model organizes the search space. It does not become the authority for codes, availability, testimony, or approval.

## Minimal durable data model

The next hosted schema should add these concepts without replacing `wolf_surveys` or raw record JSON:

- `wolf_context_profiles`: address, jurisdiction, profession, site, asset, and constraint envelopes;
- `wolf_knowledge_drops`: exact source spans plus normalized operational classifications;
- `wolf_pattern_library`: versioned known-solution patterns and disqualifiers;
- `wolf_pattern_matches`: scored candidates with explanations and context gaps;
- `wolf_external_facts`: dated official/manufacturer/vendor facts with freshness policy;
- `wolf_solution_cards`: reviewed compatible options, burdens, evidence, and status;
- `wolf_operating_recipes`: owner-approved steps, verification, rollback, and maintenance;
- `wolf_outcomes`: implementation result, recurrence, cost, time, and supersession evidence.

These records should be append-only or revisioned where meaning changes. A solution card must never overwrite the testimony, drop, external fact, or prior outcome that produced it.

## “I die and it still runs” acceptance test

WOLF succeeds when a new operator can open one local or hosted workspace and determine:

- what exists at this address;
- who said or observed each consequential fact;
- which rules and sources were current when a decision was made;
- which recurring problem pattern this resembles;
- which solutions were considered and why some did not fit;
- what was actually done;
- how success was verified;
- what maintenance is due next;
- how to export the entire custody package without depending on WOLF, an LLM, or a subscription.

If the system requires Helen or Lotus to remember which external app contains the answer, the system has failed.
