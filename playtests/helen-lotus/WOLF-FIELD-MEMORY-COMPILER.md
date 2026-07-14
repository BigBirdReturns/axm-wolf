# WOLF field-memory compiler

## Research synthesis and implementation blueprint

**Status:** design authority candidate, not yet implemented in the survey dashboard  
**Research date:** 2026-07-13  
**Scope:** Helen and Lotus playtest, WOLF testimony, WOLF Ops, hosted D1 workflow, manual subscription analysis

## 1. The product in one sentence

> WOLF observes real cases, preserves lived evidence, detects recurrence, resolves local constraints, proposes the smallest proven solution, and compiles accepted knowledge into work that survives the person who invented it.

The survey is only one ingestion surface. The durable product is the loop from lived event to reusable, locally qualified operating recipe.

```text
ordinary work or exception
  → source-preserved drop
  → context binding
  → recurrence recognition
  → known-solution candidates
  → local verification
  → reversible trial
  → outcome receipt
  → reviewed operating recipe
  → recheck, refinement, or retirement
```

Helen and Lotus should not maintain a second world describing their real world. They continue doing the work. WOLF asks only for observations or judgments that change an action path.

## 2. The historical dragons

This problem has been attacked for decades. Most lineages solved one layer and failed when they pretended it was the whole system.

