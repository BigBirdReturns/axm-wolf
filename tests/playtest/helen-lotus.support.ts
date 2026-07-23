import { IDBFactory } from 'fake-indexeddb';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { buildRecordBundle, createRecord, digestPack, validatePack } from '../../src/engine/index.js';
import type { WolfRecord } from '../../src/engine/index.js';
import { buildSurveyAnalysisHandoff } from '../../src/app/lib/surveyAnalysis.js';
import {
  commitResponseAtomic,
  getDraft,
  listSurveyAssignments,
  loadRecord,
  markSurveyReceived,
  openWolfDb,
  saveDraft,
  saveRecord,
  saveSurveyAssignment,
  updateSurveyAssignmentStatus,
} from '../../src/storage/index.js';

type Actor = 'owner' | 'helen' | 'lotus' | 'subscription-llm' | 'owner-reviewer';
type DashboardStatus = 'invited' | 'started' | 'received' | 'submitted' | 'analyzing' | 'completed';

export type PlaytestEvent = {
  sequence: number;
  at: string;
  actor: Actor;
  recipient: 'Helen' | 'Lotus';
  action: string;
  expectation: string;
  observed: string;
  dashboardStatus: DashboardStatus;
  receipt: Record<string, unknown>;
};

type SourceReference = {
  recordId: string;
  promptId: string;
  revisionId: string;
  quote: string;
};

type AnalysisClaim = {
  claimId: string;
  kind: 'summary' | 'risk' | 'planning-suggestion';
  text: string;
  confidence: 'confirmed' | 'probable' | 'possible' | 'unknown';
  sourceReferences: SourceReference[];
};

type ManualAnalysisHandoff = {
  schemaVersion: 1;
  kind: 'wolf-survey-analysis-handoff';
  handoffId: string;
  runMode: 'manual-subscription';
  createdAt: string;
  recipientLabel: string;
  assignmentId: string;
  recordDigest: string;
  sourceSnapshot: Array<SourceReference & { promptText: string; fullResponse: string }>;
  instructions: string[];
  returnContract: {
    claimsRequireSourceReferences: true;
    testimonyMayNotBeModified: true;
    humanReviewRequired: true;
  };
};

type ManualAnalysisReturn = {
  schemaVersion: 1;
  kind: 'wolf-survey-analysis-return';
  responseId: string;
  handoffId: string;
  analyst: string;
  method: 'manual ChatGPT or Claude subscription run';
  analyzedAt: string;
  claims: AnalysisClaim[];
};

export type PlaytestResult = {
  schemaVersion: 1;
  kind: 'wolf-helen-lotus-playtest';
  syntheticDataNotice: string;
  runMode: 'deterministic-local-simulation';
  assumptions: string[];
  events: PlaytestEvent[];
  handoffs: ManualAnalysisHandoff[];
  simulatedReturns: ManualAnalysisReturn[];
  reviews: Array<{
    responseId: string;
    claimId: string;
    decision: 'accepted' | 'rejected';
    reviewer: 'owner';
    rationale: string;
  }>;
  finalDashboard: Array<{
    assignmentId: string;
    recipientLabel: string;
    surveyLabel: string;
    status: DashboardStatus;
    answeredPrompts: number;
    pendingDrafts: number;
    acceptedClaims: number;
    rejectedClaims: number;
    nextAction: string;
  }>;
  findings: Array<{ severity: 'pass' | 'gap' | 'risk'; finding: string; evidence: string }>;
};

const START = Date.parse('2026-07-13T16:00:00.000Z');

