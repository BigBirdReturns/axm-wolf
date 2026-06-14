# AXM Wolf — Capture Methodology

**Status**: First draft.
**Audience**: Pack authors. Subjects considering a self-directed Wolf record. People comparing Wolf to questionnaire products and trying to figure out why it works.

This document explains why a Wolf pack is shaped the way it is, why the question order matters, and what the five lenses in The Wolf's Deposition are actually doing under the hood. It exists because the question library is the intellectual property — the engine, the storage, and the UI are replaceable; the prompts are not — and pack authors deserve a real account of the craft, not a tone deck.

---

## 1. The problem a Wolf pack is solving

Tacit institutional knowledge is hard to retrieve for two reasons that have nothing to do with memory loss:

1. **The subject doesn't know which details will later matter.** A retiring engineer who lived through a decade of one company's software practices cannot, when asked "tell me everything important," produce the specific moments that a historian or a successor will want. Specificity is recovered by being *prompted* into a specific frame, not by being asked to summarize.
2. **Open-ended interview formats privilege narrative over evidence.** Most oral-history conversations drift toward the story the subject has told before — the polished anecdote — and away from the unrehearsed detail that surrounds it. The polished anecdote is the part that survives in family lore anyway; the surrounding detail is what gets lost.

A Wolf pack is a structured retrieval instrument. It is *not* a survey, a memoir prompt, or a casual interview transcript. The closest peer in the research literature is the **Cognitive Interview** (Geiselman, Fisher and colleagues, 1984–present), originally developed for forensic witness interviewing and now standard in trained investigative practice in the US and UK. Wolf's five-lens system is, structurally, the cognitive interview adapted for self-directed asynchronous capture.

The methodology behind the cognitive interview is the most heavily studied retrieval-aid framework in cognitive psychology. Its main techniques — context reinstatement, recall from multiple perspectives, recall in reverse order, and focused concept-driven probes — are what Wolf's lenses encode. The empirical evidence is robust for accuracy and detail recall in cooperative subjects; it does not work on hostile subjects, and it is not lie-detection. Wolf is built for the cooperative case.

---

## 2. The five lenses, plainly

The Wolf's Deposition uses five lenses. The Wolf pack has them distributed roughly evenly across 58 prompts:

| Lens | Count in Wolf pack | Cognitive technique it implements |
| --- | --- | --- |
| The Room | 13 | **Context reinstatement** — describe the physical and social setting first, before recalling events that happened in it. |
| The Decision | 12 | **Concept-driven probe at a fork** — focus retrieval on a known choice point and the alternatives that were live at the time. |
| The Person | 9 | **Multiple perspectives** — view an episode through a specific other person's eyes; activates social-cognitive scaffolding. |
| The Moment | 10 | **Episodic specificity** — anchor recall on a single, dated, peak-emotion event rather than a period. |
| The Thing Nobody Said | 14 | **Tacit norms** — surface the unwritten rules that governed the room. The rule itself was never stated, so there is no rehearsed story to fall back on. |

### Why The Room comes first

Context reinstatement is the single best-supported technique in the cognitive-interview literature. Asking the subject to describe the *room* — the building, the desks, the people who were already there, the noises, what they were wearing — before asking about *what happened* reliably increases the amount of correct detail recalled about events that occurred in that setting. The mechanism is unsurprising: episodic memory is encoded with the surrounding context, and the surrounding context is the strongest retrieval cue available.

In a Wolf pack, prompts that lead with The Room create the conditions under which the other four lenses recover more. **A pack that has no Room prompts is almost certainly under-eliciting.**

### Why The Person works

Asking "what would your manager have said about that?" or "describe the most technically capable person you worked with there" is not idle gossip. The cognitive-interview literature calls this *changed perspectives*, and the effect is that recalling an episode through a specific other person's eyes recovers details that the subject's own first-person retelling habitually omits. The other person is doing scaffolding work for the subject's memory.

### Why The Decision works at the fork, not the outcome

The Decision lens does not ask "what did you decide?" It asks about the moment *before* the decision became obvious, when alternatives were still live. The forking point is rich in detail because both branches were imagined; the chosen branch was rehearsed many times after the fact and is now a narrative. The unchosen branch is preserved only at the fork. Pack authors who write Decision prompts about outcomes instead of fork-points get the rehearsed narrative and nothing new.

### Why The Moment uses single events

Periods average across detail. Single events preserve it. "Tell me about your time at HP" returns a summary. "What was the moment at ARCO when you understood that oil companies were going to be late to every major technology shift?" returns one room, one conversation, one realization, often dated. The Moment lens is doing the work of converting a decade into a small number of high-resolution snapshots that can be exported, cited, and remembered.

### Why The Thing Nobody Said is the largest category in the Wolf pack

This is the lens with the highest yield per prompt and the lowest competition from any other capture mechanism. Unwritten rules — the unofficial billing-cycle norm at the law firm, the unspoken hierarchy at the energy company, what the senior partner expected you not to discuss in front of clients — are by construction not in any document. They were never stated. The subject is one of the few people who knows them, and they are dying with the cohort.

