# The Clinical Site Operator's Deposition

**Frame:** cross-seat clinical trial operations as primary-source testimony  
**Pack:** `clinical-site-operators-deposition@1.0.0`  
**Shape:** 10 sections · 60 long-form prompts · answer in any order

## What this pack is for

Clinical trial software usually begins with the record that already exists: the EHR event, EDC row, CTMS milestone, monitoring finding, sponsor dashboard, or regulatory submission.

This pack begins earlier.

It asks the experienced operator to reconstruct the work that made those records possible: the first site-created fact, the protocol version that governed it, who actually held authority at that moment, the physical trial around the electronic record, the clocks that started before a form existed, the conflicts created by several protocols sharing one site, and the differences between what the coordinator, monitor, investigator, quality reviewer, ethics or regulatory reviewer, and executive seat can know.

The purpose is not to produce a polished career narrative. It is to preserve the operational residue that disappears when site reality is compressed into downstream systems.

## Why the cross-seat section matters

The distinctive section is **The Same Event, Different Seats**.

A protocol deviation, amendment, safety event, or apparently clean record is replayed through multiple information positions. The question is not which role is "right." The question is what each role could know, what each role was authorized to decide, what each could easily misunderstand about the others, and which facts disappear if the site sequence is not preserved.

That makes the record useful after the original operator is gone and independent of any particular EDC, CTMS, EHR, CRO, sponsor, or platform.

## The portable challenge

The final section, **The Portable Challenge**, turns experience into questions another operator can carry into a vendor demo, audit, architecture review, or replacement decision.

It asks the subject to write, in their own words:

1. the first questions they would ask a vendor claiming to understand site operations;
2. the evidence a system must show rather than merely claim;
3. a negative control that should force a trustworthy system to refuse a convenient conclusion;
4. the objects and reconstruction rules the institution must own to survive provider loss;
5. a machine-refusal rule when source, authority, evidence, or time is ambiguous;
6. the final question every future clinical-site system should have to survive.

Wolf itself does not infer those answers. The subject authors them. The record preserves them verbatim with revisions and provenance.

A later **challenge deck** is a derived artifact. Every card must cite the originating Wolf `recordId`, `promptId`, `revisionId`, and exact source span when available. It may organize testimony; it may not rewrite it into something the subject did not say.

## Privacy and IP firewall

Use de-identified examples only.

Do not enter:

- protected health information or participant identifiers;
- confidential sponsor or protocol identifiers;
- unpublished trial results;
- proprietary SOP text or source documents;
- identifiable coworker information that is not necessary to the operational point;
- credentials, secrets, or source-system access details.

The high-value payload is the operator's model of the work: sequence, authority, evidence, failure modes, contradictions, timing, and refusal conditions. The pack does not need confidential corporate material to capture those.

## Suggested use

There is no required order. The authored sequence intentionally moves from concrete site episodes toward abstraction.

For immediate leverage, an experienced operator may start with **The Portable Challenge** and answer those six prompts first. The earlier sections can then be used to supply the episodes, evidence boundaries, and cross-seat reasoning behind those challenges.

## Boundary

This pack captures testimony about clinical operations. It does not provide medical advice, create clinical authority, validate a GxP system, certify regulatory compliance, or make patient-level decisions.
