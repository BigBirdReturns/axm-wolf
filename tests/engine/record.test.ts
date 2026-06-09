import test from 'node:test';
import assert from 'node:assert/strict';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/schema.js';
import {
  createRecord,
  commitResponse,
  getCurrentResponse,
  computeProgress,
} from '../../src/engine/record.js';
import { WolfValidationError } from '../../src/engine/errors.js';
import type { CapturePack, WolfRecord, Draft } from '../../src/engine/types.js';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

const pack: CapturePack = validatePack(genericPackJson);

// The generic fixture has 5 prompts total:
// operations section: operations.normal-day, operations.hidden-dependency, operations.first-alert
// continuity section: continuity.safe-change, continuity-next-owner
const PROMPT_OPS_1 = 'operations.normal-day';
const PROMPT_OPS_2 = 'operations.hidden-dependency';
const PROMPT_CONT_1 = 'continuity.safe-change';
const FIXED_NOW = '2024-01-15T10:00:00.000Z';
const FIXED_TS1 = '2024-01-15T11:00:00.000Z';
const FIXED_TS2 = '2024-01-15T12:00:00.000Z';

function makeRecord(): WolfRecord {
  return createRecord({
    recordId: 'test-record-id',
    pack,
    packDigest: 'sha256-abc123',
    appVersion: '0.1.0',
    now: FIXED_NOW,
  });
}

// ---------------------------------------------------------------------------
// createRecord
// ---------------------------------------------------------------------------

test('createRecord: status is active', () => {
  const record = makeRecord();
  assert.equal(record.status, 'active');
});

test('createRecord: responses and drafts are empty arrays', () => {
  const record = makeRecord();
  assert.equal(record.responses.length, 0);
  assert.equal(record.drafts.length, 0);
});

test('createRecord: packSnapshot is present and matches pack', () => {
  const record = makeRecord();
  assert.ok(record.packSnapshot, 'packSnapshot should be defined');
  assert.equal(record.packSnapshot.packId, pack.packId);
  assert.equal(record.packSnapshot.packVersion, pack.packVersion);
});

test('createRecord: packSnapshot is a deep clone (mutation-proof)', () => {
  const record = makeRecord();
  // Mutating the original pack object should NOT change the snapshot
  const originalTitle = pack.title;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pack as any).title = 'MUTATED';
  assert.equal(record.packSnapshot.title, originalTitle);
  // Restore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pack as any).title = originalTitle;
});

test('createRecord: createdAt and updatedAt equal injected now', () => {
  const record = makeRecord();
  assert.equal(record.createdAt, FIXED_NOW);
  assert.equal(record.updatedAt, FIXED_NOW);
});

test('createRecord: title defaults to pack.title when not supplied', () => {
  const record = makeRecord();
  assert.equal(record.title, pack.title);
});

test('createRecord: title uses input.title when supplied', () => {
  const record = createRecord({
    recordId: 'r1',
    pack,
    packDigest: 'sha256-abc',
    appVersion: '0.1.0',
    title: 'Custom Title',
    now: FIXED_NOW,
  });
  assert.equal(record.title, 'Custom Title');
});

test('createRecord: subject defaults to pack.subjectDefaults when not supplied', () => {
  const record = makeRecord();
  assert.equal(record.subject.displayName, pack.subjectDefaults?.displayName);
});

test('createRecord: subject uses input.subject when supplied', () => {
  const customSubject = { displayName: 'Jane Doe' };
  const record = createRecord({
    recordId: 'r1',
    pack,
    packDigest: 'sha256-abc',
    appVersion: '0.1.0',
    subject: customSubject,
    now: FIXED_NOW,
  });
  assert.equal(record.subject.displayName, 'Jane Doe');
});

test('createRecord: lastExportedAt is null', () => {
  const record = makeRecord();
  assert.equal(record.lastExportedAt, null);
});

test('createRecord: packId and packVersion match pack', () => {
  const record = makeRecord();
  assert.equal(record.packId, pack.packId);
  assert.equal(record.packVersion, pack.packVersion);
});

