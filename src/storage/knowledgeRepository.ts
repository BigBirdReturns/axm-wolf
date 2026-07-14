import { createKnowledgeDrops, reviewKnowledgeDrop, sha256 } from '../knowledge/drop.js';
import type {
  AppendKnowledgeDropReviewInput,
  CreateDropFromStoredRevisionInput,
  KnowledgeDrop,
  KnowledgeDropReviewStatus,
  StoredKnowledgeDropReviewEvent,
} from '../knowledge/types.js';
import type { WolfDb } from './db.js';
import type { StoredRecordMeta, StoredResponseRow } from './recordRepository.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export async function createDropFromStoredRevision(
  db: WolfDb,
  input: CreateDropFromStoredRevisionInput,
): Promise<KnowledgeDrop> {
  const meta = await db.get<StoredRecordMeta>('records', input.recordId);
  if (!meta) throw new Error('Knowledge drop source record was not found');
  if (!meta.packSnapshot.prompts.some((prompt) => prompt.id === input.promptId)) {
    throw new Error('Knowledge drop source prompt is not part of the record');
  }
  const row = await db.get<StoredResponseRow>('responses', [input.recordId, input.promptId]);
  const revision = row?.revisions.find((candidate) => candidate.revisionId === input.revisionId);
  if (!revision) throw new Error('Knowledge drop source revision was not found');

  const revisionDigest = await sha256(revision.text);
  const identity = JSON.stringify([
    1,
    input.revisionId,
    revisionDigest,
    'utf16-code-unit',
    input.startOffset,
    input.endOffset,
    input.kind,
    input.extractionMethod ?? 'human_marked',
  ]);
  const dropId = `drop-${await sha256(identity)}`;
  const [candidate] = await createKnowledgeDrops({
    recordId: input.recordId,
    promptId: input.promptId,
    revisionId: input.revisionId,
    sourceText: revision.text,
    createdAt: input.createdAt,
    candidates: [{
      dropId,
      kind: input.kind,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      operationalPattern: input.operationalPattern,
      extractionMethod: input.extractionMethod,
    }],
  });
  if (!candidate) throw new Error('Knowledge drop candidate was not created');
  await validateKnowledgeDrop(candidate);

  let committed: KnowledgeDrop | null = null;
  await db.transaction(['records', 'responses', 'knowledgeDrops'], 'readwrite', async (tx) => {
    const currentMeta = await tx.get<StoredRecordMeta>('records', input.recordId);
    if (!currentMeta || !currentMeta.packSnapshot.prompts.some((prompt) => prompt.id === input.promptId)) {
      throw new Error('Knowledge drop source record changed before commit');
    }
    const currentRow = await tx.get<StoredResponseRow>('responses', [input.recordId, input.promptId]);
    const currentRevision = currentRow?.revisions.find((item) => item.revisionId === input.revisionId);
    if (!currentRevision || currentRevision.text !== revision.text) {
      throw new Error('Knowledge drop source revision changed before commit');
    }

    const existing = await tx.get<KnowledgeDrop>('knowledgeDrops', dropId);
    if (existing) {
      if (immutableIdentity(existing) !== immutableIdentity(candidate)) {
        throw new Error(`Knowledge drop ID collision ${dropId}`);
      }
      committed = existing;
      return;
    }
    await tx.put('knowledgeDrops', candidate);
    committed = candidate;
  });
  if (!committed) throw new Error('Knowledge drop creation did not commit');
  return committed;
}

export async function loadKnowledgeDrop(db: WolfDb, dropId: string): Promise<KnowledgeDrop | null> {
  const drop = (await db.get<KnowledgeDrop>('knowledgeDrops', dropId)) ?? null;
  if (drop) await validateKnowledgeDrop(drop);
  return drop;
}

export async function listKnowledgeDrops(
  db: WolfDb,
  filter: { recordId?: string; reviewStatus?: KnowledgeDropReviewStatus } = {},
): Promise<KnowledgeDrop[]> {
  const drops = await db.getAll<KnowledgeDrop>('knowledgeDrops');
  await Promise.all(drops.map(validateKnowledgeDrop));
  return drops
    .filter((drop) => filter.recordId === undefined || drop.source.recordId === filter.recordId)
    .filter((drop) => filter.reviewStatus === undefined || drop.reviewStatus === filter.reviewStatus)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.dropId.localeCompare(right.dropId));
}

export async function listKnowledgeDropReviewEvents(
  db: WolfDb,
  dropId: string,
): Promise<StoredKnowledgeDropReviewEvent[]> {
  return (await db.getAll<StoredKnowledgeDropReviewEvent>('knowledgeDropEvents'))
    .filter((event) => event.dropId === dropId)
    .sort((left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId));
}