A pack that under-uses this lens will produce a record indistinguishable from a polished LinkedIn summary. The Wolf pack's 14 prompts in this category are not an accident; they are the highest-value cells in the matrix.

---

## 3. The framing problem

The Wolf's Deposition is named, and presented in the UI, as a *deposition*. This is a deliberate psychological frame, lifted from Pulp Fiction's evidentiary register: a deposition is a formal, recorded, on-record account of what a witness saw. It is not a chat, not an interview, not a memoir. The frame tells the subject: *this matters, take it seriously, and what you say will be preserved as-is*.

The frame is part of the pack. Different subjects and different domains need different frames:

| Domain | Suggested frame | Why |
| --- | --- | --- |
| 40-year career retrospective | Deposition | Calls forth precision and on-the-record register. Wolf's first pack. |
| Departing senior engineer | Post-mortem / handoff | Engineering vocabulary; signals technical specificity expected. |
| Medical case history | Case write-up | Standard professional register; subject knows the format. |
| Incident witness | Statement | Neutral, evidentiary; appropriate for legal-adjacent capture. |
| Founder retrospective | Exit interview | Reflective register; permission to discuss what went wrong. |
| Family elder | Oral history | The neutral generic frame; less load on the subject. |

The frame is not decoration. It changes which memories surface and how guarded the subject is. The pack carries the frame in three places: the pack `title`, the `presentation.kicker`/`abstract`, and the choice of lens labels. (Engineering packs might rename "The Decision" to "The Trade-off." Medical packs might use "The Diagnosis." The engine doesn't care; the framing does.)

---

## 4. Sequencing within a pack

Wolf records are answerable in any order — this is non-negotiable for self-directed capture, where the subject's available attention is the binding constraint. But the *suggested* order, encoded as the `promptIds` array within each section and the section order itself, still matters. Two rules from the literature carry over:

1. **Concrete before abstract.** Room before Decision before Thing-Nobody-Said. Concrete sensory context primes the harder retrieval.
2. **Bounded episodes before sweeping summaries.** A single dated event before "what did you learn from your time there." The summary is recovered from the details, not the other way around.

The Wolf pack honors both rules: each section opens with Room prompts, runs through Decision/Person/Moment in the middle, and saves Thing-Nobody-Said for the end of the section, when context has been built. Pack authors should follow the same arc.

A second sequencing question is whether to interleave lenses within a section or to cluster them. The Wolf pack interleaves. Clustering all five Room prompts back-to-back is monotone for the subject and produces flatter answers. Interleaving keeps the subject moving between cognitive modes and produces richer testimony at the cost of some authoring effort.

---

## 5. Pack-authoring heuristics

These are heuristics, not rules. They reflect what the Wolf pack does well and what early author experience suggests goes wrong.

**Anchor every prompt in something the subject can verify.** A date, a place, a person, an event. Anchorless prompts ("how did your career develop?") return generic narrative. Anchored prompts return testimony.

**Use the subject's vocabulary.** If the subject calls a system "the JCL stack," the prompt says "the JCL stack," not "your batch processing infrastructure." This requires the pack author to do background reading on the subject — exactly the work the future Forge-for-Wolf tool will assist.

**Ask for the unwritten rule, not the rulebook.** Thing-Nobody-Said prompts should reference a specific domain (the firm, the team, the era) and ask for what was never written down. "What was the unofficial rule at X that nobody ever wrote down?" yields more than "describe the culture at X."

**Prefer specificity over coverage.** A pack of 30 highly specific prompts outperforms one of 60 generic prompts. The Wolf pack is 58 prompts because forty years of one career is a wide domain, not because more is better.

**Write each prompt to elicit at least 200 words of testimony.** Yes/no prompts, multiple-choice, and one-sentence answers belong in a survey, not a Wolf pack. Wolf's response kind is `long_text` for a reason.

**Lens labels are part of the IP.** The Wolf pack's lens names — The Room, The Decision, The Person, The Moment, The Thing Nobody Said — are working titles a future archivist or grandchild will read. They are intentionally short, declarative, and slightly literary. Engineering packs might use "The Trade-off, The Outage, The Hire, The Rewrite, The Unwritten Rule." The IP is the *shape* of the cognitive net, not the specific words.

---

## 6. Anti-patterns to avoid

| Anti-pattern | Why it fails |
| --- | --- |
| Yes/no or multiple-choice prompts | Wolf's strength is long-form testimony; structured fields belong in a different format. |
| Generic prompts ("describe your career") | Returns rehearsed summary, not testimony. |
| Lens-mismatch ("The Decision: tell us about your hobbies") | Subject feels manipulated; cognitive technique can't fire. |
| Compound prompts ("Describe X, then evaluate Y, then compare to Z") | Subject answers only one part, usually the easiest. Split into three prompts. |
| Coverage padding | Adding prompts to "be thorough" dilutes the record; subject fatigues. Cut the weakest 20%. |
| Editorialized prompts ("Why did your industry get this so wrong?") | Telegraphs the answer; subject either argues or capitulates. State the fork, not the verdict. |
| Time-period prompts without anchors | "Tell me about the 90s" → narrative. "What was the first day you used email at Maxus Energy?" → testimony. |
| Hidden judgments | "Why didn't you push back harder when X?" implies the subject was wrong. Re-cast as a fork: "When you saw X happening, what alternatives looked live to you at the time?" |

---

## 7. Self-directed capture vs interviewed capture

Wolf is built for *self-directed* capture: the subject sits with the prompt, types or speaks, takes their time, and commits. There is no live interviewer. This shifts the methodology in two ways:

- **The prompt has to do the warming-up that a human interviewer would do.** No "tell me a bit about where you grew up" small-talk preceded each Wolf prompt. The Room lens compensates by front-loading context reinstatement into the prompt itself.
- **The pack has to absorb the absence of follow-up.** A trained interviewer probes when an answer is thin. Wolf cannot. The pack must therefore include the follow-up *as its own prompt*, not assume one. The `suggestedFollowUp` field in the prompt schema exists for human reviewers who later read the record and want to flag where a probe would have helped; it is not currently surfaced in the capture UI.

A subject who prefers to be interviewed can have a Wolf pack run *by* a human helper, with the helper transcribing answers and committing them — Wolf doesn't care, the record is the record. But the pack itself should be authored for the harder case (alone, at midnight, on a phone) because that's where the subject's institutional knowledge actually gets retrieved.

---

## 8. From one pack to a pack template

The Wolf's Deposition is one worked instance of a structure that generalizes. Authoring a second pack — say, a departing-senior-engineer handoff — looks like this:

1. **Pick the frame** (post-mortem) and the lens vocabulary (e.g. The Outage, The Trade-off, The Hire, The Rewrite, The Unwritten Rule).
2. **Decompose the subject's domain into sections** (career arcs become tenure-at-companies; for a doctor's case history they become diagnostic episodes; for a founder, funding stages).
3. **Author 3–10 prompts per section, interleaving lenses.** Anchor each prompt; use the subject's vocabulary; bias toward Thing-Nobody-Said.
4. **Compute the count from the data** — Wolf's UI does this automatically — and resist the urge to round to a memorable number.
5. **Run it on yourself or one friendly subject before publishing.** Anything under-eliciting will show up immediately as one-sentence answers; that prompt gets rewritten or cut.