test('createRecord: packDigest is stored', () => {
  const record = makeRecord();
  assert.equal(record.packDigest, 'sha256-abc123');
});

test('createRecord: appVersion is stored', () => {
  const record = makeRecord();
  assert.equal(record.appVersion, '0.1.0');
});

// ---------------------------------------------------------------------------
// commitResponse — basic append
// ---------------------------------------------------------------------------

test('commitResponse: appends a revision to a new prompt response', () => {
  const record = makeRecord();
  const updated = commitResponse(record, PROMPT_OPS_1, 'First answer.', 'typed', FIXED_TS1);
  assert.equal(updated.responses.length, 1);
  assert.equal(updated.responses[0]!.promptId, PROMPT_OPS_1);
  assert.equal(updated.responses[0]!.revisions.length, 1);
  assert.equal(updated.responses[0]!.revisions[0]!.text, 'First answer.');
});

test('commitResponse: first revision has null supersedesRevisionId', () => {
  const record = makeRecord();
  const updated = commitResponse(record, PROMPT_OPS_1, 'First answer.', 'typed', FIXED_TS1);
  assert.equal(updated.responses[0]!.revisions[0]!.supersedesRevisionId, null);
});

test('commitResponse: second commit on same prompt appends (length 2), preserves history', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'First answer.', 'typed', FIXED_TS1);
  record = commitResponse(record, PROMPT_OPS_1, 'Second answer.', 'typed', FIXED_TS2);

  const response = record.responses.find((r) => r.promptId === PROMPT_OPS_1);
  assert.ok(response, 'response should exist');
  assert.equal(response.revisions.length, 2, 'should have 2 revisions');
  assert.equal(response.revisions[0]!.text, 'First answer.', 'first revision preserved');
  assert.equal(response.revisions[1]!.text, 'Second answer.', 'second revision added');
});

test('commitResponse: second revision supersedesRevisionId equals first revision id', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'First answer.', 'typed', FIXED_TS1);
  const firstRevisionId = record.responses[0]!.revisions[0]!.revisionId;

  record = commitResponse(record, PROMPT_OPS_1, 'Second answer.', 'typed', FIXED_TS2);
  const secondRevision = record.responses[0]!.revisions[1]!;

  assert.equal(secondRevision.supersedesRevisionId, firstRevisionId);
});

test('commitResponse: does not mutate input record', () => {
  const record = makeRecord();
  const originalResponsesLength = record.responses.length;
  commitResponse(record, PROMPT_OPS_1, 'Answer.', 'typed', FIXED_TS1);
  assert.equal(record.responses.length, originalResponsesLength, 'original record not mutated');
});

test('commitResponse: updatedAt is set to capturedAt', () => {
  const record = makeRecord();
  const updated = commitResponse(record, PROMPT_OPS_1, 'Answer.', 'typed', FIXED_TS1);
  assert.equal(updated.updatedAt, FIXED_TS1);
});

test('commitResponse: source is stored on revision', () => {
  const record = makeRecord();
  const updated = commitResponse(record, PROMPT_OPS_1, 'Answer.', 'speech_transcript', FIXED_TS1);
  assert.equal(updated.responses[0]!.revisions[0]!.source, 'speech_transcript');
});

test('commitResponse: locale is en-US', () => {
  const record = makeRecord();
  const updated = commitResponse(record, PROMPT_OPS_1, 'Answer.', 'typed', FIXED_TS1);
  assert.equal(updated.responses[0]!.revisions[0]!.locale, 'en-US');
});

// ---------------------------------------------------------------------------
// commitResponse — validation errors
// ---------------------------------------------------------------------------

test('commitResponse: throws WolfValidationError for empty text', () => {
  const record = makeRecord();
  assert.throws(
    () => commitResponse(record, PROMPT_OPS_1, '', 'typed', FIXED_TS1),
    WolfValidationError,
  );
});

test('commitResponse: throws WolfValidationError for whitespace-only text', () => {
  const record = makeRecord();
  assert.throws(
    () => commitResponse(record, PROMPT_OPS_1, '   \n\t  ', 'typed', FIXED_TS1),
    WolfValidationError,
  );
});