export async function appendKnowledgeDropReview(
  db: WolfDb,
  input: AppendKnowledgeDropReviewInput,
): Promise<{ drop: KnowledgeDrop; event: StoredKnowledgeDropReviewEvent; idempotent: boolean }> {
  const requestId = input.requestId.trim();
  if (requestId.length === 0) throw new Error('Knowledge drop review requires a request ID');

  const initialDrop = await loadKnowledgeDrop(db, input.dropId);
  if (!initialDrop) throw new Error(`Knowledge drop ${input.dropId} was not found`);
  const initialEvents = await listKnowledgeDropReviewEvents(db, input.dropId);
  const repeated = (await db.getAll<StoredKnowledgeDropReviewEvent>('knowledgeDropEvents'))
    .find((event) => event.requestId === requestId);
  if (repeated) return repeatedReviewResult(initialDrop, repeated, input);
  if (initialDrop.version !== input.expectedPriorVersion) {
    throw new Error(`Knowledge drop version conflict: expected ${input.expectedPriorVersion}, found ${initialDrop.version}`);
  }

  const updated = reviewKnowledgeDrop(initialDrop, input.review);
  const reviewEvent = updated.reviewHistory.at(-1);
  if (!reviewEvent) throw new Error('Knowledge drop review event was not produced');
  const priorEventDigest = initialEvents.at(-1)?.eventDigest ?? null;
  const eventWithoutDigest = {
    ...reviewEvent,
    dropId: input.dropId,
    sequence: initialEvents.length + 1,
    expectedPriorVersion: input.expectedPriorVersion,
    requestId,
    priorEventDigest,
  };
  const event: StoredKnowledgeDropReviewEvent = {
    ...eventWithoutDigest,
    eventDigest: await sha256(JSON.stringify(eventWithoutDigest)),
  };

  let result: { drop: KnowledgeDrop; event: StoredKnowledgeDropReviewEvent; idempotent: boolean } | null = null;
  await db.transaction(['knowledgeDrops', 'knowledgeDropEvents'], 'readwrite', async (tx) => {
    const allEvents = await tx.getAll<StoredKnowledgeDropReviewEvent>('knowledgeDropEvents');
    const existingRequest = allEvents.find((item) => item.requestId === requestId);
    const current = await tx.get<KnowledgeDrop>('knowledgeDrops', input.dropId);
    if (!current) throw new Error(`Knowledge drop ${input.dropId} was not found`);
    if (existingRequest) {
      result = repeatedReviewResult(current, existingRequest, input);
      return;
    }
    if (current.version !== input.expectedPriorVersion) {
      throw new Error(`Knowledge drop version conflict: expected ${input.expectedPriorVersion}, found ${current.version}`);
    }
    const currentEvents = allEvents.filter((item) => item.dropId === input.dropId);
    const currentPriorDigest = currentEvents.sort((a, b) => a.sequence - b.sequence).at(-1)?.eventDigest ?? null;
    if (currentEvents.length + 1 !== event.sequence || currentPriorDigest !== event.priorEventDigest) {
      throw new Error('Knowledge drop review event sequence conflict');
    }
    await tx.put('knowledgeDropEvents', event);
    await tx.put('knowledgeDrops', updated);
    result = { drop: updated, event, idempotent: false };
  });
  if (!result) throw new Error('Knowledge drop review did not commit');
  return result;
}

export async function validateKnowledgeDrop(drop: KnowledgeDrop): Promise<void> {
  if (!drop || typeof drop !== 'object' || drop.schemaVersion !== 1) throw new Error('Unsupported knowledge drop schema');
  if (typeof drop.dropId !== 'string' || drop.dropId.length === 0) throw new Error('Knowledge drop requires an ID');
  if (!drop.source || drop.source.offsetEncoding !== 'utf16-code-unit') throw new Error('Unsupported knowledge drop offset encoding');
  if (!SHA256_PATTERN.test(drop.source.revisionDigest) || !SHA256_PATTERN.test(drop.source.quoteDigest)) {
    throw new Error('Knowledge drop requires SHA-256 source digests');
  }
  if (!Number.isInteger(drop.source.startOffset) || !Number.isInteger(drop.source.endOffset) || drop.source.startOffset < 0 || drop.source.endOffset <= drop.source.startOffset) {
    throw new Error('Knowledge drop has an invalid source span');
  }
  if (await sha256(drop.source.exactQuote) !== drop.source.quoteDigest) throw new Error('Knowledge drop quote digest mismatch');
  if (drop.reviewStatus === 'pending' && drop.visibility !== 'private') throw new Error('Pending knowledge drops must remain private');
  if (drop.visibility !== 'private') throw new Error('Workspace knowledge sharing is not available in this release');
  if (!Number.isInteger(drop.version) || drop.version < 1) throw new Error('Knowledge drop requires a positive version');
}

function immutableIdentity(drop: KnowledgeDrop): string {
  return JSON.stringify({
    schemaVersion: drop.schemaVersion,
    dropId: drop.dropId,
    source: drop.source,
    kind: drop.kind,
    extractionMethod: drop.extractionMethod,
    createdAt: drop.createdAt,
  });
}

function repeatedReviewResult(
  drop: KnowledgeDrop,
  event: StoredKnowledgeDropReviewEvent,
  input: AppendKnowledgeDropReviewInput,
): { drop: KnowledgeDrop; event: StoredKnowledgeDropReviewEvent; idempotent: true } {
  if (
    event.dropId !== input.dropId
    || event.expectedPriorVersion !== input.expectedPriorVersion
    || event.action !== input.review.action
    || event.actor !== input.review.actor.trim()
  ) {
    throw new Error(`Knowledge drop review request ID ${input.requestId} was reused with different content`);
  }
  return { drop, event, idempotent: true };
}
