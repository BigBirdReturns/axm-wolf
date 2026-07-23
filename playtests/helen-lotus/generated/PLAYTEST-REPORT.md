# Helen → Lotus WOLF playtest receipt

> Helen and Lotus responses in this run are synthetic UX fixtures, not statements made by either person.

This is a deterministic local simulation. It made **zero runtime model API calls**. The analysis stage represents a human manually uploading each frozen `.wolfhandoff.json` to a paid ChatGPT or Claude subscription, then downloading or copying the structured `.wolfreturn.json` back into WOLF for validation and review.

## Corrected value model

The survey is an ingestion surface. Each sourced response can yield smaller knowledge drops—symptoms, workarounds, constraints, decisions, failure modes, and unwritten rules. WOLF should cluster recurring drops, match them to versioned solution patterns, and qualify candidates against address, jurisdiction, current codes and rules, installed assets, availability, human preference, and maintenance burden. The result is a reviewed operating recipe, not a generic model summary. See `../KNOWN-SOLUTION-SPACE.md`.

## Loop log

| # | Recipient | Actor | Dashboard | Action | Observed consequence |
|---:|---|---|---|---|---|
| 1 | Helen | owner | invited | Create labeled private invitation | Assignment identity is durable and isolated from the other recipient. |
| 2 | Helen | helen | started | Open invitation and begin | The hosted start screen now explains that manual subscription analysis is optional, separately decided at submission, cited, and unable to change answers. |
| 3 | Helen | helen | started | Pause and resume a partial answer | Draft restored; dashboard remains started. |
| 4 | Helen | helen | started | Save answers to the record | Committed answers are stored by stable prompt ID; Helen’s edit preserves both revisions. |
| 5 | Helen | helen | submitted | Submit the finished response | Submission records an explicit analysis choice; declining still permits testimony submission and blocks model handoff creation. |
| 6 | Helen | owner | received | Receive response in dashboard | The assignment becomes received and retains its original recipient and campaign labels. |
| 7 | Helen | owner | analyzing | Export frozen analysis handoff | The hosted dashboard now exports a frozen, revision-cited handoff and validates the manual return before publishing it. |
| 8 | Helen | subscription-llm | analyzing | Return cited summaries, risks, and planning suggestions | The simulated return passes frozen-snapshot citation validation and does not mutate the record. |
| 9 | Helen | owner-reviewer | completed | Review claims and close the loop | Two claims accepted; one overreaching automation plan rejected. |
| 10 | Lotus | owner | invited | Create labeled private invitation | Assignment identity is durable and isolated from the other recipient. |
| 11 | Lotus | lotus | started | Open invitation and begin | The hosted start screen now explains that manual subscription analysis is optional, separately decided at submission, cited, and unable to change answers. |
| 12 | Lotus | lotus | started | Pause and resume a partial answer | Draft restored; dashboard remains started. |
| 13 | Lotus | lotus | started | Save answers to the record | Committed answers are stored by stable prompt ID and remain isolated from Helen’s record. |
| 14 | Lotus | lotus | submitted | Submit the finished response | Submission records an explicit analysis choice; declining still permits testimony submission and blocks model handoff creation. |
| 15 | Lotus | owner | received | Receive response in dashboard | The assignment becomes received and retains its original recipient and campaign labels. |
| 16 | Lotus | owner | analyzing | Export frozen analysis handoff | The hosted dashboard now exports a frozen, revision-cited handoff and validates the manual return before publishing it. |
| 17 | Lotus | subscription-llm | analyzing | Return cited summaries, risks, and planning suggestions | The simulated return passes frozen-snapshot citation validation and does not mutate the record. |
| 18 | Lotus | owner-reviewer | completed | Review claims and close the loop | All three claims accepted as a proposed, reversible planning checkpoint. |

## Final owner dashboard

| Recipient | State | Answers | Accepted | Rejected | Next action |
|---|---|---:|---:|---:|---|
| Lotus | completed | 3 | 3 | 0 | Test the site-versus-dashboard discrepancy checkpoint with Lotus on the next walkthrough. |
| Helen | completed | 3 | 2 | 1 | Show Helen the two cited findings and ask before changing her workflow. |

## Findings

- **PASS — Recipient and campaign identity stayed isolated across both loops.** Distinct assignment and record IDs survived invited through completed.
- **PASS — Draft, commit, and revision semantics behaved as designed.** Drafts restored without counting as testimony; Helen’s edited answer retained two revisions.
- **PASS — Manual LLM output can remain derivative and reviewable without API calls.** Every claim cited a frozen revision and the record digest remained unchanged.
- **PASS — The hosted survey dashboard now exposes the raw interview and the manual analysis exchange in one place.** Operators can review synchronized testimony, export a frozen cited handoff, validate a cited return, and see derived claims separately.
- **PASS — Hosted recipients get a separate, optional manual-analysis consent choice.** The start screen explains the boundary; submission records allow or decline; a declined or missing choice prevents handoff export and server publication.
- **RISK — A single status hides useful parallel truth.** Submitted, received, analysis pending, and review completeness would be clearer as separate fields rather than one mutable pipeline label.

## Manual subscription protocol

1. In WOLF, freeze the selected response revisions and export a `.wolfhandoff.json`.
2. In ChatGPT or Claude, start a dedicated project/chat under the owner's subscription and attach the handoff. Do not enable connectors or external actions.
3. Ask the model to follow the embedded instructions and return only the specified JSON.
4. Save the result as `.wolfreturn.json`; do not paste model prose into the testimony.
5. Import locally. Reject returns whose handoff ID, digest, revision citations, or exact quotes do not match.
6. Show every derived claim as pending. The owner accepts, rejects, or turns it into a follow-up question.
7. Only accepted claims may inform a proposed plan. The plan stays reversible and links back to the source revisions.

## UX consequence

The dashboard should not merely say “completed.” It should say what dropped, where else the pattern occurs, whether the problem belongs to a known solution space, what local facts remain unverified, and the smallest compatible durable move. Helen and Lotus should see what they said, what WOLF recognized, what was verified externally, what the owner accepted, and how it reduces future explanation—without making them juggle another tool.