test('commitResponse: throws WolfValidationError for unknown promptId', () => {
  const record = makeRecord();
  assert.throws(
    () => commitResponse(record, 'nonexistent.prompt', 'Answer.', 'typed', FIXED_TS1),
    WolfValidationError,
  );
});

// ---------------------------------------------------------------------------
// commitResponse — draft clearing
// ---------------------------------------------------------------------------

test('commitResponse: clears a draft whose promptId matches', () => {
  let record = makeRecord();
  // Manually inject a draft
  const draft: Draft = { promptId: PROMPT_OPS_1, text: 'Draft text', updatedAt: FIXED_NOW };
  record = { ...record, drafts: [draft] };

  const updated = commitResponse(record, PROMPT_OPS_1, 'Committed text.', 'typed', FIXED_TS1);
  assert.equal(updated.drafts.length, 0, 'draft should be cleared after commit');
});

test('commitResponse: does not clear drafts for other prompts', () => {
  let record = makeRecord();
  const draft1: Draft = { promptId: PROMPT_OPS_1, text: 'Draft 1', updatedAt: FIXED_NOW };
  const draft2: Draft = { promptId: PROMPT_OPS_2, text: 'Draft 2', updatedAt: FIXED_NOW };
  record = { ...record, drafts: [draft1, draft2] };

  const updated = commitResponse(record, PROMPT_OPS_1, 'Committed.', 'typed', FIXED_TS1);
  assert.equal(updated.drafts.length, 1, 'only the matching draft removed');
  assert.equal(updated.drafts[0]!.promptId, PROMPT_OPS_2);
});

// ---------------------------------------------------------------------------
// getCurrentResponse
// ---------------------------------------------------------------------------

test('getCurrentResponse: returns null when no response exists', () => {
  const record = makeRecord();
  const result = getCurrentResponse(record, PROMPT_OPS_1);
  assert.equal(result, null);
});

test('getCurrentResponse: returns the latest revision text after one commit', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'First answer.', 'typed', FIXED_TS1);
  const rev = getCurrentResponse(record, PROMPT_OPS_1);
  assert.ok(rev, 'should return a revision');
  assert.equal(rev.text, 'First answer.');
});

test('getCurrentResponse: returns the latest revision after two commits', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'First answer.', 'typed', FIXED_TS1);
  record = commitResponse(record, PROMPT_OPS_1, 'Second answer.', 'typed', FIXED_TS2);
  const rev = getCurrentResponse(record, PROMPT_OPS_1);
  assert.ok(rev, 'should return a revision');
  assert.equal(rev.text, 'Second answer.');
});

test('getCurrentResponse: returns null for a different promptId', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'Answer.', 'typed', FIXED_TS1);
  const result = getCurrentResponse(record, PROMPT_OPS_2);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// computeProgress
// ---------------------------------------------------------------------------

test('computeProgress: zero answered on fresh record', () => {
  const record = makeRecord();
  const progress = computeProgress(pack, record);
  assert.equal(progress.totalPrompts, 5);
  assert.equal(progress.answeredPrompts, 0);
  assert.equal(progress.draftPrompts, 0);
  assert.equal(progress.wordCount, 0);
  assert.equal(progress.percentAnswered, 0);
});

test('computeProgress: counts answered prompt correctly', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'Hello world.', 'typed', FIXED_TS1);
  const progress = computeProgress(pack, record);
  assert.equal(progress.answeredPrompts, 1);
  assert.equal(progress.percentAnswered, 20); // 1/5 * 100 = 20
});

test('computeProgress: wordCount uses shared countWords', () => {
  let record = makeRecord();
  // "Hello world." → 2 words, "foo bar baz" → 3 words = 5 total
  record = commitResponse(record, PROMPT_OPS_1, 'Hello world.', 'typed', FIXED_TS1);
  record = commitResponse(record, PROMPT_OPS_2, 'foo bar baz', 'typed', FIXED_TS2);
  const progress = computeProgress(pack, record);
  assert.equal(progress.wordCount, 5);
});

