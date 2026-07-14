import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { createRecord } from '../../src/engine/record.js';
import { validatePack } from '../../src/engine/schema.js';
import type { WolfRecord } from '../../src/engine/types.js';
import {
  appendKnowledgeDropReview,
  createDropFromStoredRevision,
  exportKnowledgeArchive,
  importKnowledgeArchive,
  openWolfDb,
  parseKnowledgeArchive,
  saveRecord,
} from '../../src/storage/index.js';

const pack = validatePack(genericPackJson);
const SOURCE = 'When the vendor misses Tuesday, use the local supplier and photograph the lot number.';
const NOW = '2026-07-13T20:00:00.000Z';
const PROMPT = 'operations.normal-day';

function sourceRecord(): WolfRecord {
  const record = createRecord({ recordId: 'archive-record', pack, packDigest: 'archive-pack', appVersion: 'test', now: NOW });
  record.responses = [{ promptId: PROMPT, revisions: [{ revisionId: 'archive-revision', text: SOURCE, capturedAt: NOW, source: 'typed', locale: 'en-US', supersedesRevisionId: null }] }];
  return record;
}

test('knowledge custody archive round-trips only after its source record is restored', async () => {
  const sourceDb = await openWolfDb(new IDBFactory());
  const targetDb = await openWolfDb(new IDBFactory());
  try {
    await saveRecord(sourceDb, sourceRecord());
    const drop = await createDropFromStoredRevision(sourceDb, { recordId: 'archive-record', promptId: PROMPT, revisionId: 'archive-revision', kind: 'workaround', startOffset: SOURCE.indexOf('use the local'), endOffset: SOURCE.length - 1, createdAt: NOW });
    await appendKnowledgeDropReview(sourceDb, { dropId: drop.dropId, expectedPriorVersion: 1, requestId: 'archive-review', review: { action: 'confirm', actor: 'Lotus', at: NOW } });
    const archive = await exportKnowledgeArchive(sourceDb, NOW);

    await assert.rejects(importKnowledgeArchive(targetDb, archive), /was not restored first/);
    await saveRecord(targetDb, sourceRecord());
    const restored = await importKnowledgeArchive(targetDb, JSON.stringify(archive));
    assert.equal(restored.drops.length, 1);
    assert.equal((await targetDb.getAll('knowledgeDrops')).length, 1);
    assert.equal((await targetDb.getAll('knowledgeDropEvents')).length, 1);
    await assert.rejects(importKnowledgeArchive(targetDb, archive), /requires an empty knowledge store/);
  } finally {
    sourceDb.close();
    targetDb.close();
  }
});

test('knowledge archive parsing rejects unknown fields and tampering', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    await saveRecord(db, sourceRecord());
    await createDropFromStoredRevision(db, { recordId: 'archive-record', promptId: PROMPT, revisionId: 'archive-revision', kind: 'constraint', startOffset: 0, endOffset: 7, createdAt: NOW });
    const archive = await exportKnowledgeArchive(db, NOW);
    await assert.rejects(parseKnowledgeArchive({ ...archive, unexpected: true }), /unsupported fields/);
    const tampered = structuredClone(archive);
    tampered.drops[0]!.text = 'changed after export';
    await assert.rejects(parseKnowledgeArchive(tampered), /archive digest mismatch/);
  } finally {
    db.close();
  }
});
