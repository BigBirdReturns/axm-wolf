import test from 'node:test';
import assert from 'node:assert/strict';

import { IDBFactory } from 'fake-indexeddb';

import { openWolfDb } from '../../src/storage/db.js';
import { migrateLegacyAnswers } from '../../src/storage/legacyMigration.js';
import { validatePack } from '../../src/engine/schema.js';
import type { CapturePack } from '../../src/engine/types.js';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import realPackJson from '../../src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json' with { type: 'json' };
import realMigrationMap from '../../src/packs/wolfs-deposition/legacy-id-migration-map.json' with { type: 'json' };

const LEGACY_DB_NAME = 'TestLegacyDb';
const LEGACY_STORE_NAME = 'answers';

function freshFactory(): IDBFactory {
  return new IDBFactory();
}

function loadGenericPack(): CapturePack {
  return validatePack(genericPackJson);
}

/** Seeds a fake legacy db with the real legacy value shape: { qid, text, timestamp }. */
async function seedLegacyDb(factory: IDBFactory, answers: Array<{ qid: string; text: string; timestamp?: string }>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = factory.open(LEGACY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'qid' });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(LEGACY_STORE_NAME, 'readwrite');
      for (const a of answers) {
        tx.objectStore(LEGACY_STORE_NAME).put(a);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

const SYNTHETIC_MAP: Record<string, string> = {
  ops__0: 'operations.normal-day',
  ops__1: 'operations.hidden-dependency',
  ops__2: 'operations.first-alert',
};

test('full migration: n answers -> 1 record, n responses, source imported, timestamps preserved', async () => {
  const factory = freshFactory();
  const pack = loadGenericPack();

  await seedLegacyDb(factory, [
    { qid: 'ops__0', text: 'A normal day.', timestamp: '2020-01-01T00:00:00.000Z' },
    { qid: 'ops__1', text: 'Hidden dep.', timestamp: '2020-01-02T00:00:00.000Z' },
  ]);

  const db = await openWolfDb(factory);
  try {
    const summary = await migrateLegacyAnswers(db, factory, {
      legacyDbName: LEGACY_DB_NAME,
      legacyStoreName: LEGACY_STORE_NAME,
      migrationMap: SYNTHETIC_MAP,
      pack,
      packDigest: 'digest-1',
      recordId: 'rec-legacy',
      appVersion: '0.1.0-test',
    });

    assert.equal(summary.alreadyComplete, false);
    assert.equal(summary.migrated, 2);
    assert.equal(summary.skippedUnknown, 0);
    assert.equal(summary.recoveryReport.length, 0);

    const meta = await db.get<{ recordId: string }>('records', 'rec-legacy');
    assert.ok(meta !== undefined);

    const row0 = await db.get<{ revisions: Array<{ text: string; source: string; capturedAt: string }> }>('responses', [
      'rec-legacy',
      'operations.normal-day',
    ]);
    const row1 = await db.get<{ revisions: Array<{ text: string; source: string; capturedAt: string }> }>('responses', [
      'rec-legacy',
      'operations.hidden-dependency',
    ]);

    assert.ok(row0 !== undefined);
    assert.equal(row0.revisions.length, 1);
    assert.equal(row0.revisions[0].text, 'A normal day.');
    assert.equal(row0.revisions[0].source, 'imported');
    assert.equal(row0.revisions[0].capturedAt, '2020-01-01T00:00:00.000Z');

    assert.ok(row1 !== undefined);
    assert.equal(row1.revisions[0].capturedAt, '2020-01-02T00:00:00.000Z');
  } finally {
    db.close();
  }
});

test('unknown key -> recoveryReport entry, not discarded, excluded from migrated count', async () => {
  const factory = freshFactory();
  const pack = loadGenericPack();

  await seedLegacyDb(factory, [
    { qid: 'ops__0', text: 'A normal day.', timestamp: '2020-01-01T00:00:00.000Z' },
    { qid: 'unknown__99', text: 'Mystery answer.', timestamp: '2020-01-03T00:00:00.000Z' },
  ]);

  const db = await openWolfDb(factory);
  try {
    const summary = await migrateLegacyAnswers(db, factory, {
      legacyDbName: LEGACY_DB_NAME,
      legacyStoreName: LEGACY_STORE_NAME,
      migrationMap: SYNTHETIC_MAP,
      pack,
      packDigest: 'digest-1',
      recordId: 'rec-legacy',
      appVersion: '0.1.0-test',
    });

    assert.equal(summary.migrated, 1);
    assert.equal(summary.skippedUnknown, 1);
    assert.equal(summary.recoveryReport.length, 1);
    assert.equal(summary.recoveryReport[0].legacyKey, 'unknown__99');
    assert.equal(summary.recoveryReport[0].text, 'Mystery answer.');
    assert.equal(summary.recoveryReport[0].savedAt, '2020-01-03T00:00:00.000Z');
  } finally {
    db.close();
  }
});

test('idempotence: second run returns alreadyComplete and does not duplicate responses', async () => {
  const factory = freshFactory();
  const pack = loadGenericPack();

  await seedLegacyDb(factory, [{ qid: 'ops__0', text: 'A normal day.', timestamp: '2020-01-01T00:00:00.000Z' }]);

  const db = await openWolfDb(factory);
  try {
    const config = {
      legacyDbName: LEGACY_DB_NAME,
      legacyStoreName: LEGACY_STORE_NAME,
      migrationMap: SYNTHETIC_MAP,
      pack,
      packDigest: 'digest-1',
      recordId: 'rec-legacy',
      appVersion: '0.1.0-test',
    };

    const first = await migrateLegacyAnswers(db, factory, config);
    assert.equal(first.alreadyComplete, false);
    assert.equal(first.migrated, 1);

    const second = await migrateLegacyAnswers(db, factory, config);
    assert.equal(second.alreadyComplete, true);
    assert.equal(second.migrated, 0);
    assert.equal(second.skippedUnknown, 0);
    assert.equal(second.recoveryReport.length, 0);

    const row = await db.get<{ revisions: unknown[] }>('responses', ['rec-legacy', 'operations.normal-day']);
    assert.ok(row !== undefined);
    assert.equal(row.revisions.length, 1);
  } finally {
    db.close();
  }
});

test('missing legacy db -> 0 migrated, marked complete, detection does not create the legacy db', async () => {
  const factory = freshFactory();
  const pack = loadGenericPack();

  const db = await openWolfDb(factory);
  try {
    const summary = await migrateLegacyAnswers(db, factory, {
      legacyDbName: 'NoSuchLegacyDb',
      legacyStoreName: LEGACY_STORE_NAME,
      migrationMap: SYNTHETIC_MAP,
      pack,
      packDigest: 'digest-1',
      recordId: 'rec-legacy',
      appVersion: '0.1.0-test',
    });

    assert.equal(summary.alreadyComplete, false);
    assert.equal(summary.migrated, 0);
    assert.equal(summary.skippedUnknown, 0);

    const migrationRow = await db.get<{ id: string }>('migrations', 'legacy-NoSuchLegacyDb');
    assert.ok(migrationRow !== undefined);

    // Detection must not have created the legacy database.
    if (typeof factory.databases === 'function') {
      const dbs = await factory.databases();
      assert.ok(!dbs.some((info) => info.name === 'NoSuchLegacyDb'));
    }
  } finally {
    db.close();
  }
});

test('legacy db is not deleted after migration', async () => {
  const factory = freshFactory();
  const pack = loadGenericPack();

  await seedLegacyDb(factory, [{ qid: 'ops__0', text: 'A normal day.', timestamp: '2020-01-01T00:00:00.000Z' }]);

  const db = await openWolfDb(factory);
  try {
    await migrateLegacyAnswers(db, factory, {
      legacyDbName: LEGACY_DB_NAME,
      legacyStoreName: LEGACY_STORE_NAME,
      migrationMap: SYNTHETIC_MAP,
      pack,
      packDigest: 'digest-1',
      recordId: 'rec-legacy',
      appVersion: '0.1.0-test',
    });

    if (typeof factory.databases === 'function') {
      const dbs = await factory.databases();
      assert.ok(dbs.some((info) => info.name === LEGACY_DB_NAME));
    }
  } finally {
    db.close();
  }
});

test('real checked-in migration map: every value is a prompt id in the real pack, every key matches qid pattern', async () => {
  const mapRaw = realMigrationMap as Record<string, string>;

  const pack = validatePack(realPackJson);

  const promptIds = new Set(pack.prompts.map((p) => p.id));

  for (const [key, value] of Object.entries(mapRaw)) {
    assert.match(key, /^[a-z_-]+__\d+$/);
    assert.ok(promptIds.has(value), `migration map value "${value}" (for key "${key}") must be a real prompt id`);
  }
});
