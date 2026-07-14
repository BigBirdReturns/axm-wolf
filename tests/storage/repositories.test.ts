import test from 'node:test';
import assert from 'node:assert/strict';

import { IDBFactory } from 'fake-indexeddb';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/schema.js';
import { createRecord } from '../../src/engine/record.js';
import { WolfValidationError } from '../../src/engine/errors.js';
import type { CapturePack, WolfRecord } from '../../src/engine/types.js';

import { openWolfDb } from '../../src/storage/db.js';
import { saveRecord, loadRecord, listRecords, deleteRecord, commitResponseAtomic } from '../../src/storage/recordRepository.js';
import { appendKnowledgeDropReview, createDropFromStoredRevision } from '../../src/storage/knowledgeRepository.js';
import { saveDraft, getDraft, deleteDraft, listDrafts } from '../../src/storage/draftRepository.js';

const pack: CapturePack = validatePack(genericPackJson);

const PROMPT_OPS_1 = 'operations.normal-day';
const PROMPT_OPS_2 = 'operations.hidden-dependency';
const PROMPT_CONT_1 = 'continuity.safe-change';
const FIXED_NOW = '2024-01-15T10:00:00.000Z';

function freshFactory(): IDBFactory {
  return new IDBFactory();
}

function buildRecord(recordId: string, now = FIXED_NOW): WolfRecord {
  return createRecord({
    recordId,
    pack,
    packDigest: 'sha256-test-digest',
    appVersion: '0.0.0-test',
    now,
  });
}

/** Returns a copy of `record` with responses/drafts sorted by promptId, matching loadRecord's ordering. */
function sortedCopy(record: WolfRecord): WolfRecord {
  return {
    ...record,
    responses: [...record.responses].sort((a, b) => a.promptId.localeCompare(b.promptId)),
    drafts: [...record.drafts].sort((a, b) => a.promptId.localeCompare(b.promptId)),
  };
}

test('saveRecord -> loadRecord round-trip equals original (sorted copy)', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const record = buildRecord('rec-a');
    // Give the record some responses and drafts directly (bypassing engine
    // helpers) so the round-trip exercises both stores.
    record.responses = [
      { promptId: PROMPT_OPS_2, revisions: [{ revisionId: 'r1', text: 'a', capturedAt: FIXED_NOW, source: 'typed', locale: 'en-US', supersedesRevisionId: null }] },
      { promptId: PROMPT_OPS_1, revisions: [{ revisionId: 'r2', text: 'b', capturedAt: FIXED_NOW, source: 'typed', locale: 'en-US', supersedesRevisionId: null }] },
    ];
    record.drafts = [
      { promptId: PROMPT_CONT_1, text: 'draft text', updatedAt: FIXED_NOW },
    ];

    await saveRecord(db, record);
    const loaded = await loadRecord(db, 'rec-a');

    assert.ok(loaded !== null);
    assert.equal(JSON.stringify(loaded), JSON.stringify(sortedCopy(record)));
  } finally {
    db.close();
  }
});

test('loadRecord returns null for unknown id', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const loaded = await loadRecord(db, 'does-not-exist');
    assert.equal(loaded, null);
  } finally {
    db.close();
  }
});

test('two records do not leak rows into each other', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const recordA = buildRecord('rec-a');
    recordA.responses = [
      { promptId: PROMPT_OPS_1, revisions: [{ revisionId: 'ra1', text: 'a-text', capturedAt: FIXED_NOW, source: 'typed', locale: 'en-US', supersedesRevisionId: null }] },
    ];
    recordA.drafts = [{ promptId: PROMPT_OPS_2, text: 'a-draft', updatedAt: FIXED_NOW }];

    const recordB = buildRecord('rec-b');
    recordB.responses = [
      { promptId: PROMPT_CONT_1, revisions: [{ revisionId: 'rb1', text: 'b-text', capturedAt: FIXED_NOW, source: 'typed', locale: 'en-US', supersedesRevisionId: null }] },
    ];
    recordB.drafts = [{ promptId: PROMPT_OPS_1, text: 'b-draft', updatedAt: FIXED_NOW }];

    await saveRecord(db, recordA);
    await saveRecord(db, recordB);

    const loadedA = await loadRecord(db, 'rec-a');
    const loadedB = await loadRecord(db, 'rec-b');

    assert.ok(loadedA !== null);
    assert.ok(loadedB !== null);

    assert.equal(loadedA!.responses.length, 1);
    assert.equal(loadedA!.drafts.length, 1);
    assert.equal(loadedA!.responses[0].promptId, PROMPT_OPS_1);
    assert.equal(loadedA!.drafts[0].promptId, PROMPT_OPS_2);

    assert.equal(loadedB!.responses.length, 1);
    assert.equal(loadedB!.drafts.length, 1);
    assert.equal(loadedB!.responses[0].promptId, PROMPT_CONT_1);
    assert.equal(loadedB!.drafts[0].promptId, PROMPT_OPS_1);
  } finally {
    db.close();
  }
});

