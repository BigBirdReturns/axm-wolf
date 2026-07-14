# Helen → Lotus manual-LLM playtest

This playtest exercises WOLF as a legibility system rather than a generic survey form.

It simulates two independent recipients—Helen first, Lotus second—while the owner watches invitation, capture, receipt, analysis, review, and planning state change on a dashboard. All response text is synthetic fixture data.

Run:

```sh
npm run playtest:helen-lotus
```

The command compiles the real WOLF engine/storage code, executes the scenario against an isolated IndexedDB implementation, and writes a human-readable receipt plus machine-readable handoff/return artifacts under `generated/`.

The LLM step is deliberately manual. WOLF exports a frozen, cited handoff; a human uses an existing ChatGPT or Claude subscription; WOLF validates the structured return; and the owner reviews each derived claim. No runtime model API or token billing is required.

The modeled survey-analysis exchange is a playtest contract, not a claim that the current dashboard already implements the UI. WOLF Ops has the closest production precedent: frozen handoffs, structured returns, pending derived claims, and explicit accept/reject review.

The corrected product/value model is specified in [`KNOWN-SOLUTION-SPACE.md`](./KNOWN-SOLUTION-SPACE.md). It treats survey answers as sourced knowledge drops that can match recurring operational patterns, then qualify candidate solutions against address, jurisdiction, codes, asset compatibility, availability, and human constraints.

The broader research lineage, failure analysis, field-memory interaction grammar, evidence model, continuity test, and staged implementation plan are in [`WOLF-FIELD-MEMORY-COMPILER.md`](./WOLF-FIELD-MEMORY-COMPILER.md).

The consolidated security, provenance, matching, UX, schema, test, and release-gate audit for the next implementation slice is in [`SLICE-2-READINESS.md`](./SLICE-2-READINESS.md).
