import { sha256 } from '../knowledge/drop.js';
import type { KnowledgeDrop, StoredKnowledgeDropReviewEvent } from '../knowledge/types.js';
import type { WolfDb } from './db.js';
import { validateKnowledgeDrop } from './knowledgeRepository.js';
import type { StoredResponseRow } from './recordRepository.js';

export type WolfKnowledgeArchive = {
  schemaVersion: 1;
  exportedAt: string;
  drops: KnowledgeDrop[];
  events: StoredKnowledgeDropReviewEvent[];
  integrity: {
    algorithm: 'sha256';
    archiveDigest: string;
  };
};

export async function exportKnowledgeArchive(
  db: WolfDb,
  exportedAt = new Date().toISOString(),
): Promise<WolfKnowledgeArchive> {
  const drops = (await db.getAll<KnowledgeDrop>('knowledgeDrops'))
    .sort((left, right) => left.dropId.localeCompare(right.dropId));
  const events = (await db.getAll<StoredKnowledgeDropReviewEvent>('knowledgeDropEvents'))
    .sort((left, right) => left.dropId.localeCompare(right.dropId) || left.sequence - right.sequence);
  await validateArchiveRows(drops, events);
  const unsigned = { schemaVersion: 1 as const, exportedAt, drops, events };
  return {
    ...unsigned,
    integrity: { algorithm: 'sha256', archiveDigest: await sha256(JSON.stringify(unsigned)) },
  };
}

export async function parseKnowledgeArchive(input: unknown): Promise<WolfKnowledgeArchive> {
  const value: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  if (!isObject(value)) throw new Error('Knowledge archive must be an object');
  const allowed = new Set(['schemaVersion', 'exportedAt', 'drops', 'events', 'integrity']);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Knowledge archive contains unsupported fields');
  if (value.schemaVersion !== 1) throw new Error('Unsupported knowledge archive schema');
  if (typeof value.exportedAt !== 'string' || !Array.isArray(value.drops) || !Array.isArray(value.events)) {
    throw new Error('Knowledge archive is incomplete');
  }
  if (!isObject(value.integrity) || value.integrity.algorithm !== 'sha256' || typeof value.integrity.archiveDigest !== 'string') {
    throw new Error('Knowledge archive integrity data is invalid');
  }
  const archive = value as WolfKnowledgeArchive;
  const unsigned = { schemaVersion: archive.schemaVersion, exportedAt: archive.exportedAt, drops: archive.drops, events: archive.events };
  if (await sha256(JSON.stringify(unsigned)) !== archive.integrity.archiveDigest) throw new Error('Knowledge archive digest mismatch');
  await validateArchiveRows(archive.drops, archive.events);
  return archive;
}

export async function importKnowledgeArchive(db: WolfDb, input: unknown): Promise<WolfKnowledgeArchive> {
  const archive = await parseKnowledgeArchive(input);
  const sourceTexts = new Map<string, string>();
  for (const drop of archive.drops) {
    const key = `${drop.source.recordId}\u0000${drop.source.promptId}\u0000${drop.source.revisionId}`;
    let rowText = sourceTexts.get(key);
    if (rowText === undefined) {
      const row = await db.get<StoredResponseRow>('responses', [drop.source.recordId, drop.source.promptId]);
      const revision = row?.revisions.find((item) => item.revisionId === drop.source.revisionId);
      if (!revision) throw new Error(`Knowledge archive source revision ${drop.source.revisionId} was not restored first`);
      rowText = revision.text;
      sourceTexts.set(key, rowText);
    }
    if (await sha256(rowText) !== drop.source.revisionDigest) throw new Error('Knowledge archive source revision digest mismatch');
    if (rowText.slice(drop.source.startOffset, drop.source.endOffset) !== drop.source.exactQuote) {
      throw new Error('Knowledge archive source quote does not match the restored revision');
    }
  }

  await db.transaction(['responses', 'knowledgeDrops', 'knowledgeDropEvents'], 'readwrite', async (tx) => {
    if ((await tx.getAll('knowledgeDrops')).length > 0 || (await tx.getAll('knowledgeDropEvents')).length > 0) {
      throw new Error('Knowledge archive restore requires an empty knowledge store');
    }
    for (const drop of archive.drops) {
      const row = await tx.get<StoredResponseRow>('responses', [drop.source.recordId, drop.source.promptId]);
      const revision = row?.revisions.find((item) => item.revisionId === drop.source.revisionId);
      const expectedText = sourceTexts.get(`${drop.source.recordId}\u0000${drop.source.promptId}\u0000${drop.source.revisionId}`);
      if (!revision || revision.text !== expectedText) throw new Error('Knowledge archive source changed before restore');
      await tx.put('knowledgeDrops', drop);
    }
    for (const event of archive.events) await tx.put('knowledgeDropEvents', event);
  });
  return archive;
}

async function validateArchiveRows(
  drops: KnowledgeDrop[],
  events: StoredKnowledgeDropReviewEvent[],
): Promise<void> {
  const dropIds = new Set<string>();
  for (const drop of drops) {
    if (dropIds.has(drop.dropId)) throw new Error(`Duplicate knowledge drop ${drop.dropId}`);
    dropIds.add(drop.dropId);
    await validateKnowledgeDrop(drop);
  }

  const eventIds = new Set<string>();
  const requestIds = new Set<string>();
  const grouped = new Map<string, StoredKnowledgeDropReviewEvent[]>();
  for (const event of events) {
    if (!dropIds.has(event.dropId)) throw new Error(`Knowledge event references missing drop ${event.dropId}`);
    if (eventIds.has(event.eventId) || requestIds.has(event.requestId)) throw new Error('Knowledge archive contains duplicate event identity');
    eventIds.add(event.eventId);
    requestIds.add(event.requestId);
    const { eventDigest, ...withoutDigest } = event;
    if (await sha256(JSON.stringify(withoutDigest)) !== eventDigest) throw new Error('Knowledge event digest mismatch');
    grouped.set(event.dropId, [...(grouped.get(event.dropId) ?? []), event]);
  }
  for (const drop of drops) {
    const chain = (grouped.get(drop.dropId) ?? []).sort((a, b) => a.sequence - b.sequence);
    let prior: string | null = null;
    for (let index = 0; index < chain.length; index += 1) {
      const event = chain[index]!;
      if (event.sequence !== index + 1 || event.priorEventDigest !== prior || event.expectedPriorVersion !== index + 1) {
        throw new Error(`Knowledge event chain is broken for ${drop.dropId}`);
      }
      prior = event.eventDigest;
    }
    if (drop.version !== chain.length + 1 || drop.reviewHistory.length !== chain.length) {
      throw new Error(`Knowledge drop projection does not match its event chain for ${drop.dropId}`);
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