test('listRecords sorted by updatedAt desc', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const recordA = buildRecord('rec-a', '2024-01-01T00:00:00.000Z');
    const recordB = buildRecord('rec-b', '2024-03-01T00:00:00.000Z');
    const recordC = buildRecord('rec-c', '2024-02-01T00:00:00.000Z');

    await saveRecord(db, recordA);
    await saveRecord(db, recordB);
    await saveRecord(db, recordC);

    const list = await listRecords(db);
    assert.equal(list.map((r) => r.recordId).join(','), 'rec-b,rec-c,rec-a');
    assert.equal(list[0].title, recordB.title);
    assert.equal(list[0].status, 'active');
    assert.equal(list[0].packId, recordB.packId);
  } finally {
    db.close();
  }
});

test('commitResponseAtomic: first commit creates a revision, second appends with supersedes chain, record updatedAt bumped', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const record = buildRecord('rec-a');
    await saveRecord(db, record);

    await commitResponseAtomic(db, 'rec-a', PROMPT_OPS_1, 'first answer', 'typed', '2024-01-15T11:00:00.000Z');

    let loaded = await loadRecord(db, 'rec-a');
    assert.ok(loaded !== null);
    let resp = loaded!.responses.find((r) => r.promptId === PROMPT_OPS_1);
    assert.ok(resp !== undefined);
    assert.equal(resp!.revisions.length, 1);
    assert.equal(resp!.revisions[0].text, 'first answer');
    assert.equal(resp!.revisions[0].supersedesRevisionId, null);
    assert.equal(loaded!.updatedAt, '2024-01-15T11:00:00.000Z');

    const firstRevisionId = resp!.revisions[0].revisionId;

    await commitResponseAtomic(db, 'rec-a', PROMPT_OPS_1, 'second answer', 'typed', '2024-01-15T12:00:00.000Z');

    loaded = await loadRecord(db, 'rec-a');
    resp = loaded!.responses.find((r) => r.promptId === PROMPT_OPS_1);
    assert.ok(resp !== undefined);
    assert.equal(resp!.revisions.length, 2);
    assert.equal(resp!.revisions[1].text, 'second answer');
    assert.equal(resp!.revisions[1].supersedesRevisionId, firstRevisionId);
    assert.equal(loaded!.updatedAt, '2024-01-15T12:00:00.000Z');
  } finally {
    db.close();
  }
});

test('commitResponseAtomic clears a pre-existing draft for that prompt in the same tx', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const record = buildRecord('rec-a');
    await saveRecord(db, record);

    await saveDraft(db, 'rec-a', PROMPT_OPS_1, 'draft in progress', '2024-01-15T10:30:00.000Z');
    assert.ok((await getDraft(db, 'rec-a', PROMPT_OPS_1)) !== null);

    await commitResponseAtomic(db, 'rec-a', PROMPT_OPS_1, 'committed answer', 'typed', '2024-01-15T11:00:00.000Z');

    assert.equal(await getDraft(db, 'rec-a', PROMPT_OPS_1), null);
  } finally {
    db.close();
  }
});

test('commitResponseAtomic to an unknown promptId throws and leaves prior state intact', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const record = buildRecord('rec-a');
    await saveRecord(db, record);

    // Establish prior committed state: one revision + a draft on a different prompt.
    await commitResponseAtomic(db, 'rec-a', PROMPT_OPS_1, 'prior answer', 'typed', '2024-01-15T11:00:00.000Z');
    await saveDraft(db, 'rec-a', PROMPT_OPS_2, 'untouched draft', '2024-01-15T10:30:00.000Z');

    const before = await loadRecord(db, 'rec-a');

    let caught: unknown;
    try {
      await commitResponseAtomic(db, 'rec-a', 'no-such-prompt', 'irrelevant text', 'typed', '2024-01-15T12:00:00.000Z');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof WolfValidationError);

    const after = await loadRecord(db, 'rec-a');
    assert.equal(JSON.stringify(after), JSON.stringify(before));

    const draft = await getDraft(db, 'rec-a', PROMPT_OPS_2);
    assert.ok(draft !== null);
    assert.equal(draft!.text, 'untouched draft');
  } finally {
    db.close();
  }
});

test('commitResponseAtomic rejects empty/whitespace text with WolfValidationError', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const record = buildRecord('rec-a');
    await saveRecord(db, record);

    let caught: unknown;
    try {
      await commitResponseAtomic(db, 'rec-a', PROMPT_OPS_1, '   ', 'typed', '2024-01-15T11:00:00.000Z');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof WolfValidationError);

    const loaded = await loadRecord(db, 'rec-a');
    assert.equal(loaded!.responses.length, 0);
  } finally {
    db.close();
  }
});

