# WOLF Ops

**Status:** experimental operational layer built beside the v0.1 testimony engine.

WOLF Ops turns local residue into a durable operating state. It does not replace the testimony record. The testimony engine preserves what a person said, with revisions and provenance. WOLF Ops preserves what a site currently contains, what was observed, which uncertainties remain consequential, which options are still live, what work was assigned, and what evidence proves durable closure.

## Product boundary

The operating loop is:

```text
residue
  -> source-separated evidence
  -> local asset and site state
  -> live hypotheses
  -> guided observation
  -> non-dominated decision options
  -> work order
  -> verification
  -> closure
```

The domain prior supplies the ordinary workflow grammar and known failure branches. The local model supplies the actual equipment, installation, history, people, costs, constraints, and preferences. WOLF should ask a person only for observations or judgments that change the action path.

The first implementation remains offline and deterministic. It contains no runtime AI SDK or remote inference call. Photographs, videos, and documents are captured and organized locally. Automated interpretation of image content is a later adapter boundary; the current implementation does not claim that pixels have been interpreted.

## Guided observation

An inspection playbook contains:

- branch-changing fact prompts;
- safety blockers;
- evidence requests;
- the media kinds each request accepts;
- the uncertainty each request is intended to resolve;
- conditional requests that become live only when a decision branch is active;
- the safety class for each request.

WOLF presents one request at a time. Requests are ordered by consequence and information value rather than by a comprehensive checklist. A request may be completed with evidence or explicitly deferred with a reason. Deferred evidence remains distinguishable from observed evidence.

The target selection rule is conceptually:

```text
next observation =
  highest expected consequential uncertainty reduction
  divided by capture effort, interruption cost, and safety exposure
```

The current kernel implements deterministic priority and branch conditions. A later evidence interpreter may update facts and uncertainty estimates from locally or explicitly processed media, but it must preserve the original artifact and the source of every derived claim.

## Evidence provenance

Every evidence artifact records:

- stable artifact ID;
- inspection case ID;
- request ID;
- media kind;
- source class;
- filename and MIME type;
- byte size;
- capture timestamp;
- local Blob where present;
- optional notes.

Source classes distinguish operator observation, occupant report, contractor documentation, manufacturer documentation, official material, and system inference. A future claim layer must never collapse these classes into one undifferentiated assertion.

The local database stores operational cases and evidence in separate IndexedDB stores. Capturing evidence and advancing the inspection case occur in one transaction, so the artifact and state update cannot diverge silently.

## Decision ranges

WOLF Ops evaluates options across declared metrics with explicit directions and weights. It computes normalized evidence-adjusted scores for comparison, but the primary output is the Pareto frontier: the options that are not worse on every metric than another option.

An option with missing evidence cannot eliminate another option and cannot itself be eliminated on the basis of the missing comparison. This prevents absent data from being converted into false certainty.

Each option carries:

- benefits;
- burdens;
- assumptions;
- evidence confidence;
- metric values;
- reopening triggers.

The interface therefore presents a range of durable paths and the conditions that change their ranking. It does not manufacture one recommendation from illustrative priors.

## Durable closure

Operational work moves through this state machine:

```text
observed
  -> classified
  -> triaged
  -> assigned
  -> stabilized or verified
  -> closed
```

`stabilized` means that an immediate symptom has been controlled while a durable obligation remains open. It cannot transition directly to `closed`.

Verification requires both a named closure test and at least one evidence artifact. Closure then requires completed follow-up. A verified item may return to `assigned` when the verification fails or the problem recurs.

Recurrence matching links the same issue code on the same asset within a configurable time window. A repeat failure therefore retrieves the prior repair path instead of creating an isolated complaint with no memory.

## First configurations

### Recessed lighting

The first property configuration captures:

- whole-room fixture map;
- simultaneous or independent operating pattern;
- dimmer relationship;
- working and failing fixture comparison;
- wall-control family;
- existing invoices, boxes, and model evidence;
- qualified-trade label, connector, driver, and mounting evidence;
- replacement dimensions when that branch is live.

The initial option range includes:

- diagnose the shared control or circuit first;
- replace failed modules with documented compatible products;
- replace failures and retain verified spares;
- standardize one room or circuit;
- stage property-wide standardization.

The values bundled with the playbook are explicitly relative priors. Local quotations, service history, actual failure frequency, fixture evidence, and electrical diagnosis must replace them before a consequential decision is treated as settled.

### Customer-facing café display

The first café configuration captures:

- the customer view and operational role;
- startup and visible symptom;
- installation, mounting, cable, heat, steam, and glare context;
- rear ventilation, dust, and clearance after safe power-down;
- exact model and ratings label;
- purchase, warranty, and service history.

The initial option range includes:

- clean, service, and schedule the current display;
- repair the current display;
- replace it with a documented equivalent and maintenance SOP;
- standardize the display system;
- remove the operational dependency on the display.

This configuration preserves the existing customer experience unless evidence supports changing it. Visual staleness alone is not treated as proof that a redesign will improve retention or cash flow.

## Privacy and safety

Operational media may contain people, private documents, credentials, tenant belongings, or business-sensitive material. The capture interface instructs operators to avoid unrelated faces and possessions. Raw media remains local to the browser profile in this implementation and is removed by the existing wipe-all action.

Safety classes are part of the playbook. Ordinary capture stops when a declared hazard is present. Requests involving internal electrical labels, connectors, drivers, mounting, or cutout measurements are assigned to a qualified trade after safe isolation. WOLF organizes the evidence and decision space; it does not authorize unsafe inspection.

## Repository boundaries

```text
src/engine/   verbatim testimony, packs, revisions, search, export
src/ops/      operational cases, guided inspection, decisions, work orders
src/storage/  local persistence for both layers
src/app/      browser interface
```

`src/engine/` remains content-free and does not import WOLF Ops. WOLF Ops is a separate derived and operational layer, so its decisions cannot overwrite testimony.

## Validation

The initial test suite covers:

- conditional evidence requests;
- safety blocking;
- highest-priority next observation;
- explicit deferral reasons;
- ready-for-review gating;
- Pareto dominance;
- missing-evidence preservation;
- decision reweighting without mutation;
- stabilization-versus-closure separation;
- verification evidence requirements;
- recurrence linking;
- IndexedDB persistence and deletion;
- v1-to-v2 database upgrade;
- route and component behavior.
