// Draft repository (DESIGN.md 8.1, 8.2): autosaved draft text per prompt.
//
// Drafts are stored independently of responses. Saving a draft never marks a
// prompt answered and never touches record meta or the responses store --
// only a successful `commitResponseAtomic` (recordRepository.ts) clears a
// draft, atomically, in the same transaction as the commit.

import type { WolfDb } from './db.js';
import type { StoredDraftRow } from './recordRepository.js';

/**
 * Upserts the draft row for `(recordId, promptId)`. Does not touch record
 * meta or responses.
 */
export async function saveDraft(
  db: WolfDb,
  recordId: string,
  promptId: string,
  text: string,
  updatedAt?: string,
): Promise<void> {
  const row: StoredDraftRow = {
    recordId,
    promptId,
    text,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
  await db.put('drafts', row);
}

/**
 * Returns the current draft for `(recordId, promptId)`, or null if none
 * exists.
 */
export async function getDraft(
  db: WolfDb,
  recordId: string,
  promptId: string,
): Promise<{ text: string; updatedAt: string } | null> {
  const row = await db.get<StoredDraftRow>('drafts', [recordId, promptId]);
  if (!row) {
    return null;
  }
  return { text: row.text, updatedAt: row.updatedAt };
}

/** Deletes the draft row for `(recordId, promptId)`, if any. */
export async function deleteDraft(db: WolfDb, recordId: string, promptId: string): Promise<void> {
  await db.delete('drafts', [recordId, promptId]);
}

/** Lists all drafts for `recordId`, sorted by `promptId`. */
export async function listDrafts(
  db: WolfDb,
  recordId: string,
): Promise<Array<{ promptId: string; text: string; updatedAt: string }>> {
  const all = await db.getAll<StoredDraftRow>('drafts');
  return all
    .filter((d) => d.recordId === recordId)
    .map((d) => ({ promptId: d.promptId, text: d.text, updatedAt: d.updatedAt }))
    .sort((a, b) => a.promptId.localeCompare(b.promptId));
}