test('deleteRecord removes source-linked knowledge residue while other records remain untouched', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const recordA = buildRecord('rec-a');
    const recordB = buildRecord('rec-b');
    await saveRecord(db, recordA);
    await saveRecord(db, recordB);

    await commitResponseAtomic(db, 'rec-a', PROMPT_OPS_1, 'answer a', 'typed', '2024-01-15T11:00:00.000Z');
    await commitResponseAtomic(db, 'rec-b', PROMPT_OPS_1, 'answer b', 'typed', '2024-01-15T11:00:00.000Z');
    await saveDraft(db, 'rec-a', PROMPT_OPS_2, 'draft a', '2024-01-15T10:30:00.000Z');
    await saveDraft(db, 'rec-b', PROMPT_OPS_2, 'draft b', '2024-01-15T10:30:00.000Z');
    const dropA = await createDropFromStoredRevision(db, { recordId: 'rec-a', promptId: PROMPT_OPS_1, revisionId: (await loadRecord(db, 'rec-a'))!.responses[0]!.revisions[0]!.revisionId, kind: 'unwritten_rule', startOffset: 0, endOffset: 6 });
    const dropB = await createDropFromStoredRevision(db, { recordId: 'rec-b', promptId: PROMPT_OPS_1, revisionId: (await loadRecord(db, 'rec-b'))!.responses[0]!.revisions[0]!.revisionId, kind: 'unwritten_rule', startOffset: 0, endOffset: 6 });
    await appendKnowledgeDropReview(db, { dropId: dropA.dropId, expectedPriorVersion: 1, requestId: 'review-rec-a', review: { action: 'confirm', actor: 'owner' } });
    await appendKnowledgeDropReview(db, { dropId: dropB.dropId, expectedPriorVersion: 1, requestId: 'review-rec-b', review: { action: 'confirm', actor: 'owner' } });

    await deleteRecord(db, 'rec-a');

    assert.equal(await loadRecord(db, 'rec-a'), null);
    assert.equal(await db.get('knowledgeDrops', dropA.dropId), undefined);
    assert.equal((await db.getAll<{ dropId: string }>('knowledgeDropEvents')).some((event) => event.dropId === dropA.dropId), false);
    assert.ok(await db.get('knowledgeDrops', dropB.dropId));
    assert.equal((await db.getAll<{ dropId: string }>('knowledgeDropEvents')).some((event) => event.dropId === dropB.dropId), true);

    const loadedB = await loadRecord(db, 'rec-b');
    assert.ok(loadedB !== null);
    assert.equal(loadedB!.responses.length, 1);
    assert.equal(loadedB!.drafts.length, 1);
    assert.equal(loadedB!.responses[0].promptId, PROMPT_OPS_1);
    assert.equal(loadedB!.drafts[0].promptId, PROMPT_OPS_2);
  } finally {
    db.close();
  }
});

test('draftRepository: save/get/delete/list, and a draft alone never creates a response row', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const record = buildRecord('rec-a');
    await saveRecord(db, record);

    assert.equal(await getDraft(db, 'rec-a', PROMPT_OPS_1), null);

    await saveDraft(db, 'rec-a', PROMPT_OPS_1, 'first draft', '2024-01-15T10:30:00.000Z');
    let draft = await getDraft(db, 'rec-a', PROMPT_OPS_1);
    assert.ok(draft !== null);
    assert.equal(draft!.text, 'first draft');
    assert.equal(draft!.updatedAt, '2024-01-15T10:30:00.000Z');

    // Upsert
    await saveDraft(db, 'rec-a', PROMPT_OPS_1, 'updated draft', '2024-01-15T10:45:00.000Z');
    draft = await getDraft(db, 'rec-a', PROMPT_OPS_1);
    assert.equal(draft!.text, 'updated draft');
    assert.equal(draft!.updatedAt, '2024-01-15T10:45:00.000Z');

    await saveDraft(db, 'rec-a', PROMPT_OPS_2, 'second draft', '2024-01-15T10:50:00.000Z');

    const list = await listDrafts(db, 'rec-a');
    assert.equal(list.length, 2);
    assert.equal(list.map((d) => d.promptId).join(','), [PROMPT_OPS_1, PROMPT_OPS_2].sort().join(','));

    await deleteDraft(db, 'rec-a', PROMPT_OPS_1);
    assert.equal(await getDraft(db, 'rec-a', PROMPT_OPS_1), null);
    assert.equal((await listDrafts(db, 'rec-a')).length, 1);

    // Drafts never produce a response row.
    const loaded = await loadRecord(db, 'rec-a');
    assert.equal(loaded!.responses.length, 0);
  } finally {
    db.close();
  }
});