test('computeProgress: drafts are not counted as answered', () => {
  let record = makeRecord();
  const draft: Draft = { promptId: PROMPT_OPS_1, text: 'In progress...', updatedAt: FIXED_NOW };
  record = { ...record, drafts: [draft] };
  const progress = computeProgress(pack, record);
  assert.equal(progress.answeredPrompts, 0);
  assert.equal(progress.draftPrompts, 1);
});

test('computeProgress: draftPrompts excludes prompts that are already answered', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'Answered.', 'typed', FIXED_TS1);
  // Also add a draft for that same prompt (edge case: shouldn't happen normally but be safe)
  const draft: Draft = { promptId: PROMPT_OPS_1, text: 'Also drafting...', updatedAt: FIXED_NOW };
  record = { ...record, drafts: [draft] };
  const progress = computeProgress(pack, record);
  assert.equal(progress.draftPrompts, 0, 'answered prompts not counted as drafts');
});

test('computeProgress: bySection sums are correct', () => {
  let record = makeRecord();
  // Answer one prompt in operations (3 total), one in continuity (2 total)
  record = commitResponse(record, PROMPT_OPS_1, 'Ops answer.', 'typed', FIXED_TS1);
  record = commitResponse(record, PROMPT_CONT_1, 'Continuity answer.', 'typed', FIXED_TS2);
  const progress = computeProgress(pack, record);

  const opsSec = progress.bySection.find((s) => s.sectionId === 'operations');
  const contSec = progress.bySection.find((s) => s.sectionId === 'continuity');

  assert.ok(opsSec, 'operations section present');
  assert.equal(opsSec.totalPrompts, 3);
  assert.equal(opsSec.answeredPrompts, 1);
  assert.equal(opsSec.percentAnswered, 33); // Math.round(1/3*100) = 33

  assert.ok(contSec, 'continuity section present');
  assert.equal(contSec.totalPrompts, 2);
  assert.equal(contSec.answeredPrompts, 1);
  assert.equal(contSec.percentAnswered, 50); // Math.round(1/2*100) = 50
});

test('computeProgress: stale response IDs not in pack are ignored', () => {
  let record = makeRecord();
  record = commitResponse(record, PROMPT_OPS_1, 'Real answer.', 'typed', FIXED_TS1);

  // Inject a stale response with a prompt ID not in the pack
  const staleResponse = {
    promptId: 'stale.old-prompt-id',
    revisions: [
      {
        revisionId: 'stale-rev-id',
        text: 'Old answer with lots of words here.',
        capturedAt: FIXED_NOW,
        source: 'imported' as const,
        locale: 'en-US',
        supersedesRevisionId: null,
      },
    ],
  };
  record = { ...record, responses: [...record.responses, staleResponse] };

  const progress = computeProgress(pack, record);
  // Only the real answer should count
  assert.equal(progress.answeredPrompts, 1);
  assert.equal(progress.wordCount, 2); // 'Real answer.' = 2 words
});

test('computeProgress: all prompts answered gives 100 percent', () => {
  let record = makeRecord();
  const allPromptIds = pack.prompts.map((p) => p.id);
  for (const id of allPromptIds) {
    record = commitResponse(record, id, 'Done.', 'typed', FIXED_TS1);
  }
  const progress = computeProgress(pack, record);
  assert.equal(progress.answeredPrompts, 5);
  assert.equal(progress.percentAnswered, 100);
});

test('computeProgress: bySection draftPrompts counts correctly', () => {
  const record2 = makeRecord();
  const draftForOps: Draft = {
    promptId: PROMPT_OPS_1,
    text: 'Working on this...',
    updatedAt: FIXED_NOW,
  };
  const withDraft = { ...record2, drafts: [draftForOps] };
  const progress = computeProgress(pack, withDraft);

  const opsSec = progress.bySection.find((s) => s.sectionId === 'operations');
  assert.ok(opsSec, 'operations section present');
  assert.equal(opsSec.draftPrompts, 1);

  const contSec = progress.bySection.find((s) => s.sectionId === 'continuity');
  assert.ok(contSec, 'continuity section present');
  assert.equal(contSec.draftPrompts, 0);
});