| Lineage | What it solved | Why it failed or decayed | What WOLF should inherit |
|---|---|---|---|
| Expert systems | Encoded specialist rules into executable advice | Experts could not state a complete stable rule set; elicitation and maintenance became the bottleneck; rules became brittle outside anticipated cases | Acquire knowledge from real exceptions and corrections, not an up-front brain dump. Ripple-Down Rules made correction of a live misclassification the ordinary maintenance act. [Compton et al.](https://www.sciencedirect.com/science/article/pii/093336579290013F) |
| Xerox Eureka | Shared technician-authored repairs omitted from official manuals | Redundancy, missing context, governance, and corporate resistance still required active management | Preserve problem–cause–solution tips with author attribution, peer validation, product/context binding, and retrieval inside the service workflow. Eureka’s field trial reduced time and parts cost, and the deployed system endured because it solved technicians’ actual cases. [Bobrow and Whalen](https://www.sri.com/publication/fcd-publications/communal-knowledge-sharing-the-eureka-story/) |
| Lessons-learned repositories | Captured reports and project lessons | Contribution was separate, low-priority work; search and applicability were weak; stored lessons did not necessarily alter practice | A lesson is incomplete until it changes a checklist, process, work order, training item, decision surface, or policy. NASA’s mature lifecycle is collect, record, disseminate, **apply**. [NASA](https://www.nasa.gov/learning-resources/for-professionals/appel-lessons-learned/) |
| Communities of practice | Preserved peer exchange and social validation | Management-created forums became empty when purpose, time, trust, facilitation, and recognition were absent | Let the community emerge through cases. Contributing a drop is a side effect of solving work, not a demand to “participate in knowledge management.” |
| After-action reviews and postmortems | Reconstructed expectation, event, cause, and corrective action | They became blame rituals, compliance documents, or archives without action ownership | Make review immediate, blameless, source-based, assigned, and closed with proof. Google notes that unreviewed or actionless postmortems provide little operational value. [Google SRE](https://sre.google/workbook/postmortem-culture/) |
| Checklists and runbooks | Externalized memory at the moment of action | Static lists decayed, encouraged rote completion, and failed under interruption | Treat recipes as cognitive equipment: trigger, current position, hold/resume state, stop conditions, completion evidence, and escalation. WHO stresses local adaptation, leadership, coaching, and feedback. [WHO](https://www.who.int/publications/i/item/9789241598590) |
| CMMS/EAM | Linked assets, work orders, schedules, parts, and maintenance history | Bad identities, manager-oriented forms, double entry, and incomplete work orders produced expensive garbage | WOLF should compile residue into an existing work system or a minimal local work order, not demand replacement of every operational tool. DOE describes CMMS as decision support, not the decision-maker. [DOE O&M Guide](https://www.energy.gov/sites/default/files/2020/04/f74/omguide_complete_w-eo-disclaimer.pdf) |
| Knowledge graphs | Connected heterogeneous facts and supported cross-case queries | Ontology-first programs drowned in modeling, duplicated entities, stale assertions, and lost provenance | Use a small provenance graph behind the UI. Keep testimony, external fact, hypothesis, validated pattern, recipe, and outcome as different types. [W3C PROV-O](https://www.w3.org/TR/prov-o/) |
| Digital twins | Represented asset/system state for simulation and decisions | Static models became expensive theater when synchronization, validation, and lifecycle upkeep were absent | Build a fit-for-purpose **operational context twin**, not a maximal replica. NIST emphasizes decision purpose, validation, maintenance, and actionable recommendations. [NIST](https://www.nist.gov/digital-twins/essential-elements) |
| Generative AI copilots | Lowered extraction, clustering, drafting, and retrieval costs | Plausible prose launders stale sources, collapses uncertainty, and tempts premature automation | Keep models backstage. They propose typed candidates with citations; deterministic validation, authoritative sources, and people promote them. [NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/) |

### The most important cautionary result

NASA already built a sophisticated lessons system and still found the human workflow gap. A 2012 Inspector General audit reported that 57% of surveyed project managers had used the lessons system and 43% had contributed; managers described contribution as time-consuming, low-priority, hard to search, outdated, or disconnected from engineering standards. [NASA OIG IG-12-012](https://oig.nasa.gov/docs/IG-12-012.pdf)

WOLF’s central anti-requirement follows:

> Never ask a busy expert to maintain a second abstract system as the price of preserving the first system.

## 3. The durable knowledge atom

The atom is not a quote, summary, “best practice,” graph triple, or model answer. It is a **conditioned operational claim** tied to a case.

```text
When [trigger and context],
we observed [source-linked event].
The practitioner did [action or workaround]
because [rationale].
It produced [outcome].
This may relate to [known pattern].
It appears eligible when [conditions].
It does not apply when [exclusions].
External constraints were checked against [authority, edition, date].
Evidence strength is [source, recurrence, and outcome dimensions].
The next safe move is [reversible action].
Recheck by [date or event].
```

This shape combines the best of Eureka’s field tip, Ripple-Down Rules’ cornerstone case, an AAR’s causal gap, a runbook’s executable move, and a provenance graph’s traceability.

### Do not collapse these truth classes

1. **Source testimony:** what Helen or Lotus said, typed, photographed, or corrected.
2. **Direct operational evidence:** observed measurement, asset label, file, image, or completed check.
3. **Case context:** time, site, role, profession, asset, workflow stage, constraints, and preferences.
4. **External fact:** official rule, adopted code, manufacturer instruction, certification, availability, quote, or permit record.
5. **Derived hypothesis:** matcher or LLM proposal about recurrence, cause, classification, or solution.
6. **Validated pattern:** a human-reviewed statement about where a solution tends to apply.
7. **Operating recipe:** approved action with prerequisites, owner, stop conditions, fallback, proof, and maintenance.
8. **Outcome:** what happened after use, including failure, cost, delay, recurrence, or supersession.

Contradictions are evidence. “Worked at Site A” and “failed at Site B” should coexist until WOLF identifies the discriminating conditions.

## 4. The interaction grammar

Use one loop everywhere:

**Drop → Bind → Recognize → Verify → Propose → Trial → Receipt → Recipe → Recheck**

### Drop

Preserve the raw event close to the work. A drop may originate from:

- a survey answer;
- a three-minute hot debrief;
- a spoken correction;
- a work-order closeout;
- a photo or measurement;
- a failed attempt;
- a successful exception;
- a recurring complaint;
- a discrepancy between the dashboard and physical site.

WOLF may ask one tiny confirmation:

> “That sounded like a workaround you rely on. Keep it as a reusable drop?”

It should not open another form.

### Bind

Attach only context that may change reuse:

- person and role;
- profession and license boundary;
- site/address and work area;
- asset identity and configuration;
- workflow stage;
- trigger and symptom;
- environmental conditions;
- constraints and preferences;
- source visibility and consent.

### Recognize

Search prior cases and a versioned pattern library. Show why a match exists and which facts could disqualify it.

### Verify

Resolve volatile external claims from authoritative sources. Do not ask an LLM to remember current law, stock, licensing, or inspector practice.

### Propose

Show one smallest viable move. Alternatives remain available through progressive disclosure. A proposal includes consequence, burden, confidence dimensions, missing verification, reversibility, and why it helps.

### Trial

Name an owner, expected result, time box, stop conditions, rollback, and required evidence.

### Receipt

Record what actually happened. A checked box without completion evidence is not a receipt.

### Recipe

Promote only after review and sufficient outcome evidence. Record eligibility, exclusions, responsible role, last-tested date, fallback, and dependencies.

### Recheck

Expire or warn on claims that drift: codes, amendments, availability, prices, service providers, permits, licenses, asset state, and responsible people.

## 5. Address-specific intelligence is an evidence graph

“Rules for this ZIP code” is a dragon. Postal identity, physical location, parcel, legal government, authority having jurisdiction, adopted law, project scope, permit date, licensed role, product compliance, and present availability are different questions.

```text
reported address
  → postal identity
  → physical point and parcel
  → legal governments
  → discipline-specific AHJs
  → adopted code stack and amendments
  → project/date/occupancy applicability
  → licensed roles
  → certified compatible products
  → current local availability
  → verified action and outcome
```

Every edge needs provenance and a resolution state.

### Source stack

- **Postal form:** USPS Addresses API and Publication 28. Postal city is not legal jurisdiction. [USPS API](https://devs.usps.com/addressesv3), [Publication 28](https://pe.usps.com/text/pub28/welcome.htm)
- **Candidate geocode:** Census Geocoder. Census warns that results can be interpolated along address ranges; a result is not proof that a structure exists. [Census](https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html)
- **Legal-boundary discovery:** Census Boundary and Annexation Survey, then official local GIS/parcel confirmation for recent annexations or enforcement boundaries. [BAS](https://www.census.gov/programs-surveys/bas.html)
- **Code-adoption discovery:** FEMA tracking can propose an adoption stack, but the controlling result comes from state/local enactments, amendments, department bulletins, permits, and approved plans. [FEMA playbook](https://www.fema.gov/sites/default/files/documents/fema_building-codes-adoption-playbook-for-authorities-having-jurisdiction.pdf)
- **Model-code context:** ICC model codes become law only through governmental adoption and may be amended. [ICC IBC](https://www.iccsafe.org/products-and-services/i-codes/ibc/)
- **Primary law:** official state commission and municipal sources. California demonstrates the layering with current Title 24, jurisdiction-indexed local amendments, and permit-date applicability. [California BSC](https://www.dgs.ca.gov/en/BSC), [local amendments](https://www.dgs.ca.gov/bsc/codes/local-amendments-to-building-standards---ordinances)
- **Federal material:** GovInfo APIs and bulk data, preserving edition and effective date. [GovInfo](https://www.govinfo.gov/developers)
- **Regulatory overlays:** official effective, preliminary, pending, and historic layers must remain distinct. FEMA’s Map Service Center/NFHL is the official NFIP flood-hazard source. [FEMA](https://www.fema.gov/flood-maps/products-tools)
- **License discovery and verification:** use national discovery only to locate the issuing board; verify classification, scope, expiration, bond, and discipline at the board. [CareerOneStop](https://cloudfront.careeronestop.org/toolkit/Training/find-licenses-help.aspx)
- **Product compliance:** exact model records from NRTL, DOE, state appliance databases, ENERGY STAR data, recall sources, and manufacturer documentation. [OSHA NRTL](https://www.osha.gov/nationally-recognized-testing-laboratory-program/frequently-asked-questions), [DOE CCMS](https://www.energy.gov/cmei/buildings/implementation-certification-and-enforcement), [CPSC recalls](https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information)
- **Availability:** dated supplier observation, exact model/part, location, price, lead time, quote/reservation expiry, and verification method. “In stock” is not “available for this job” until confirmed or reserved.

### AHJ is scoped, not singular

One site can have different authorities for building, zoning, fire, electrical, plumbing, water/sewer, environmental health, floodplain, historic preservation, accessibility, and professional operating licenses.

```text
authority_assignment
  site_id
  authority_id
  discipline
  work_scope
  occupancy_scope
  geographic_scope
  valid_from / valid_to
  source_claim_id
  resolution_state
```

Resolution states:

```text
unknown → discovered → corroborated → officially_verified
                         ↘ disputed
                         ↘ superseded
```

### Automation boundary

WOLF can automate deterministic parsing, candidate geocoding, boundary discovery, source retrieval, hashing, snapshots, amendment diffs, expiration monitoring, product/recall checks, candidate compatibility, recurrence matching, and research-packet assembly.

WOLF must require authoritative human verification for disputed AHJs, permit and license interpretations, alternate means and methods, hidden site conditions, safety decisions, exact product fitness, inspector acceptance, stock before reservation, and incentive eligibility.

An LLM may extract and organize evidence. It cannot silently mark a legal, safety, product, availability, or jurisdiction claim verified.

## 6. Evidence model

Every consequential atomic claim needs:

```text
subject / predicate / object
source and exact locator
source authority class
published_at / retrieved_at / observed_at
valid_from / valid_to
jurisdiction / discipline / work scope
source revision and content hash
extraction method
verification state and verifier
recheck_at
supersedes
contradiction group
high_stakes flag
```

Use bitemporal history:

- **Valid time:** when the rule, condition, quote, price, or availability legally or physically applied.
- **System time:** when WOLF learned, corrected, or superseded it.

Do not compress uncertainty into one confidence number. Show independent dimensions:

- source authority;
- source fidelity;
- recurrence strength;
- outcome evidence;
- context completeness;
- scope fit;
- freshness;
- corroboration;
- human verification.

## 7. Product surfaces

One evidence model should produce four radically different surfaces.

### Helen/Lotus: the field surface

Purpose: do the current job and capture residue without research administration.

Default card:

1. What is happening now?
2. What one observation or judgment changes the path?
3. What will WOLF do with it?
4. Who can see it?
5. What is the immediate receipt?

No taxonomy editor, graph, confidence slider, source manager, model prompt, subscription, or general-purpose dashboard.

### Steward: the refinery surface

Purpose: resolve ambiguous drops, privacy, duplication, pattern matches, external sources, and review exceptions.

Batch routine work. Interrupt only for imminent harm, blocked action, expiring dependency, or a decision that cannot safely be automated.

### Owner: the decision surface

It answers:

1. **What dropped?** New observations, exceptions, constraints, decisions, and workarounds.
2. **Where else does this occur?** Recurrence across people, sites, assets, and time.
3. **Is this a known solution space?** Candidate patterns and discriminating conditions.
4. **What fits here now?** Jurisdiction, code, asset, availability, burden, preference, and verification freshness.
5. **What is the smallest durable move?** One proposed recipe, owner, expected result, rollback, evidence, and review date.

### Successor: continuity mode

Purpose: run the system without the incumbent.

- what matters today;
- what is normal;
- what exceptions are dangerous;
- if this happens, do this;
- why the rule exists;
- who or what must be contacted;
- current credentials/dependencies without exposing secrets in general exports;
- last proof that the recipe still works;
- escalation and fallback.

## 8. The game/UI grammar

WOLF can borrow legibility from games without gamifying labor.

| Game grammar | WOLF meaning |
|---|---|
| World state | Current site, asset, people, rules, dependencies, and open work |
| Fog of war | Unknown or stale facts that could change the path |
| Quest | One owned, bounded operational outcome |
| Objective | The next action with expected consequence |
| Inventory | Assets, parts, evidence, permissions, and available capabilities |
| Map | Address, jurisdiction, AHJs, service territory, and regulatory overlays |
| Codex | Known solution patterns and conditioned claims |
| Bestiary | Recurring failure modes, triggers, disqualifiers, and successful counters |
| Save log | Append-only testimony, decisions, revisions, and outcomes |
| Unlock | A solution becomes eligible only when prerequisite facts are verified |
| Boss gate | Safety, license, permit, or irreversible-decision boundary |
| Debrief/score screen | Outcome receipt and what changed in the local recipe |

The dominant screen should always expose one authoritative actor, one dominant verb, the consequence of that action, and the durable receipt it will produce.

## 9. Manual subscription models

Models remain batch-oriented and backstage.

They may:

- split narratives into candidate drops;
- propose classifications;
- cluster recurrence;
- identify missing applicability fields;
- generate official-source research queues;
- compare candidate solutions;
- draft recipes;
- detect contradictions;
- suggest discriminating evidence.

They may not:

- alter testimony;
- infer consent;
- declare a code, AHJ, license, legal requirement, or availability current;
- promote a candidate into an approved recipe;
- silently resolve conflicting evidence;
- claim outcome success.

Protocol:

1. WOLF accumulates unresolved drops locally or in D1.
2. The owner exports a redacted frozen batch with stable source IDs and exact revisions.
3. The owner uploads it to an existing ChatGPT or Claude subscription.
4. The model returns typed JSON candidates with source references and uncertainty.
5. WOLF validates IDs, quotes, digests, and allowed evidence.
6. Deterministic and authoritative lookups verify external claims.
7. A person reviews only consequential or disputed material.
8. Accepted results remain derived; raw testimony remains unchanged.

Helen and Lotus never need an AI account, prompt library, integration key, project, or subscription.

## 10. Hosted architecture without service sprawl

Core:

- **IndexedDB:** working local copy, offline capture, local search, drafts, and portable exports.
- **Cloudflare D1:** workspace membership, append-only domain events, current projections, verification queues, and shared structured state.
- **Cloudflare R2 or file custody package:** immutable source snapshots, manuals, PDFs, images, and media when hosted attachments are authorized.
- **Pages/Worker:** same-origin application, access control, capability links, deterministic validation, refresh jobs, and export assembly.
- **Portable files:** `.wolfrecord.json`, `.wolfops.json`, `.wolfhandoff.json`, `.wolfreturn.json`, plus a future `.wolfcontinuity.zip` that can be restored without Cloudflare or a model.

Cloudflare is synchronization and sharing, not the only place the organizational memory exists. Local-first software’s durability goal is continued ownership and access even when a vendor disappears. [Ink & Switch](https://www.inkandswitch.com/essay/local-first/)

Suggested hosted entities:

```text
site
site_address
site_location_assertion
parcel
jurisdiction
jurisdiction_boundary_assertion
authority
authority_assignment
work_scope
regulatory_instrument
regulatory_provision
adoption_or_amendment
applicability_claim
permit_record
license_record
product
product_certification
product_compatibility_claim
recall
supplier
availability_observation
source
source_snapshot
knowledge_drop
solution_pattern
pattern_match
verification_task
decision
trial
operating_recipe
outcome
continuity_rehearsal
```

Use append-only domain events for testimony, classification review, external verification, decisions, trials, and outcomes. Use ordinary materialized tables for fast dashboards. Maximalist event sourcing is unnecessary.

## 11. Promotion rules

A model suggestion never becomes a recipe directly.

```text
source event
  → candidate drop
  → reviewed drop
  → candidate recurrence
  → context-qualified match
  → externally verified constraints
  → reversible proposed trial
  → owner approval
  → performed trial
  → outcome evidence
  → local recipe
  → repeated outcomes / peer review
  → broader pattern, narrower exception, supersession, or retirement
```

Rules:

- preserve the originating case before abstraction;
- require exact source revision links;
- store match reasons and disqualifiers;
- require higher verification for higher consequence;
- allow conflicting cases;
- never generalize farther than observed eligibility permits;
- surface a pattern at the next matching decision, not only in a library;
- decay or flag untested and stale recipes;
- record rejection reasons because they teach applicability;
- promote into work, not merely search results.

## 12. “Turn-key” burden score

Every proposed solution should include operational burden, not only purchase price or technical fit.

Score or display:

- new subscriptions;
- new logins;
- new applications;
- human handoffs;
- vendors and external dependencies;
- credentials and renewal dates;
- steps per occurrence;
- training burden;
- manual repetition rate;
- failure visibility;
- reversibility;
- offline survivability;
- exportability;
- replacement/repair availability;
- named primary and alternate owner;
- verification effort;
- maintenance cadence;
- blast radius if abandoned.

Prefer a slightly less elegant solution that can be understood, exported, repaired, and run by a successor over a clever solution whose invisible dependencies die with its champion.

## 13. The dragon catalog

- **Brain-dump fantasy:** assuming one interview can externalize expertise.
- **Ontology-first capture:** asking practitioners to classify before they can report.
- **Repository burial:** stored insight never reappears when relevant.
- **Best-practice cargo cult:** transferring a solution without its eligibility conditions.
- **Success blindness:** capturing failures but not adaptations that prevented failure.
- **Closeout-only capture:** waiting until the work or career ends.
- **Surveillance capture:** destroying honesty by hiding visibility and downstream use.
- **Checklist theater:** completion marks without observed completion.
- **Graph theater:** modeling the enterprise instead of a decision.
- **Digital-twin theater:** static asset data without synchronization or use.
- **ZIP-as-jurisdiction:** postal geography masquerading as law.
- **Model-code-as-law:** treating an ICC edition as adopted unamended law.
- **Latest-edition error:** ignoring permit date and valid time.
- **One-AHJ fiction:** collapsing discipline-specific authorities.
- **Map-intersection certainty:** treating a candidate overlay as legal interpretation.
- **Certification-as-fit:** confusing listing/certification with compatibility and acceptance.
- **Product-family matching:** recommending a family rather than an exact model/configuration.
- **License-exists error:** ignoring classification, scope, expiration, bond, or discipline.
- **In-stock fiction:** confusing a web page with reserved job availability.
- **Single confidence:** hiding authority, freshness, scope, recurrence, and outcome behind one score.
- **Premature automation:** one workaround silently becomes a rule.
- **LLM laundering:** inference appears as testimony or current external fact.
- **Notification confetti:** weak matches become interruptions.
- **Subscription hydra:** solving work creates more tools, accounts, and renewals.
- **Successor encyclopedia:** documentation exists, but nobody has rehearsed the work.

## 14. Metrics that cannot be gamed by document production

Do not optimize for lessons, documents, drops, model calls, searches, or dashboard time.

Measure:

- practitioner time added per real event;
- percentage of drops bound to concrete context;
- recurrence surfaced at the moment of need;
- time from drop to tested action;
- match acceptance/rejection and rejection reasons;
- recipes with observed outcomes;
- first-time safe resolution;
- repeat investigations avoided;
- stale facts caught before action;
- recurrence after a claimed fix;
- subscription, login, and app-switch count added or retired;
- percentage of interrupts that caused an immediate useful action;
- successor completion without incumbent intervention;
- restore-test success without Cloudflare or a model;
- percentage of active recipes with alternate owners, fallbacks, and recent proof.

## 15. Continuity acceptance test

WOLF passes the “I die and shit still runs” test when a successor can determine:

- what exists at this address;
- what is normal today;
- who said or observed each consequential fact;
- which rules and sources were current when decisions were made;
- what remains uncertain or stale;
- which recurring pattern this resembles;
- which solutions were considered and why some did not fit;
- what was actually done;
- how success was verified;
- what maintenance or renewal is due;
- who owns and backs up each critical role;
- how to export and restore the custody package;
- how to execute accepted recipes without any proprietary model.

Continuity must be rehearsed. A periodic successor drill should assign a representative task to someone who did not author the recipe, then capture where the handoff fails.

## 16. Revised Helen and Lotus playtest

### Helen

Synthetic drop: the shared calendar loses reliability when ownership is implicit and priorities diverge.

Expected compilation:

1. preserve Helen’s exact response and revision;
2. extract candidate drops for ownership ambiguity and coordination drift;
3. search prior local cases for the same discriminating conditions;
4. match single-state ownership, change receipt, and discrepancy-review patterns;
5. qualify against tools already used;
6. reject automatic workflow restructuring because legitimate ownership is unresolved;
7. ask one branch-changing question: “Who can legitimately own this state?”;
8. propose a no-new-subscription trial inside the existing calendar/dashboard;
9. record whether divergence decreases;
10. promote, narrow, or reject the recipe from outcome evidence.

### Lotus

Synthetic drops: physical site state can contradict the dashboard; useful exceptions live in an unowned Airtable view.

Expected compilation:

1. preserve exact response revisions;
2. bind site, workflow stage, and existing tool;
3. match reconciliation and exception-register patterns;
4. resolve address context only where rules, services, or solution compatibility change;
5. propose a no-new-subscription checkpoint using the existing site walk and tool;
6. make disagreement a first-class exception with an owner and checked-at receipt;
7. run it on the next walkthrough;
8. record whether it exposed an issue earlier and whether the issue closed;
9. promote only after observed success.

### What both people see

- **What you said** — exact, editable only through revision.
- **What WOLF recognized** — derived and correctable.
- **Where else it appeared** — cases, not vague similarity.
- **What is externally verified** — authority, scope, date, and freshness.
- **What is proposed** — smallest move and consequence.
- **What was accepted or rejected** — with reasons.
- **How this helps** — what explanation, repeat investigation, or failure is removed next time.

## 17. Build order

### Slice 1: drop refinery, local only

- source-span knowledge drops;
- review/correct/reject;
- visibility and consent;
- recurrence across local records;
- no LLM requirement;
- Helen/Lotus field receipt and owner review queue.

**Gate:** one answer emits multiple drops without changing testimony, and a user can correct the classification in one action.

### Slice 2: pattern library and cornerstone cases

- versioned pattern;
- triggers, eligibility, exclusions, discriminating fields;
- cornerstone case and counterexample;
- rejection reasons;
- context-qualified match explanation.

**Gate:** a new case can narrow or branch an existing pattern without rewriting prior cases.

### Slice 3: Site Passport and verification graph

- normalized address candidates;
- jurisdiction/AHJ tasks by discipline;
- source snapshots and hashes;
- valid/system time;
- freshness and contradiction states;
- explicit human verification boundary.

**Gate:** WOLF refuses to present a discovered model code or postal city as verified local applicability.

### Slice 4: solution card and reversible trial

- one smallest move;
- alternatives on demand;
- burden score;
- owner, stop, rollback, evidence;
- outcome capture.

**Gate:** no recipe can be promoted without a reviewed source chain and outcome receipt.

### Slice 5: hosted synchronization and research maintenance

- D1 event/projection schema;
- R2 source custody if authorized;
- scheduled source freshness tasks;
- capability/workspace security;
- manual `.wolfhandoff` and `.wolfreturn` batches;
- offline/portable round trip.

**Gate:** the entire workspace can be exported, restored, and read without a model or Cloudflare.

### Slice 6: successor mode and continuity drills

- daily state;
- exception playbooks;
- alternate owners;
- dependency/renewal map;
- rehearsal task and receipt;
- gap becomes a new drop.

**Gate:** a non-author completes a representative operation without incumbent intervention.

## 18. Decision

The durable synthesis is not “a better survey,” “a knowledge graph,” “an expert system,” “a digital twin,” “a CMMS,” or “an AI copilot.” Each is a partial ancestor.

WOLF is the connective loop they lacked:

> **field evidence → conditioned knowledge → local verification → executable work → observed outcome → continuity**

The most important product question is not whether WOLF can answer an operator. It is whether Helen can keep doing her work, Lotus can inherit the benefit, the next exception teaches the system, and the operation remains legible when every vendor and original expert disappears.