A *pack template* abstracts this further: a parameterized JSON skeleton with slots for subject name, era labels, organizations, and roles, instantiated for each new subject. Templates are the natural unit of distribution in a future pack registry: one well-crafted "40-year IT career" template can produce dozens of subject-specific packs without the author re-doing the cognitive design each time. This is the seam where an AI-assisted pack-authoring tool (a Forge-for-Wolf, separate from the runtime) can do real work: read a profile, fill the template, surface the prompts for human review, freeze the result.

---

## 9. Open questions and known limits

A draft this early is more useful when it admits what it does not know.

- **No empirical evaluation yet.** The Wolf pack has not been compared head-to-head with alternative methodologies on the same subjects. Anecdotally the cognitive-interview heritage suggests it will outperform generic prompts; this is unmeasured for the self-directed case.
- **Length asymmetry.** Some subjects produce 2,000-word answers; others produce 200. Both can be valid testimony but compare poorly in exports. We have not decided whether to surface this asymmetry in the UI.
- **Cadence is not yet pack-declared.** Storyworth-style products show that weekly delivery reliably increases completion. Wolf currently treats answering as on-demand. A future schema extension may let packs declare a recommended cadence.
- **Speech transcription quality is uneven across browsers.** Subjects who speak rather than type produce records whose source attribution is `speech_transcript` but whose accuracy varies. This is documented in the export bundle and is not a defect of the methodology, but it is a limit of the current capture mode.
- **The literature is for interviewed, not self-directed, capture.** Geiselman & Fisher's evidence base is from forensic interviewing with a live trained interviewer present. Wolf is adapting the techniques to asynchronous self-capture, where the prompt does the work a human would have done. Whether the effect sizes carry over at the same magnitude is an open empirical question.

---

## 10. Further reading

For pack authors who want the underlying literature:

- R. Edward Geiselman & Ronald P. Fisher. *Memory-Enhancing Techniques for Investigative Interviewing: The Cognitive Interview.* (1992 monograph; the foundational text for the practice.)
- Becky Milne & Ray Bull. *Investigative Interviewing: Psychology and Practice.* (Wiley, 1999.) Practitioner-facing overview of CI in policing.
- Donald A. Ritchie. *Doing Oral History.* (Oxford, 3rd ed.) Standard methodological guide for the institutional-lane practice Wolf is parallel to.
- The UK College of Policing's *PEACE* model interview guidance, which formalizes CI for trained interviewers and is freely available.

For the design-level context this document sits inside:

- `DESIGN.md` parts 4, 5, and 13 (capture pack model, validation rules, first-pack identity).
- `docs/PACK_AUTHORING.md` (the schema, how to validate, how to publish).
- `docs/AXM_FAMILY.md` (where Wolf sits in the AXM protocol; the Forge/Genesis split that motivates a future LLM-assisted pack authoring tool).
- `STATUS.md` (current implementation state and known gaps).
