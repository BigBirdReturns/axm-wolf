# Portable Challenge Deck derivation contract

A challenge deck is **derived from** a completed or partially completed AXM Wolf record. It is not testimony and never replaces the record.

## Source law

Every challenge card must retain at least one source citation:

```text
recordId
promptId
revisionId
exactSourceSpan (when available)
```

The source text remains verbatim in the Wolf record. If the testimony changes through a later committed revision, the old challenge card remains attributable to the old revision until deliberately superseded.

Do not silently reconcile contradictions. If the subject gives two incompatible accounts, carry the contradiction forward or ask the subject to resolve it in a new revision.

Do not convert absence into certainty. An unanswered prompt, refusal to answer, or statement that the subject does not know is evidence about the boundary of the record, not permission to fill the gap.

## Card anatomy

A useful clinical-site challenge card separates:

- **claim under test** — what a product, process, or reviewer is asserting;
- **adversarial question** — the operator's portable question;
- **required evidence** — what must be shown, reconstructed, or exported;
- **seat** — whose information position or authority matters;
- **time basis** — which historical moment controls the answer;
- **negative control** — what to remove, stale, contradict, or mis-version;
- **must-refuse condition** — the conclusion a trustworthy system must decline;
- **provider-loss test** — what has to survive the current platform;
- **source citations** — exact Wolf testimony supporting the card.

## Derivation rule

The six prompts in `portable-challenge.*` are deliberately written so the subject can author the challenge directly.

A deterministic tool may wrap the current response text in a card and attach provenance. It must not paraphrase, strengthen, generalize, or split the testimony without an explicit human review step.

Other sections may support or qualify a card. When they do, add their citations rather than merging their wording into a synthetic quote.

## Status vocabulary

- `draft` — derived but not reviewed by the subject or a designated human editor;
- `source_bound` — wording and citations checked against the record;
- `superseded` — replaced by a later card while retained for history;
- `retired` — intentionally no longer used.

`source_bound` means traceable to testimony. It does not mean clinically validated, regulator-approved, or universally correct.
