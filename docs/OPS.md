# WOLF Ops: guided evidence and durable decision support

**Status:** first deterministic vertical slice.

WOLF Ops is a separate layer beside the testimony engine. The existing engine preserves what a person said, the exact prompt, the revision chain, and pack provenance. Ops operates on explicit evidence references and local operating state. It may produce capture requests, hypotheses, option ranges, procedures, and work orders, but those artifacts never overwrite testimony.

The first slice addresses two recurring operating failures:

1. a small property with mixed, aging, or discontinued equipment where each complaint otherwise starts a cold reconstruction; and
2. a small café where preventive procedures and customer-facing review cycles depend on an owner remembering them.

The implementation is intentionally local, deterministic, and free of runtime API calls. It does not claim to interpret photographs or video by itself. It defines the evidence contract and decision mechanics that a future local or explicitly authorized inference adapter can populate.

## Operating loop

```text
media or testimony
  -> source-separated evidence
  -> asset passport
  -> unresolved decision fields
  -> highest-value safe capture request
  -> hypotheses and non-dominated options
  -> owner decision
  -> assigned work
  -> temporary stabilization or durable verification
  -> closure
```

The subject is not asked to recreate a generic domain workflow. A domain template states what a competent planner normally needs to know. The local record supplies only the delta: actual assets, symptoms, people, history, preferences, constraints, costs, and evidence.

## Evidence bases

Every observation or artifact must state its basis:

- `direct_observation`
- `reported`
- `documented`
- `external_source`
- `inferred`
- `awaiting_confirmation`

This prevents a tenant report, an owner interpretation, a contractor diagnosis, and a model inference from collapsing into one asserted fact.

## Guided inspection

An inspection template declares the fields required for a durable decision and the safest way to obtain each field. A request carries:

- the exact photograph, video, document, measurement, or spoken answer required;
- why that evidence changes the decision;
- expected uncertainty reduction;
- consequence of remaining uncertain;
- capture effort;
- safety risk;
- the actor qualified to perform it; and
- the asset fields it can resolve.

`buildInspectionPlan` removes requests whose target fields are already known, scores the remainder, and presents the highest-value subject-safe request first. Once safe observations are exhausted, it returns the contractor or licensed-professional request rather than instructing the subject to perform unsafe disassembly or energized testing.

## Decision ranges

A decision case retains hypotheses, evidence, assumptions, reopening conditions, and a range of options. Options are evaluated across:

- initial and five-year cost ranges;
- owner attention;
- recurrence risk;
- disruption;
- compliance risk;
- reversibility; and
- evidence confidence.

`getParetoFrontier` keeps every non-dominated option. `evaluateDecisionCase` may rank those options under explicit owner preference weights, but ranking does not erase the frontier or pretend that one answer is universally correct.

## Durable work-order semantics

Work moves through this state machine:

```text
observed
  -> classified
  -> triaged
  -> assigned
  -> temporarily_stabilized | verified
  -> closed
```

Temporary stabilization must be labeled temporary and carry a durable follow-up date. A patch cannot be verified as a durable resolution. Verification requires evidence, and closure requires a previously verified durable resolution.

## Included pilots

### Mixed discontinued recessed lighting

`small-property.recessed-lighting.v1` directs the user to capture the symptom pattern, ceiling layout, control, and working/failing pair before asking a licensed professional for fixture labels, connectors, cutout dimensions, housing type, and shared-cause testing.

Its decision case retains five paths:

1. diagnose the shared control or circuit first;
2. replace only failed modules;
3. replace failures and hold verified spares;
4. standardize one room or circuit; and
5. stage property-wide standardization.

Availability and ranking change when compatibility is verified, a shared cause is ruled out, failures correlate with the dimmer, recurrence rises, or contractor mobilization dominates material cost.

### Café display preventive care

`small-cafe.display-screen.v1` requests installation context, external ventilation condition, model identity, and normal operating environment. It can create an external-ventilation procedure with a defined interval, safety boundary, assignment, and closure evidence. The procedure remains provisional until model identity is known and manufacturer guidance can be confirmed.

## Boundary and next implementation seam

This slice adds no AI SDK, backend, analytics, remote media processing, or automatic publication. A future inference adapter may propose observations from local media or an explicitly authorized service, but it must write candidate observations with evidence references and confidence. The deterministic Ops layer remains responsible for deciding what evidence is missing, maintaining the option range, and enforcing durable closure.

The control question is: **what is the next safe observation that most reduces consequential uncertainty, and which non-dominated choices remain after that observation is incorporated?**
