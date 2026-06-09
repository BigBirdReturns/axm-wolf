import type {
  CreateRecordInput,
  WolfRecord,
  CaptureSource,
  ResponseRevision,
  ProgressSummary,
  CapturePack,
} from './types.js';
import { WolfValidationError } from './errors.js';
import { countWords } from './text.js';

// ---------------------------------------------------------------------------
// createRecord
// ---------------------------------------------------------------------------

export function createRecord(input: CreateRecordInput): WolfRecord {
  const now = input.now ?? new Date().toISOString();
  const title = input.title ?? input.pack.title;
  const subject =
    input.subject ??
    input.pack.subjectDefaults ?? { displayName: title };

  return {
    recordId: input.recordId,
    title,
    subject,
    packId: input.pack.packId,
    packVersion: input.pack.packVersion,
    packDigest: input.packDigest,
    packSnapshot: structuredClone(input.pack),
    createdAt: now,
    updatedAt: now,
    status: 'active',
    responses: [],
    drafts: [],
    lastExportedAt: null,
    appVersion: input.appVersion,
  };
}

// ---------------------------------------------------------------------------
// commitResponse
// ---------------------------------------------------------------------------

export function commitResponse(
  record: WolfRecord,
  promptId: string,
  text: string,
  source: CaptureSource,
  timestamp?: string,
): WolfRecord {
  // Reject empty / whitespace-only text
  if (text.trim().length === 0) {
    throw new WolfValidationError('Committed response text must not be empty or whitespace-only.');
  }

  // Reject promptId not present in the pack snapshot
  const promptExists = record.packSnapshot.prompts.some((p) => p.id === promptId);
  if (!promptExists) {
    throw new WolfValidationError(
      `Prompt "${promptId}" is not present in the record's pack snapshot.`,
    );
  }

  const capturedAt = timestamp ?? new Date().toISOString();

  // Find existing response for this prompt (if any)
  const existingResponse = record.responses.find((r) => r.promptId === promptId);
  const priorRevision =
    existingResponse && existingResponse.revisions.length > 0
      ? existingResponse.revisions[existingResponse.revisions.length - 1]
      : null;

  const newRevision: ResponseRevision = {
    revisionId: crypto.randomUUID(),
    text,
    capturedAt,
    source,
    locale: 'en-US',
    supersedesRevisionId: priorRevision ? priorRevision.revisionId : null,
  };

  // Build updated responses array — append revision, do not overwrite history
  let updatedResponses;
  if (existingResponse) {
    updatedResponses = record.responses.map((r) =>
      r.promptId === promptId
        ? { promptId: r.promptId, revisions: [...r.revisions, newRevision] }
        : r,
    );
  } else {
    updatedResponses = [
      ...record.responses,
      { promptId, revisions: [newRevision] },
    ];
  }

  // Clear any draft for this prompt
  const updatedDrafts = record.drafts.filter((d) => d.promptId !== promptId);

  return {
    ...record,
    responses: updatedResponses,
    drafts: updatedDrafts,
    updatedAt: capturedAt,
  };
}

// ---------------------------------------------------------------------------
// getCurrentResponse
// ---------------------------------------------------------------------------

export function getCurrentResponse(
  record: WolfRecord,
  promptId: string,
): ResponseRevision | null {
  const response = record.responses.find((r) => r.promptId === promptId);
  if (!response || response.revisions.length === 0) return null;
  return response.revisions[response.revisions.length - 1] ?? null;
}

// ---------------------------------------------------------------------------
// computeProgress
// ---------------------------------------------------------------------------

export function computeProgress(pack: CapturePack, record: WolfRecord): ProgressSummary {
  // Build a set of valid prompt IDs from the pack (not the snapshot — caller supplies pack)
  const packPromptIds = new Set(pack.prompts.map((p) => p.id));

  // Build lookup: promptId -> current revision text (non-empty = answered)
  // Only count responses whose promptId is present in the pack (ignore stale)
  const answeredIds = new Set<string>();
  const currentTextByPrompt = new Map<string, string>();

  for (const response of record.responses) {
    if (!packPromptIds.has(response.promptId)) continue; // stale — DESIGN 7.1
    if (response.revisions.length === 0) continue;
    const latest = response.revisions[response.revisions.length - 1];
    if (latest && latest.text.trim().length > 0) {
      answeredIds.add(response.promptId);
      currentTextByPrompt.set(response.promptId, latest.text);
    }
  }

  // Draft prompts: have a non-empty draft AND are not already answered
  const draftPromptIds = new Set<string>();
  for (const draft of record.drafts) {
    if (!packPromptIds.has(draft.promptId)) continue; // stale
    if (draft.text.trim().length > 0 && !answeredIds.has(draft.promptId)) {
      draftPromptIds.add(draft.promptId);
    }
  }

  const totalPrompts = pack.prompts.length;
  const answeredPrompts = answeredIds.size;
  const draftPrompts = draftPromptIds.size;

  // Word count: sum countWords over current revision text for answered prompts
  let wordCount = 0;
  for (const text of currentTextByPrompt.values()) {
    wordCount += countWords(text);
  }

  const percentAnswered =
    totalPrompts === 0 ? 0 : Math.round((answeredPrompts / totalPrompts) * 100);

  // bySection
  const bySection = pack.sections.map((section) => {
    const sectionTotal = section.promptIds.length;
    const sectionAnswered = section.promptIds.filter((id) => answeredIds.has(id)).length;
    const sectionDraft = section.promptIds.filter((id) => draftPromptIds.has(id)).length;
    const sectionPercent =
      sectionTotal === 0 ? 0 : Math.round((sectionAnswered / sectionTotal) * 100);
    return {
      sectionId: section.id,
      totalPrompts: sectionTotal,
      answeredPrompts: sectionAnswered,
      draftPrompts: sectionDraft,
      percentAnswered: sectionPercent,
    };
  });

  return {
    totalPrompts,
    answeredPrompts,
    draftPrompts,
    wordCount,
    percentAnswered,
    bySection,
  };
}
