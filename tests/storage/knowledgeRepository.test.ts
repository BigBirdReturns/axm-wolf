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
  listKnowledgeDropReviewEvents,
  listKnowledgeDrops,
  loadKnowledgeDrop,
  openWolfDb,
  saveRecord,
} from '../../src/storage/index.js';

const SOURCE = 'I walk the site before I trust the dashboard, and I photograph mismatches.';
const PROMPT_ID = 'operations.normal-day';
const CREATED_AT = '2026-07-13T18:00:00.000Z';
const pack = validatePack(genericPackJson);

function recordWithSource(recordId = 'survey-lotus-july', source = SOURCE): WolfRecord {
  const record = createRecord({ recordId, pack, packDigest: 'test-pack-digest', appVersion: 'test', now: CREATED_AT });
  record.responses = [{ promptId: PROMPT_ID, revisions: [{ revisionId: 'revision-lotus-1', text: source, capturedAt: CREATED_AT, source: 'typed', locale: 'en-US', supersedesRevisionId: null }] }];
  return record;
}

test('repository creates only from a stored revision and returns the same immutable identity idempotently', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    await saveRecord(db, recordWithSource());
    const input = { recordId: 'survey-lotus-july', promptId: PROMPT_ID, revisionId: 'revision-lotus-1', kind: 'decision_rule' as const, startOffset: 0, endOffset: SOURCE.indexOf(','), createdAt: CREATED_AT };
    const created = await createDropFromStoredRevision(db, input);
    const repeated = await createDropFromStoredRevision(db, input);

    assert.equal(created.dropId, repeated.dropId);
    assert.equal(created.visibility, 'private');
    assert.equal(created.reviewStatus, 'pending');
    assert.equal(created.source.exactQuote, 'I walk the site before I trust the dashboard');
    assert.equal((await listKnowledgeDrops(db, { recordId: 'survey-lotus-july' })).length, 1);
    assert.deepEqual(await loadKnowledgeDrop(db, created.dropId), created);
  } finally {
    db.close();
  }
});

test('source-bound creation rejects missing records, prompts, revisions, and invalid spans', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    const base = { recordId: 'survey-lotus-july', promptId: PROMPT_ID, revisionId: 'revision-lotus-1', kind: 'constraint' as const, startOffset: 0, endOffset: 4 };
    await assert.rejects(createDropFromStoredRevision(db, base), /source record was not found/);
    await saveRecord(db, recordWithSource());
    await assert.rejects(createDropFromStoredRevision(db, { ...base, promptId: 'not-in-pack' }), /source prompt is not part/);
    await assert.rejects(createDropFromStoredRevision(db, { ...base, revisionId: 'missing' }), /source revision was not found/);
    await assert.rejects(createDropFromStoredRevision(db, { ...base, endOffset: SOURCE.length + 1 }), /Invalid knowledge drop source span/);
  } finally {
    db.close();
  }
});

test('UTF-16 offsets preserve an emoji source span exactly', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    const source = 'Door 🚪 jams unless the lower hinge is lifted.';
    await saveRecord(db, recordWithSource('emoji-record', source));
    const startOffset = source.indexOf('🚪');
    const created = await createDropFromStoredRevision(db, { recordId: 'emoji-record', promptId: PROMPT_ID, revisionId: 'revision-lotus-1', kind: 'symptom', startOffset, endOffset: startOffset + 2 });
    assert.equal(created.source.exactQuote, '🚪');
    assert.equal(created.source.offsetEncoding, 'utf16-code-unit');
  } finally {
    db.close();
  }
});

test('a non-identical row using the deterministic ID is rejected as a collision', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    await saveRecord(db, recordWithSource());
    const input = { recordId: 'survey-lotus-july', promptId: PROMPT_ID, revisionId: 'revision-lotus-1', kind: 'decision_rule' as const, startOffset: 0, endOffset: 8 };
    const created = await createDropFromStoredRevision(db, input);
    await db.put('knowledgeDrops', { ...created, kind: 'constraint' });
    await assert.rejects(createDropFromStoredRevision(db, input), /ID collision/);
  } finally {
    db.close();
  }
});

test('reviews use optimistic concurrency, append-only events, and request idempotency', async () => {
  const db = await openWolfDb(new IDBFactory());
  try {
    await saveRecord(db, recordWithSource());
    const drop = await createDropFromStoredRevision(db, { recordId: 'survey-lotus-july', promptId: PROMPT_ID, revisionId: 'revision-lotus-1', kind: 'decision_rule', startOffset: 0, endOffset: 8 });
    const request = { dropId: drop.dropId, expectedPriorVersion: 1, requestId: 'review-lotus-1', review: { action: 'correct' as const, actor: 'Lotus', text: 'Physically check the site before trusting the dashboard.', kind: 'unwritten_rule' as const, at: '2026-07-13T18:10:00.000Z' } };
    const applied = await appendKnowledgeDropReview(db, request);
    const repeated = await appendKnowledgeDropReview(db, request);

    assert.equal(applied.idempotent, false);
    assert.equal(repeated.idempotent, true);
    assert.equal(applied.drop.reviewStatus, 'corrected');
    assert.equal(applied.drop.visibility, 'private');
    assert.equal(applied.drop.version, 2);
    assert.equal((await listKnowledgeDropReviewEvents(db, drop.dropId)).length, 1);
    await assert.rejects(appendKnowledgeDropReview(db, { ...request, requestId: 'review-lotus-2' }), /version conflict/);
    await assert.rejects(appendKnowledgeDropReview(db, { ...request, review: { action: 'confirm', actor: 'Lotus' } }), /reused with different content/);
  } finally {
    db.close();
  }
});
