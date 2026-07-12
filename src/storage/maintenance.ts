// Maintenance operations (DESIGN.md 12.4): wipe-all "delete all local data".
//
// clearAllData empties every object store in a single read-write transaction
// spanning STORE_NAMES. WolfTx (db.ts) does not expose a `clear` primitive,
// so each store is emptied by reading all rows with getAll and deleting them
// one at a time by key, within the same transaction. For single-keyPath
// stores the key is read from the corresponding row field; for composite-key
// stores ('responses', 'drafts', keyPath ['recordId', 'promptId']) the key is
// the [recordId, promptId] tuple read off each row.
//
// The whole operation runs inside one IDBTransaction (db.transaction), so it
// is atomic: if any delete throws, the transaction aborts and none of the
// stores are modified (db.ts's WolfDb.transaction rolls back on rejection).
//
// This deliberately does NOT delete the underlying IndexedDB database (no
// `indexedDB.deleteDatabase`): the app holds an open connection to it, and
// deleting a database with open connections either blocks or requires
// closing/reopening the connection, which is more failure-prone than simply
// clearing every store while the connection stays open.

import { STORE_NAMES, type StoreName, type WolfDb } from './db.js';

const SINGLE_KEY_FIELD: Partial<Record<StoreName, string>> = {
  packs: 'packId',
  records: 'recordId',
  settings: 'key',
  migrations: 'id',
  opsCases: 'caseId',
  opsAssets: 'assetId',
  opsObservations: 'observationId',
  opsEvidence: 'artifactId',
};

/**
 * Empties every object store in one atomic read-write transaction. Safe to
 * call on an already-empty database (no-op).
 */
export async function clearAllData(db: WolfDb): Promise<void> {
  await db.transaction(STORE_NAMES, 'readwrite', async (tx) => {
    for (const storeName of STORE_NAMES) {
      const rows = await tx.getAll<Record<string, unknown>>(storeName);
      for (const row of rows) {
        const key = rowKey(storeName, row);
        await tx.delete(storeName, key);
      }
    }
  });
}

function rowKey(storeName: StoreName, row: Record<string, unknown>): IDBValidKey | IDBValidKey[] {
  if (storeName === 'responses' || storeName === 'drafts') {
    return [row.recordId as string, row.promptId as string];
  }
  const field = SINGLE_KEY_FIELD[storeName];
  if (!field) throw new Error(`No wipe-all key mapping for store ${storeName}`);
  return row[field] as IDBValidKey;
}
