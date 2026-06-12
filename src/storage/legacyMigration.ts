// Legacy database migration (DESIGN.md 8.4, 3.3).
//
// Migrates answers from a legacy IndexedDB database/store (e.g. the v0 app's
// 'WolfsDeposition' / 'answers' store, keyPath 'qid', values shaped
// `{ qid, text, timestamp }`) into one WolfRecord stored via the normalized
// 'records' / 'responses' stores, marking completion atomically in the
// 'migrations' store.
//
// This module is pack-agnostic: all first-pack specifics (legacy db/store
// names, the migration map, the pack itself) arrive via `LegacyMigrationConfig`.

import type { WolfDb, StoreName } from './db.js';
import type { CapturePack, SubjectMetadata, WolfRecord, PromptResponse } from '../engine/types.js';
import { createRecord, commitResponse } from '../engine/record.js';
import type { StoredRecordMeta, StoredResponseRow } from './recordRepository.js';

export type LegacyMigrationConfig = {
  legacyDbName: string;
  legacyStoreName: string;
  migrationMap: Record<string, string>;
  pack: CapturePack;
  packDigest: string;
  recordId: string;
  appVersion: string;
  subject?: SubjectMetadata;
};

export type LegacyMigrationSummary = {
  migrated: number;
  skippedUnknown: number;
  recoveryReport: Array<{ legacyKey: string; text: string; savedAt: string | null }>;
  alreadyComplete: boolean;
};

/** The legacy 'answers' store row shape (keyPath: 'qid'). */
type LegacyAnswer = {
  qid: string;
  text: string;
  timestamp?: string;
};

function migrationRecordId(legacyDbName: string): string {
  return 'legacy-' + legacyDbName;
}

/**
 * Reads all rows from the legacy db's answers store, or returns `null` if the
 * legacy database does not exist (detected via `factory.databases()` without
 * opening/creating it, when available).
 */
async function readLegacyAnswers(
  factory: IDBFactory,
  legacyDbName: string,
  legacyStoreName: string,
): Promise<LegacyAnswer[] | null> {
  if (typeof factory.databases === 'function') {
    const dbs = await factory.databases();
    const exists = dbs.some((info) => info.name === legacyDbName);
    if (!exists) {
      return null;
    }
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(legacyDbName);
    request.onupgradeneeded = () => {
      // The legacy database did not actually exist (or lacks the store);
      // opening it here would create it. Treat as "nothing to migrate" by
      // aborting the version-change transaction so nothing is persisted.
      const tx = request.transaction;
      if (tx) {
        tx.abort();
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(legacyStoreName)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction(legacyStoreName, 'readonly');
      const store = tx.objectStore(legacyStoreName);
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        db.close();
        resolve((getAllReq.result ?? []) as LegacyAnswer[]);
      };
      getAllReq.onerror = () => {
        db.close();
        reject(getAllReq.error ?? new Error('Failed to read legacy answers store'));
      };
    };
    request.onerror = () => {
      // Aborted upgrade (db didn't previously exist) surfaces as an error;
      // treat that as "nothing to migrate".
      resolve(null);
    };
  });
}

export async function migrateLegacyAnswers(
  db: WolfDb,
  factory: IDBFactory,
  config: LegacyMigrationConfig,
): Promise<LegacyMigrationSummary> {
  const migrationId = migrationRecordId(config.legacyDbName);

  // 1. Idempotence first.
  const existing = await db.get<{ id: string }>('migrations', migrationId);
  if (existing) {
    return { alreadyComplete: true, migrated: 0, skippedUnknown: 0, recoveryReport: [] };
  }

  // 2 & 3. Detect + read the legacy database without creating it.
  const legacyAnswers = await readLegacyAnswers(factory, config.legacyDbName, config.legacyStoreName);

  const completedAt = new Date().toISOString();

  if (legacyAnswers === null || legacyAnswers.length === 0) {
    await db.transaction(['migrations'] as StoreName[], 'readwrite', async (tx) => {
      await tx.put('migrations', { id: migrationId, completedAt, migrated: 0, skippedUnknown: 0 });
    });
    return { alreadyComplete: false, migrated: 0, skippedUnknown: 0, recoveryReport: [] };
  }

  // 4. Build one WolfRecord, converting each mapped, non-empty answer.
  let record: WolfRecord = createRecord({
    recordId: config.recordId,
    pack: config.pack,
    packDigest: config.packDigest,
    appVersion: config.appVersion,
    subject: config.subject,
  });

  let migrated = 0;
  let skippedUnknown = 0;
  const recoveryReport: LegacyMigrationSummary['recoveryReport'] = [];

  for (const answer of legacyAnswers) {
    const text = (answer.text ?? '').trim();
    const promptId = config.migrationMap[answer.qid];

    if (promptId === undefined) {
      recoveryReport.push({
        legacyKey: answer.qid,
        text: answer.text ?? '',
        savedAt: answer.timestamp ?? null,
      });
      skippedUnknown += 1;
      continue;
    }

    if (text.length === 0) {
      // Empty-text answers are skipped silently: neither migrated nor unknown.
      continue;
    }

    const capturedAt = answer.timestamp ?? completedAt;
    record = commitResponse(record, promptId, text, 'imported', capturedAt);
    migrated += 1;
  }

  // 5. Persist record meta + response rows + migration completion atomically.
  const { responses, drafts, ...meta } = record;
  void drafts;

  await db.transaction(['records', 'responses', 'migrations'] as StoreName[], 'readwrite', async (tx) => {
    await tx.put('records', meta as StoredRecordMeta);

    for (const response of responses as PromptResponse[]) {
      const updatedAt = response.revisions[response.revisions.length - 1]?.capturedAt ?? record.updatedAt;
      const row: StoredResponseRow = {
        recordId: record.recordId,
        promptId: response.promptId,
        revisions: response.revisions,
        updatedAt,
      };
      await tx.put('responses', row);
    }

    await tx.put('migrations', { id: migrationId, completedAt, migrated, skippedUnknown });
  });

  return { alreadyComplete: false, migrated, skippedUnknown, recoveryReport };
}
