import test from 'node:test';
import assert from 'node:assert/strict';
import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import {
  buildRecordBundle,
  canonicalizePack,
  commitResponse,
  computeProgress,
  countWords,
  createRecord,
  digestPack,
  getCurrentResponse,
  importRecordBundle,
  renderMarkdown,
  renderPlainText,
  sanitizeFilename,
  searchRecords,
  validatePack,
  WolfEngineError,
  WolfValidationError
} from '../../src/engine/index.js';
import type { WolfRecord } from '../../src/engine/index.js';

const pack = validatePack(genericPackJson);
const firstPromptId = pack.sections[0].promptIds[0];
const secondPromptId = pack.sections[0].promptIds[1];
const fixedTime = '2026-06-07T00:00:00.000Z';

function record(): WolfRecord {
  return createRecord({
    pack,
    packDigest: 'digest-for-test',
    recordId: 'record-test',
    timestamp: fixedTime,
    appVersion: '0.1.0'
  });
}

test('canonical pack JSON sorts object keys while preserving array order', () => {
  const canonical = canonicalizePack(pack);
  assert.match(canonical, /^\{"description":/);
  assert.match(canonical, /"sections":\[\{"description":null,"id":"operations"/);
});

test('canonical digest is stable for semantically equivalent object key order', async () => {
  const reordered = Object.fromEntries(Object.entries(pack).reverse());
  assert.equal(await digestPack(validatePack(reordered)), await digestPack(pack));
});

test('creates a record with pack snapshot provenance', () => {
  const created = record();
  assert.equal(created.recordId, 'record-test');
  assert.equal(created.title, pack.title);
  assert.equal(created.subject.displayName, 'Departing Engineer');
  assert.equal(created.packSnapshot.packId, pack.packId);
  assert.equal(created.responses.length, 0);
});

test('commits responses immutably and appends revisions', () => {
  const created = record();
  const first = commitResponse(created, firstPromptId, 'First answer', 'typed', '2026-06-07T01:00:00.000Z');
  const second = commitResponse(first, firstPromptId, 'Second answer', 'typed', '2026-06-07T02:00:00.000Z');
  assert.equal(created.responses.length, 0);
  assert.equal(first.responses[0].revisions.length, 1);
  assert.equal(second.responses[0].revisions.length, 2);
  assert.equal(second.responses[0].revisions[1].supersedesRevisionId, second.responses[0].revisions[0].revisionId);
  assert.equal(getCurrentResponse(second, firstPromptId)?.text, 'Second answer');
});

test('committed response text is preserved exactly except empty-string rejection', () => {
  const committed = commitResponse(record(), firstPromptId, '  spaced response\n', 'typed', '2026-06-07T01:00:00.000Z');
  assert.equal(getCurrentResponse(committed, firstPromptId)?.text, '  spaced response\n');
});

test('rejects invalid prompt IDs and empty committed responses', () => {
  assert.throws(() => commitResponse(record(), 'missing.prompt', 'hello', 'typed', fixedTime), WolfEngineError);
  assert.throws(() => commitResponse(record(), firstPromptId, '   ', 'typed', fixedTime), /must not be empty/);
});

test('progress counts committed responses, drafts, words, and ignores stale response IDs', () => {
  const created = record();
  const withDraft: WolfRecord = {
    ...created,
    drafts: [{ promptId: secondPromptId, text: 'draft only', updatedAt: '2026-06-07T01:00:00.000Z' }],
    responses: [{ promptId: 'stale.prompt', revisions: [{ revisionId: 'r-stale', text: 'ignored words', capturedAt: fixedTime, source: 'typed', locale: 'en-US', supersedesRevisionId: null }] }]
  };
  const committed = commitResponse(withDraft, firstPromptId, 'three useful words', 'typed', '2026-06-07T02:00:00.000Z');
  const progress = computeProgress(pack, committed);
  assert.equal(progress.totalPrompts, 5);
  assert.equal(progress.answeredPrompts, 1);
  assert.equal(progress.draftPrompts, 1);
  assert.equal(progress.wordCount, 3);
  assert.equal(progress.percentAnswered, 20);
  assert.equal(progress.bySection[0].answeredPrompts, 1);
});

test('shared word count handles whitespace and punctuation', () => {
  assert.equal(countWords('  alpha beta\nco-op delta.  '), 4);
});

test('lexical search returns prompt, response, and metadata source references', () => {
  const created = commitResponse(record(), firstPromptId, 'Operations mentions an unusual queue.', 'typed', '2026-06-07T01:00:00.000Z');
  const results = searchRecords('operations', [created]);
  assert.equal(results.some((result) => result.field === 'metadata' && result.recordId === created.recordId), true);
  assert.equal(results.some((result) => result.field === 'prompt' && result.promptId === firstPromptId), true);
  assert.equal(results.some((result) => result.field === 'response' && result.promptId === firstPromptId), true);
});

test('builds, validates, and round-trips a record bundle with pack snapshot preserved', () => {
  const committed = commitResponse(record(), firstPromptId, 'Bundle response', 'typed', '2026-06-07T01:00:00.000Z');
  const bundle = buildRecordBundle({ ...committed, drafts: [{ promptId: secondPromptId, text: 'include me', updatedAt: '2026-06-07T01:30:00.000Z' }] }, { includeDrafts: true, exportedAt: '2026-06-07T03:00:00.000Z' });
  const imported = importRecordBundle(JSON.parse(JSON.stringify(bundle)));
  assert.equal(imported.recordId, committed.recordId);
  assert.equal(imported.pack.snapshot.prompts.length, 5);
  assert.equal(imported.responses[0].revisions[0].text, 'Bundle response');
  assert.equal(imported.drafts[0].text, 'include me');
});

test('record bundle export excludes drafts by default', () => {
  const created: WolfRecord = { ...record(), drafts: [{ promptId: firstPromptId, text: 'draft', updatedAt: fixedTime }] };
  assert.equal(buildRecordBundle(created).drafts.length, 0);
});

test('record bundle import rejects unknown response prompt references', () => {
  const bundle = buildRecordBundle(commitResponse(record(), firstPromptId, 'Bundle response', 'typed', '2026-06-07T01:00:00.000Z'));
  bundle.responses[0].promptId = 'missing.prompt';
  assert.throws(() => importRecordBundle(bundle), WolfValidationError);
});

test('renders Markdown and plain text human exports with current response and optional revision history', () => {
  const first = commitResponse(record(), firstPromptId, 'Original response', 'typed', '2026-06-07T01:00:00.000Z');
  const second = commitResponse(first, firstPromptId, 'Current response', 'typed', '2026-06-07T02:00:00.000Z');
  const bundle = buildRecordBundle(second, { exportedAt: '2026-06-07T03:00:00.000Z' });
  const markdown = renderMarkdown(bundle, { includeRevisionHistory: true });
  const text = renderPlainText(bundle, { includeRevisionHistory: true });
  assert.match(markdown, /# Departing Engineer Handoff/);
  assert.match(markdown, /Current response/);
  assert.match(markdown, /Revision history/);
  assert.match(text, /\[System\]/);
  assert.match(text, /Current response/);
});

test('human exports omit unanswered prompts by default and can include them explicitly', () => {
  const bundle = buildRecordBundle(record(), { exportedAt: fixedTime });
  assert.equal(renderPlainText(bundle).includes('Unanswered'), false);
  assert.equal(renderPlainText(bundle, { includeUnansweredPrompts: true }).includes('Unanswered'), true);
});

test('sanitizes filenames for portable exports', () => {
  assert.equal(sanitizeFilename(' ../Team Handoff: Q2/Final?.json '), 'Team-Handoff-Q2-Final-.json');
  assert.equal(sanitizeFilename('////'), 'wolf-export');
});
