import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledgeDrops, reviewKnowledgeDrop, sha256 } from '../../src/knowledge/index.js';

const SOURCE = 'The shared calendar is the hidden dependency. When nobody owns it, promises quietly drift.';

test('one immutable response revision yields private source-linked candidate drops with digests', async () => {
  const workaroundStart = SOURCE.indexOf('shared calendar');
  const failureStart = SOURCE.indexOf('When nobody');
  const drops = await createKnowledgeDrops({
    recordId: 'survey-helen-july',
    promptId: 'operations.hidden-dependency',
    revisionId: 'revision-helen-2',
    sourceText: SOURCE,
    createdAt: '2026-07-13T16:00:00.000Z',
    candidates: [
      { dropId: 'drop-calendar', kind: 'constraint', startOffset: workaroundStart, endOffset: SOURCE.indexOf('.', workaroundStart), operationalPattern: 'coordination-state dependency' },
      { dropId: 'drop-owner', kind: 'failure_mode', startOffset: failureStart, endOffset: SOURCE.length, extractionMethod: 'deterministic' },
    ],
  });

  assert.equal(drops.length, 2);
  assert.equal(drops[0]?.source.exactQuote, 'shared calendar is the hidden dependency');
  assert.equal(drops[1]?.source.exactQuote, 'When nobody owns it, promises quietly drift.');
  assert.equal(drops.every((drop) => drop.source.revisionId === 'revision-helen-2'), true);
  assert.equal(drops.every((drop) => drop.reviewStatus === 'pending' && drop.visibility === 'private'), true);
  assert.equal(drops.every((drop) => drop.source.revisionDigest.length === 64 && drop.source.quoteDigest.length === 64), true);
  assert.equal(drops[0]?.source.offsetEncoding, 'utf16-code-unit');
});

test('confirmation stays private and increments the projection version', async () => {
  const [drop] = await createKnowledgeDrops({ recordId: 'record-1', promptId: 'prompt-1', revisionId: 'revision-1', sourceText: SOURCE, candidates: [{ dropId: 'drop-1', kind: 'constraint', startOffset: 4, endOffset: 19 }] });
  const reviewed = reviewKnowledgeDrop(drop!, { action: 'confirm', actor: 'Helen', at: '2026-07-13T17:00:00.000Z' });
  assert.equal(reviewed.reviewStatus, 'confirmed');
  assert.equal(reviewed.visibility, 'private');
  assert.equal(reviewed.version, 2);
  assert.deepEqual(reviewed.source, drop!.source);
});

test('correction preserves the exact source and prior meaning in the event projection', async () => {
  const [drop] = await createKnowledgeDrops({ recordId: 'record-1', promptId: 'prompt-1', revisionId: 'revision-1', sourceText: SOURCE, candidates: [{ dropId: 'drop-1', kind: 'constraint', startOffset: 4, endOffset: 19, text: 'Calendar problem' }] });
  const corrected = reviewKnowledgeDrop(drop!, { action: 'correct', actor: 'Helen', text: 'Ownership is the problem, not the calendar itself.', kind: 'unwritten_rule', operationalPattern: 'implicit state ownership', at: '2026-07-13T17:00:00.000Z' });
  assert.equal(corrected.reviewStatus, 'corrected');
  assert.equal(corrected.text, 'Ownership is the problem, not the calendar itself.');
  assert.equal(corrected.source.exactQuote, drop!.source.exactQuote);
  assert.equal(corrected.reviewHistory[0]?.priorText, 'Calendar problem');
  assert.equal(corrected.reviewHistory[0]?.nextKind, 'unwritten_rule');
});

test('keep-private does not convert an unreviewed candidate into a confirmed claim', async () => {
  const [drop] = await createKnowledgeDrops({ recordId: 'record-1', promptId: 'prompt-1', revisionId: 'revision-1', sourceText: SOURCE, candidates: [{ dropId: 'drop-1', kind: 'constraint', startOffset: 4, endOffset: 19 }] });
  const privateDrop = reviewKnowledgeDrop(drop!, { action: 'keep_private', actor: 'Helen' });
  assert.equal(privateDrop.reviewStatus, 'pending');
  assert.equal(privateDrop.visibility, 'private');
  const rejected = reviewKnowledgeDrop(drop!, { action: 'reject', actor: 'Helen' });
  assert.equal(rejected.reviewStatus, 'rejected');
  assert.throws(() => reviewKnowledgeDrop(rejected, { action: 'confirm', actor: 'owner' }), /cannot be reviewed again/);
});

test('invalid spans and duplicate IDs reject the whole asynchronous creation', async () => {
  await assert.rejects(createKnowledgeDrops({ recordId: 'r', promptId: 'p', revisionId: 'v', sourceText: SOURCE, candidates: [{ dropId: 'bad', kind: 'symptom', startOffset: 3, endOffset: SOURCE.length + 1 }] }), /Invalid knowledge drop source span/);
  await assert.rejects(createKnowledgeDrops({ recordId: 'r', promptId: 'p', revisionId: 'v', sourceText: SOURCE, candidates: [{ dropId: 'same', kind: 'symptom', startOffset: 0, endOffset: 3 }, { dropId: 'same', kind: 'constraint', startOffset: 4, endOffset: 10 }] }), /Duplicate knowledge drop ID/);
  const [drop] = await createKnowledgeDrops({ recordId: 'r', promptId: 'p', revisionId: 'v', sourceText: SOURCE, candidates: [{ dropId: 'valid', kind: 'symptom', startOffset: 0, endOffset: 3 }] });
  assert.throws(() => reviewKnowledgeDrop(drop!, { action: 'confirm', actor: '   ' }), /requires an actor/);
});

test('SHA-256 is deterministic and changes with the source text', async () => {
  assert.equal(await sha256(SOURCE), await sha256(SOURCE));
  assert.notEqual(await sha256(SOURCE), await sha256(`${SOURCE} `));
});
