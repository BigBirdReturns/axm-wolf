// Record repository (DESIGN.md 8.1, 8.3): normalized storage of WolfRecord.
//
// A WolfRecord (src/engine/types.ts) embeds `responses` and `drafts` inline.
// In storage these are split across three object stores:
//   - 'records':   StoredRecordMeta (the record minus responses/drafts, with
//                   packSnapshot kept inline per DESIGN 8.1)
//   - 'responses': one row per (recordId, promptId) holding the revision list
//   - 'drafts':    one row per (recordId, promptId) holding draft text
//
// This module reassembles/splits between the engine's WolfRecord shape and
// the normalized storage rows.

import type { WolfDb } from './db.js';
import type { CaptureSource, Draft, PromptResponse, ResponseRevision, WolfRecord } from '../engine/types.js';
import { WolfValidationError } from '../engine/errors.js';

/** The 'records' store row shape: WolfRecord minus `responses` and `drafts`. */
export type StoredRecordMeta = Omit<WolfRecord, 'responses' | 'drafts'>;

/** The 'responses' store row shape (keyPath: ['recordId', 'promptId']). */
export type StoredResponseRow = {
  recordId: string;
  promptId: string;
  revisions: ResponseRevision[];
  updatedAt: string;
};

/** The 'drafts' store row shape (keyPath: ['recordId', 'promptId']). */
export type StoredDraftRow = {
  recordId: string;
  promptId: string;
  text: string;
  updatedAt: string;
};

function splitRecord(record: WolfRecord): {
  meta: StoredRecordMeta;
  responseRows: StoredResponseRow[];
  draftRows: StoredDraftRow[];
} {
  const { responses, drafts, ...meta } = record;

  const responseRows: StoredResponseRow[] = responses.map((r) => ({
    recordId: record.recordId,
    promptId: r.promptId,
    revisions: r.revisions,
    updatedAt: latestRevisionTimestamp(r) ?? record.updatedAt,
  }));

  const draftRows: StoredDraftRow[] = drafts.map((d) => ({
    recordId: record.recordId,
    promptId: d.promptId,
    text: d.text,
    updatedAt: d.updatedAt,
  }));

  return { meta, responseRows, draftRows };
}

function latestRevisionTimestamp(response: PromptResponse): string | undefined {
  const last = response.revisions[response.revisions.length - 1];
  return last?.capturedAt;
}

/**
 * Writes a full WolfRecord (meta + responses + drafts) in a single
 * read-write transaction. Used for imports/initial create; overwrites any
 * existing rows for this record's prompts.
 */
export async function saveRecord(db: WolfDb, record: WolfRecord): Promise<void> {
  const { meta, responseRows, draftRows } = splitRecord(record);

  await db.transaction(['records', 'responses', 'drafts'], 'readwrite', async (tx) => {
    await tx.put('records', meta);
    for (const row of responseRows) {
      await tx.put('responses', row);
    }
    for (const row of draftRows) {
      await tx.put('drafts', row);
    }
  });
}

/**
 * Reassembles a full WolfRecord from the normalized stores, or returns null
 * if no record meta exists for `recordId`.
 *
 * Responses and drafts are filtered by `recordId` and sorted by `promptId`
 * for deterministic ordering (the normalized stores have no ordering
 * guarantees beyond key order, and rows for other records must not leak in).
 */
export async function loadRecord(db: WolfDb, recordId: string): Promise<WolfRecord | null> {
  const meta = await db.get<StoredRecordMeta>('records', recordId);
  if (!meta) {
    return null;
  }

  const allResponses = await db.getAll<StoredResponseRow>('responses');
  const allDrafts = await db.getAll<StoredDraftRow>('drafts');

  const responses: PromptResponse[] = allResponses
    .filter((r) => r.recordId === recordId)
    .map((r) => ({ promptId: r.promptId, revisions: r.revisions }))
    .sort((a, b) => a.promptId.localeCompare(b.promptId));

  const drafts: Draft[] = allDrafts
    .filter((d) => d.recordId === recordId)
    .map((d) => ({ promptId: d.promptId, text: d.text, updatedAt: d.updatedAt }))
    .sort((a, b) => a.promptId.localeCompare(b.promptId));

  // Field order matters for JSON.stringify-based equality checks in tests:
  // place `responses`/`drafts` where they appear on the engine's WolfRecord
  // type (after `status`, before `lastExportedAt`/`appVersion`) rather than
  // appending them after all of `meta`'s keys.
  const { lastExportedAt, appVersion, ...rest } = meta;
  return {
    ...rest,
    responses,
    drafts,
    lastExportedAt,
    appVersion,
  } as WolfRecord;
}