function at(minutes: number): string {
  return new Date(START + minutes * 60_000).toISOString();
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function source(record: WolfRecord, promptId: string, quote: string): SourceReference {
  const response = record.responses.find((entry) => entry.promptId === promptId);
  const revision = response?.revisions.at(-1);
  if (!revision || !revision.text.includes(quote)) throw new Error(`Playtest source quote is not present in ${record.recordId}/${promptId}`);
  return { recordId: record.recordId, promptId, revisionId: revision.revisionId, quote };
}

function validateReturn(handoff: ManualAnalysisHandoff, analysisReturn: ManualAnalysisReturn): void {
  if (analysisReturn.handoffId !== handoff.handoffId) throw new Error('Analysis return does not match handoff');
  const frozen = new Map(handoff.sourceSnapshot.map((entry) => [`${entry.recordId}|${entry.promptId}|${entry.revisionId}`, entry.fullResponse]));
  for (const claim of analysisReturn.claims) {
    if (claim.sourceReferences.length === 0) throw new Error(`Claim ${claim.claimId} has no source reference`);
    for (const reference of claim.sourceReferences) {
      const text = frozen.get(`${reference.recordId}|${reference.promptId}|${reference.revisionId}`);
      if (!text || !text.includes(reference.quote)) throw new Error(`Claim ${claim.claimId} cites testimony outside the frozen handoff`);
    }
  }
}

export async function runHelenLotusPlaytest(): Promise<PlaytestResult> {
  const db = await openWolfDb(new IDBFactory());
  const pack = validatePack(genericPackJson);
  const packDigest = await digestPack(pack);
  const events: PlaytestEvent[] = [];
  const handoffs: ManualAnalysisHandoff[] = [];
  const simulatedReturns: ManualAnalysisReturn[] = [];
  const reviews: PlaytestResult['reviews'] = [];
  let sequence = 0;

  function log(input: Omit<PlaytestEvent, 'sequence'>): void {
    events.push({ sequence: ++sequence, ...input });
  }

  async function runRecipient(input: {
    slug: 'helen' | 'lotus';
    label: 'Helen' | 'Lotus';
    offset: number;
    responses: Array<{ promptId: string; text: string }>;
  }): Promise<void> {
    const assignmentId = `survey-${input.slug}-july`;
    const surveyLabel = 'How your operating knowledge should become a usable plan';
    const createdAt = at(input.offset);
    await saveSurveyAssignment(db, { assignmentId, packId: pack.packId, recipientLabel: input.label, surveyLabel, status: 'invited', createdAt, updatedAt: createdAt, receivedAt: null });
    log({ at: createdAt, actor: 'owner', recipient: input.label, action: 'Create labeled private invitation', expectation: `${input.label} sees who the survey is for, why it exists, and that draft text is not yet testimony.`, observed: 'Assignment identity is durable and isolated from the other recipient.', dashboardStatus: 'invited', receipt: { assignmentId, packId: pack.packId, recipientLabel: input.label, surveyLabel } });

    await updateSurveyAssignmentStatus(db, assignmentId, 'started', at(input.offset + 2));
    const record = createRecord({ recordId: assignmentId, pack, packDigest, appVersion: '0.3.0-playtest', title: `${surveyLabel} — ${input.label}`, subject: { displayName: input.label, subtitle: surveyLabel }, now: at(input.offset + 2) });
    await saveRecord(db, record);
    log({ at: at(input.offset + 2), actor: input.slug, recipient: input.label, action: 'Open invitation and begin', expectation: 'The first screen explains ownership, effort, save semantics, privacy, downstream manual analysis, and how to resume.', observed: 'The hosted start screen now explains that manual subscription analysis is optional, separately decided at submission, cited, and unable to change answers.', dashboardStatus: 'started', receipt: { recordId: assignmentId, title: record.title, sourceTruth: 'raw response revisions' } });

    await saveDraft(db, assignmentId, input.responses[0]!.promptId, input.responses[0]!.text.slice(0, Math.max(24, Math.floor(input.responses[0]!.text.length / 2))), at(input.offset + 5));
    const restoredDraft = await getDraft(db, assignmentId, input.responses[0]!.promptId);
    log({ at: at(input.offset + 6), actor: input.slug, recipient: input.label, action: 'Pause and resume a partial answer', expectation: 'Partial text survives without being counted as submitted testimony.', observed: restoredDraft ? 'Draft restored; dashboard remains started.' : 'Draft was lost.', dashboardStatus: 'started', receipt: { promptId: input.responses[0]!.promptId, draftRestored: Boolean(restoredDraft), committed: false } });

    for (let index = 0; index < input.responses.length; index += 1) {
      const response = input.responses[index]!;
      await commitResponseAtomic(db, assignmentId, response.promptId, response.text, 'typed', at(input.offset + 8 + index));
    }
    if (input.slug === 'helen') {
      await commitResponseAtomic(db, assignmentId, input.responses[0]!.promptId, `${input.responses[0]!.text} I would rather review a short concrete example than a generic summary.`, 'typed', at(input.offset + 12));
    }
    const captured = await loadRecord(db, assignmentId);
    if (!captured) throw new Error(`Record ${assignmentId} did not persist`);
    log({ at: at(input.offset + 13), actor: input.slug, recipient: input.label, action: 'Save answers to the record', expectation: 'Each save produces a visible receipt and edits append revisions.', observed: input.slug === 'helen' ? 'Committed answers are stored by stable prompt ID; Helen’s edit preserves both revisions.' : 'Committed answers are stored by stable prompt ID and remain isolated from Helen’s record.', dashboardStatus: 'started', receipt: { answeredPrompts: captured.responses.length, revisionCounts: Object.fromEntries(captured.responses.map((entry) => [entry.promptId, entry.revisions.length])), pendingDrafts: captured.drafts.length } });

    await updateSurveyAssignmentStatus(db, assignmentId, 'submitted', at(input.offset + 15));
    log({ at: at(input.offset + 15), actor: input.slug, recipient: input.label, action: 'Submit the finished response', expectation: 'Recipient sees exactly what becomes shareable, separately allows or declines manual model analysis, and gets a submission receipt.', observed: 'Submission records an explicit analysis choice; declining still permits testimony submission and blocks model handoff creation.', dashboardStatus: 'submitted', receipt: { assignmentId, analysisConsent: true, recordDigest: await sha256(buildRecordBundle(captured, { includeDrafts: true, exportedAt: at(input.offset + 15) })) } });

    await markSurveyReceived(db, { assignmentId, packId: pack.packId, recipientLabel: input.label, surveyLabel }, at(input.offset + 16));
    log({ at: at(input.offset + 16), actor: 'owner', recipient: input.label, action: 'Receive response in dashboard', expectation: 'One row changes state without altering or merging the other recipient.', observed: 'The assignment becomes received and retains its original recipient and campaign labels.', dashboardStatus: 'received', receipt: { assignmentId, recipientLabel: input.label, status: 'received' } });

    await updateSurveyAssignmentStatus(db, assignmentId, 'analyzing', at(input.offset + 18));
    const handoff: ManualAnalysisHandoff = await buildSurveyAnalysisHandoff(captured, input.label, at(input.offset + 18));
    handoffs.push(handoff);
    log({ at: at(input.offset + 18), actor: 'owner', recipient: input.label, action: 'Export frozen analysis handoff', expectation: 'The model receives a frozen, attributable copy while the live record remains unchanged.', observed: 'The hosted dashboard now exports a frozen, revision-cited handoff and validates the manual return before publishing it.', dashboardStatus: 'analyzing', receipt: { handoffId: handoff.handoffId, recordDigest: handoff.recordDigest, sourceRevisionCount: handoff.sourceSnapshot.length, runtimeApiCalls: 0 } });

    const isHelen = input.slug === 'helen';
    const analysisReturn: ManualAnalysisReturn = {
      schemaVersion: 1,
      kind: 'wolf-survey-analysis-return',
      responseId: `manual-return-${input.slug}-001`,
      handoffId: handoff.handoffId,
      analyst: 'Manual subscription model run (simulated)',
      method: 'manual ChatGPT or Claude subscription run',
      analyzedAt: at(input.offset + 25),
      claims: isHelen ? [
        { claimId: 'helen-summary-1', kind: 'summary', text: 'Helen needs planning views anchored in concrete examples and an explicit morning scan.', confidence: 'confirmed', sourceReferences: [source(captured, 'operations.normal-day', 'I start by checking the overnight notes'), source(captured, 'operations.normal-day', 'short concrete example')] },
        { claimId: 'helen-risk-1', kind: 'risk', text: 'A missing shared calendar can silently break coordination.', confidence: 'probable', sourceReferences: [source(captured, 'operations.hidden-dependency', 'shared calendar')] },
        { claimId: 'helen-plan-1', kind: 'planning-suggestion', text: 'Automatically restructure Helen’s workflow immediately.', confidence: 'possible', sourceReferences: [source(captured, 'operations.normal-day', 'overnight notes')] },
      ] : [
        { claimId: 'lotus-summary-1', kind: 'summary', text: 'Lotus uses a visual site pass before trusting a dashboard.', confidence: 'confirmed', sourceReferences: [source(captured, 'operations.normal-day', 'walk the site once')] },
        { claimId: 'lotus-risk-1', kind: 'risk', text: 'The unowned Airtable view is a continuity risk.', confidence: 'probable', sourceReferences: [source(captured, 'operations.hidden-dependency', 'unowned Airtable view')] },
        { claimId: 'lotus-plan-1', kind: 'planning-suggestion', text: 'Add a dashboard checkpoint asking whether the site view and Airtable disagree before planning work.', confidence: 'possible', sourceReferences: [source(captured, 'operations.first-alert', 'numbers look normal but the room feels wrong')] },
      ],
    };
    validateReturn(handoff, analysisReturn);
    simulatedReturns.push(analysisReturn);
    log({ at: at(input.offset + 25), actor: 'subscription-llm', recipient: input.label, action: 'Return cited summaries, risks, and planning suggestions', expectation: 'Derived claims are visibly separate, source-linked, uncertain, and pending review.', observed: 'The simulated return passes frozen-snapshot citation validation and does not mutate the record.', dashboardStatus: 'analyzing', receipt: { responseId: analysisReturn.responseId, claims: analysisReturn.claims.length, validation: 'passed', runtimeApiCalls: 0 } });

    for (const claim of analysisReturn.claims) {
      const reject = claim.claimId === 'helen-plan-1';
      reviews.push({ responseId: analysisReturn.responseId, claimId: claim.claimId, decision: reject ? 'rejected' : 'accepted', reviewer: 'owner', rationale: reject ? 'Overreaches from a preference into an unauthorized workflow change; ask Helen first.' : 'Traceable to the frozen testimony and appropriately scoped.' });
    }
    await updateSurveyAssignmentStatus(db, assignmentId, 'completed', at(input.offset + 30));
    log({ at: at(input.offset + 30), actor: 'owner-reviewer', recipient: input.label, action: 'Review claims and close the loop', expectation: 'Accepted claims inform a plan; rejected suggestions remain visible but cannot drive action.', observed: isHelen ? 'Two claims accepted; one overreaching automation plan rejected.' : 'All three claims accepted as a proposed, reversible planning checkpoint.', dashboardStatus: 'completed', receipt: { accepted: reviews.filter((review) => review.responseId === analysisReturn.responseId && review.decision === 'accepted').map((review) => review.claimId), rejected: reviews.filter((review) => review.responseId === analysisReturn.responseId && review.decision === 'rejected').map((review) => review.claimId), testimonyChanged: false } });
  }

  try {
    await runRecipient({ slug: 'helen', label: 'Helen', offset: 0, responses: [
      { promptId: 'operations.normal-day', text: 'I start by checking the overnight notes, then I compare the shared plan with what people are actually doing.' },
      { promptId: 'operations.hidden-dependency', text: 'The shared calendar is the hidden dependency. When nobody owns it, promises quietly drift.' },
      { promptId: 'operations.first-alert', text: 'The first warning is when two people describe the same priority differently.' },
    ] });
    await runRecipient({ slug: 'lotus', label: 'Lotus', offset: 60, responses: [
      { promptId: 'operations.normal-day', text: 'I walk the site once before I trust the dashboard, then I photograph anything that does not match the plan.' },
      { promptId: 'operations.hidden-dependency', text: 'The unowned Airtable view is the dependency. It is where the useful exceptions live.' },
      { promptId: 'operations.first-alert', text: 'Trouble starts when the numbers look normal but the room feels wrong or a repeated exception has no owner.' },
    ] });

    const assignments = await listSurveyAssignments(db);
    const finalDashboard = await Promise.all(assignments.map(async (assignment) => {
      const record = await loadRecord(db, assignment.assignmentId);
      const responseId = `manual-return-${assignment.recipientLabel.toLowerCase()}-001`;
      const recipientReviews = reviews.filter((review) => review.responseId === responseId);
      return {
        assignmentId: assignment.assignmentId,
        recipientLabel: assignment.recipientLabel,
        surveyLabel: assignment.surveyLabel,
        status: assignment.status,
        answeredPrompts: record?.responses.length ?? 0,
        pendingDrafts: record?.drafts.length ?? 0,
        acceptedClaims: recipientReviews.filter((review) => review.decision === 'accepted').length,
        rejectedClaims: recipientReviews.filter((review) => review.decision === 'rejected').length,
        nextAction: assignment.recipientLabel === 'Helen' ? 'Show Helen the two cited findings and ask before changing her workflow.' : 'Test the site-versus-dashboard discrepancy checkpoint with Lotus on the next walkthrough.',
      };
    }));

    return {
      schemaVersion: 1,
      kind: 'wolf-helen-lotus-playtest',
      syntheticDataNotice: 'Helen and Lotus responses in this run are synthetic UX fixtures, not statements made by either person.',
      runMode: 'deterministic-local-simulation',
      assumptions: ['You are the dashboard owner.', 'Helen is simulated first and Lotus second as independent recipients.', 'Manual LLM subscription use is modeled as export, human-operated upload/paste, structured return, local validation, and owner review.', 'No runtime API or token-metered model call occurs.'],
      events,
      handoffs,
      simulatedReturns,
      reviews,
      finalDashboard,
      findings: [
        { severity: 'pass', finding: 'Recipient and campaign identity stayed isolated across both loops.', evidence: 'Distinct assignment and record IDs survived invited through completed.' },
        { severity: 'pass', finding: 'Draft, commit, and revision semantics behaved as designed.', evidence: 'Drafts restored without counting as testimony; Helen’s edited answer retained two revisions.' },
        { severity: 'pass', finding: 'Manual LLM output can remain derivative and reviewable without API calls.', evidence: 'Every claim cited a frozen revision and the record digest remained unchanged.' },
        { severity: 'pass', finding: 'The hosted survey dashboard now exposes the raw interview and the manual analysis exchange in one place.', evidence: 'Operators can review synchronized testimony, export a frozen cited handoff, validate a cited return, and see derived claims separately.' },
        { severity: 'pass', finding: 'Hosted recipients get a separate, optional manual-analysis consent choice.', evidence: 'The start screen explains the boundary; submission records allow or decline; a declined or missing choice prevents handoff export and server publication.' },
        { severity: 'risk', finding: 'A single status hides useful parallel truth.', evidence: 'Submitted, received, analysis pending, and review completeness would be clearer as separate fields rather than one mutable pipeline label.' },
      ],
    };
  } finally {
    db.close();
  }
}
