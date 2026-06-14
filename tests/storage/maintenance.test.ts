import test from 'node:test';
import assert from 'node:assert/strict';

import { IDBFactory } from 'fake-indexeddb';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/schema.js';
import { createRecord } from '../../src/engine/record.js';
import type { CapturePack } from '../../src/engine/types.js';

import { openWolfDb, STORE_NAMES } from '../../src/storage/db.js';
import { saveRecord } from '../../src/storage/recordRepository.js';
import { saveDraft } from '../../src/storage/draftRepository.js';
import { clearAllData } from '../../src/storage/maintenance.js';

const pack: CapturePack = validatePack(genericPackJson);

const PROMPT_CONT_1 = 'continuity.safe-change';
const FIXED_NOW = '2024-01-15T10:00:00.000Z';

function freshFactory(): IDBFactory {
  return new IDBFactory();
}

async function seedDb(db: Awaited<ReturnType<typeof openWolfDb>>): Promise<void> {
  // Install a pack row.
  await db.put('packs', {
    packId: pack.packId,
    packVersion: pack.packVersion,
    digest: 'sha256-test-digest',
    trust: 'bundled',
    installedAt: FIXED_NOW,
    pack,
  });

  // Save a record (records + responses + drafts via saveRecord).
  const record = createRecord({
    recordId: 'rec-a',
    pack,
    packDigest: 'sha256-test-digest',
    appVersion: '0.0.0-test',
    now: FIXED_NOW,
  });
  record.responses = [
    {
      promptId: PROMPT_CONT_1,
      revisions: [
        {
          revisionId: 'r1',
          text: 'answer',
          capturedAt: FIXED_NOW,
          source: 'typed',
          locale: 'en-US',
          supersedesRevisionId: null,
        },
      ],
    },
  ];
  await saveRecord(db, record);

  // Save a draft for a different prompt.
  await saveDraft(db, 'rec-a', 'operations.normal-day', 'draft text', FIXED_NOW);

  // Settings + migrations rows so all six stores are populated.
  await db.put('settings', { key: 'theme', value: 'dark' });
  await db.put('migrations', { id: 'legacy-v1', completedAt: FIXED_NOW });
}

test('clearAllData empties every store after seeding', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    await seedDb(db);

    // Sanity check: every store has at least one row before clearing.
    for (const store of STORE_NAMES) {
      const rows = await db.getAll(store);
      assert.ok(rows.length > 0, `expected ${store} to be seeded`);
    }

    await clearAllData(db);

    for (const store of STORE_NAMES) {
      const rows = await db.getAll(store);
      assert.equal(rows.length, 0, `expected ${store} to be empty after clearAllData`);
    }
  } finally {
    db.close();
  }
});

test('clearAllData on an already-empty database is a no-op', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    await clearAllData(db);

    for (const store of STORE_NAMES) {
      const rows = await db.getAll(store);
      assert.equal(rows.length, 0, `expected ${store} to remain empty`);
    }

    // Calling it again should still not throw.
    await clearAllData(db);
  } finally {
    db.close();
  }
});