/**
 * Lists summary info for all records, sorted by `updatedAt` descending
 * (most recently updated first).
 */
export async function listRecords(
  db: WolfDb,
): Promise<Array<{ recordId: string; title: string; status: WolfRecord['status']; updatedAt: string; packId: string }>> {
  const all = await db.getAll<StoredRecordMeta>('records');
  return all
    .map((m) => ({ recordId: m.recordId, title: m.title, status: m.status, updatedAt: m.updatedAt, packId: m.packId }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Removes a record's meta row plus all its response and draft rows in a
 * single read-write transaction. Other records' rows are untouched.
 */
export async function deleteRecord(db: WolfDb, recordId: string): Promise<void> {
  await db.transaction(['records', 'responses', 'drafts', 'knowledgeDrops', 'knowledgeDropEvents'], 'readwrite', async (tx) => {
    const allResponses = await tx.getAll<StoredResponseRow>('responses');
    const allDrafts = await tx.getAll<StoredDraftRow>('drafts');
    const allDrops = await tx.getAll<{ dropId: string; source: { recordId: string } }>('knowledgeDrops');
    const allEvents = await tx.getAll<{ eventId: string; dropId: string }>('knowledgeDropEvents');
    const deletedDropIds = new Set(allDrops.filter((drop) => drop.source.recordId === recordId).map((drop) => drop.dropId));

    for (const event of allEvents) {
      if (deletedDropIds.has(event.dropId)) await tx.delete('knowledgeDropEvents', event.eventId);
    }
    for (const dropId of deletedDropIds) await tx.delete('knowledgeDrops', dropId);

    await tx.delete('records', recordId);

    for (const row of allResponses) {
      if (row.recordId === recordId) {
        await tx.delete('responses', [row.recordId, row.promptId]);
      }
    }

    for (const row of allDrafts) {
      if (row.recordId === recordId) {
        await tx.delete('drafts', [row.recordId, row.promptId]);
      }
    }
  });
}

/**
 * DESIGN.md 8.3 transaction: atomically commits a new response revision.
 *
 * In a single read-write transaction over ['records', 'responses', 'drafts']:
 *   1. Reads record meta; throws WolfValidationError if missing or if
 *      `promptId` is not present in `meta.packSnapshot.prompts`. Rejects
 *      empty/whitespace `text`.
 *   2. Reads the current response row (if any) and appends a new revision.
 *   3. Writes the response row with a fresh `updatedAt`.
 *   4. Deletes the draft row for this prompt (a successful commit clears the
 *      matching draft, per DESIGN 8.2).
 *   5. Writes record meta with a fresh `updatedAt`.
 *
 * If any step throws, `db.transaction` aborts the IDBTransaction, leaving
 * the prior committed state intact (db.ts handles rollback).
 */
export async function commitResponseAtomic(
  db: WolfDb,
  recordId: string,
  promptId: string,
  text: string,
  source: CaptureSource,
  timestamp?: string,
): Promise<void> {
  if (text.trim().length === 0) {
    throw new WolfValidationError('Committed response text must not be empty or whitespace-only.');
  }

  await db.transaction(['records', 'responses', 'drafts'], 'readwrite', async (tx) => {
    const meta = await tx.get<StoredRecordMeta>('records', recordId);
    if (!meta) {
      throw new WolfValidationError(`Record "${recordId}" does not exist.`);
    }

    const promptExists = meta.packSnapshot.prompts.some((p) => p.id === promptId);
    if (!promptExists) {
      throw new WolfValidationError(`Prompt "${promptId}" is not present in the record's pack snapshot.`);
    }

    const capturedAt = timestamp ?? new Date().toISOString();

    const existingRow = await tx.get<StoredResponseRow>('responses', [recordId, promptId]);
    const priorRevision =
      existingRow && existingRow.revisions.length > 0 ? existingRow.revisions[existingRow.revisions.length - 1] : null;

    const newRevision: ResponseRevision = {
      revisionId: crypto.randomUUID(),
      text,
      capturedAt,
      source,
      locale: 'en-US',
      supersedesRevisionId: priorRevision ? priorRevision.revisionId : null,
    };

    const revisions = existingRow ? [...existingRow.revisions, newRevision] : [newRevision];

    const responseRow: StoredResponseRow = {
      recordId,
      promptId,
      revisions,
      updatedAt: capturedAt,
    };

    await tx.put('responses', responseRow);
    await tx.delete('drafts', [recordId, promptId]);

    const updatedMeta: StoredRecordMeta = { ...meta, updatedAt: capturedAt };
    await tx.put('records', updatedMeta);
  });
}
