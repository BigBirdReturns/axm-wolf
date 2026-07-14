import type {
  CreateKnowledgeDropCandidate,
  KnowledgeDrop,
  KnowledgeDropReviewInput,
  KnowledgeDropReviewStatus,
  KnowledgeDropSource,
} from './types.js';

export async function createKnowledgeDrops(input: {
  recordId: string;
  promptId: string;
  revisionId: string;
  sourceText: string;
  candidates: CreateKnowledgeDropCandidate[];
  createdAt?: string;
}): Promise<KnowledgeDrop[]> {
  if (input.recordId.trim().length === 0 || input.promptId.trim().length === 0 || input.revisionId.trim().length === 0) {
    throw new Error('Knowledge drops require stable record, prompt, and revision IDs');
  }
  if (input.candidates.length === 0) return [];
  const ids = new Set<string>();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const revisionDigest = await sha256(input.sourceText);
  return Promise.all(input.candidates.map(async (candidate) => {
    if (ids.has(candidate.dropId)) throw new Error(`Duplicate knowledge drop ID ${candidate.dropId}`);
    ids.add(candidate.dropId);
    const source = sourceSpan(input, candidate.startOffset, candidate.endOffset);
    source.revisionDigest = revisionDigest;
    source.quoteDigest = await sha256(source.exactQuote);
    const text = (candidate.text ?? source.exactQuote).trim();
    if (text.length === 0) throw new Error('A knowledge drop requires non-empty text');
    return {
      schemaVersion: 1,
      dropId: candidate.dropId,
      source,
      kind: candidate.kind,
      text,
      operationalPattern: normalizeOptional(candidate.operationalPattern),
      reviewStatus: 'pending',
      visibility: 'private',
      extractionMethod: candidate.extractionMethod ?? 'human_marked',
      version: 1,
      createdAt,
      updatedAt: createdAt,
      reviewHistory: [],
    };
  }));
}

export function reviewKnowledgeDrop(drop: KnowledgeDrop, review: KnowledgeDropReviewInput): KnowledgeDrop {
  if (drop.reviewStatus === 'rejected') throw new Error('A rejected knowledge drop cannot be reviewed again');
  const actor = review.actor.trim();
  if (actor.length === 0) throw new Error('A knowledge drop review requires an actor');
  const at = review.at ?? new Date().toISOString();
  const prior = drop;
  let nextStatus: KnowledgeDropReviewStatus = drop.reviewStatus;
  let nextVisibility = drop.visibility;
  let nextText = drop.text;
  let nextKind = drop.kind;
  let nextPattern = drop.operationalPattern;

  if (review.action === 'confirm') {
    nextStatus = 'confirmed';
  } else if (review.action === 'correct') {
    nextText = review.text.trim();
    if (nextText.length === 0) throw new Error('A corrected knowledge drop requires non-empty text');
    nextKind = review.kind ?? drop.kind;
    nextPattern = review.operationalPattern === undefined ? drop.operationalPattern : normalizeOptional(review.operationalPattern);
    nextStatus = 'corrected';
  } else if (review.action === 'reject') {
    nextStatus = 'rejected';
    nextVisibility = 'private';
  } else {
    nextVisibility = 'private';
  }

  return {
    ...drop,
    kind: nextKind,
    text: nextText,
    operationalPattern: nextPattern,
    reviewStatus: nextStatus,
    visibility: nextVisibility,
    updatedAt: at,
    version: drop.version + 1,
    reviewHistory: [...drop.reviewHistory, {
      eventId: crypto.randomUUID(),
      action: review.action,
      actor,
      at,
      priorStatus: prior.reviewStatus,
      nextStatus,
      priorVisibility: prior.visibility,
      nextVisibility,
      priorText: prior.text,
      nextText,
      priorKind: prior.kind,
      nextKind,
      note: normalizeOptional(review.note),
    }],
  };
}

function sourceSpan(
  input: { recordId: string; promptId: string; revisionId: string; sourceText: string },
  startOffset: number,
  endOffset: number,
): KnowledgeDropSource {
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > input.sourceText.length) {
    throw new Error(`Invalid knowledge drop source span ${startOffset}:${endOffset}`);
  }
  return {
    recordId: input.recordId,
    promptId: input.promptId,
    revisionId: input.revisionId,
    revisionDigest: '',
    offsetEncoding: 'utf16-code-unit',
    startOffset,
    endOffset,
    exactQuote: input.sourceText.slice(startOffset, endOffset),
    quoteDigest: '',
  };
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}
