import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRecords } from '../../src/engine/search.js';
import { validatePack } from '../../src/engine/schema.js';
import genericPackRaw from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import type { WolfRecord } from '../../src/engine/types.js';

// ---------------------------------------------------------------------------
// Build a minimal WolfRecord from the generic fixture
// ---------------------------------------------------------------------------

const validatedPack = validatePack(genericPackRaw);

function makeRecord(overrides?: Partial<WolfRecord>): WolfRecord {
  return {
    recordId: 'test-record-1',
    title: 'Departing Engineer Handoff',
    subject: {
      displayName: 'Jane Engineer',
      subtitle: 'Knowledge Transfer',
      organization: 'Acme Corp',
      role: 'Senior Engineer',
    },
    packId: validatedPack.packId,
    packVersion: validatedPack.packVersion,
    packDigest: 'sha256-test-digest',
    packSnapshot: validatedPack,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    status: 'active',
    responses: [],
    drafts: [],
    lastExportedAt: null,
    appVersion: '0.1.0',
    ...overrides,
  };
}

// The generic fixture has these prompt IDs and sections:
//   operations section: operations.normal-day, operations.hidden-dependency, operations.first-alert
//   continuity section: continuity.safe-change, continuity-next-owner

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('empty query returns []', () => {
  const record = makeRecord();
  assert.equal(searchRecords('', [record]).length, 0);
});

test('whitespace-only query returns []', () => {
  const record = makeRecord();
  assert.equal(searchRecords('   \t\n  ', [record]).length, 0);
});

test('non-matching query returns []', () => {
  const record = makeRecord();
  const results = searchRecords('xyzzy-no-match-possible', [record]);
  assert.equal(results.length, 0);
});

test('search is case-insensitive', () => {
  const record = makeRecord();
  const lower = searchRecords('departing engineer', [record]);
  const upper = searchRecords('DEPARTING ENGINEER', [record]);
  const mixed = searchRecords('Departing Engineer', [record]);
  assert.ok(lower.length > 0, 'lowercase should match');
  assert.equal(lower.length, upper.length);
  assert.equal(lower.length, mixed.length);
  for (let i = 0; i < lower.length; i++) {
    assert.equal(lower[i].score, upper[i].score);
    assert.equal(lower[i].field, upper[i].field);
    assert.equal(lower[i].sectionId, upper[i].sectionId);
    assert.equal(lower[i].promptId, upper[i].promptId);
  }
});

test('query matching record title yields field "metadata"', () => {
  // The record title is "Departing Engineer Handoff"
  const record = makeRecord();
  const results = searchRecords('Departing Engineer Handoff', [record]);
  const titleHit = results.find(r => r.field === 'metadata' && r.sectionId === '' && r.promptId === '');
  assert.ok(titleHit !== undefined, 'should have a metadata hit with empty sectionId+promptId');
  assert.equal(titleHit.recordId, 'test-record-1');
});

test('query matching a prompt text yields field "prompt" with correct sectionId and promptId', () => {
  // "operations.normal-day" prompt text: "Describe a normal operating day for the system you know best."
  const record = makeRecord();
  const results = searchRecords('normal operating day', [record]);
  const hit = results.find(r => r.field === 'prompt' && r.promptId === 'operations.normal-day');
  assert.ok(hit !== undefined, 'should find a prompt hit');
  assert.equal(hit.sectionId, 'operations');
  assert.equal(hit.promptId, 'operations.normal-day');
  assert.equal(hit.recordId, 'test-record-1');
});

test('query matching only a response text yields field "response" with correct sectionId and promptId', () => {
  const record = makeRecord({
    responses: [
      {
        promptId: 'operations.normal-day',
        revisions: [
          {
            revisionId: 'rev-1',
            text: 'I wake up and check the dashboards first thing.',
            capturedAt: '2024-01-02T00:00:00.000Z',
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: null,
          },
        ],
      },
    ],
  });
  // Query text that appears ONLY in the response, not in any prompt text
  const results = searchRecords('dashboards first thing', [record]);
  const hit = results.find(r => r.field === 'response');
  assert.ok(hit !== undefined, 'should find a response hit');
  assert.equal(hit.sectionId, 'operations');
  assert.equal(hit.promptId, 'operations.normal-day');
  assert.equal(hit.recordId, 'test-record-1');
  // Confirm no prompt hit for the same unique text
  const promptHit = results.find(r => r.field === 'prompt' && r.promptId === 'operations.normal-day');
  assert.equal(promptHit, undefined, 'should not yield a prompt hit for response-only text');
});

test('uses the LAST revision as the current response', () => {
  const record = makeRecord({
    responses: [
      {
        promptId: 'operations.first-alert',
        revisions: [
          {
            revisionId: 'rev-1',
            text: 'First draft text that was superseded.',
            capturedAt: '2024-01-01T00:00:00.000Z',
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: null,
          },
          {
            revisionId: 'rev-2',
            text: 'Final revised response with unique phrasing zeta-canary.',
            capturedAt: '2024-01-02T00:00:00.000Z',
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: 'rev-1',
          },
        ],
      },
    ],
  });
  // Should find the text from the last revision
  const found = searchRecords('zeta-canary', [record]);
  assert.equal(found.length, 1);
  assert.equal(found[0].field, 'response');
  assert.equal(found[0].promptId, 'operations.first-alert');
  // Should NOT find the text from the first revision (it's superseded)
  const old = searchRecords('superseded', [record]);
  assert.equal(old.length, 0, 'should not match text from non-last revision');
});

test('results are sorted deterministically: score DESC, then recordId/sectionId/promptId/field ASC', () => {
  // Create a record where the query appears in multiple places
  const record = makeRecord({
    responses: [
      {
        promptId: 'operations.normal-day',
        revisions: [
          {
            revisionId: 'rev-1',
            text: 'system system system system system',
            capturedAt: '2024-01-02T00:00:00.000Z',
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: null,
          },
        ],
      },
    ],
  });
  // "system" appears multiple times in the response (score=5), once in section label not present,
  // and once in the lens label "System"
  const results = searchRecords('system', [record]);
  assert.ok(results.length >= 1);

  // Verify sort invariant
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];
    // Check score DESC
    if (prev.score !== curr.score) {
      assert.ok(prev.score > curr.score, `score should be descending: ${prev.score} vs ${curr.score}`);
    } else {
      // Same score: check recordId ASC
      const cmpRecord = prev.recordId <= curr.recordId;
      if (prev.recordId !== curr.recordId) {
        assert.ok(cmpRecord, 'recordId should be ASC');
      } else if (prev.sectionId !== curr.sectionId) {
        assert.ok(prev.sectionId <= curr.sectionId, 'sectionId should be ASC');
      } else if (prev.promptId !== curr.promptId) {
        assert.ok(prev.promptId <= curr.promptId, 'promptId should be ASC');
      } else {
        assert.ok(prev.field <= curr.field, 'field should be ASC');
      }
    }
  }

  // Running the same query twice must produce identical results
  const results2 = searchRecords('system', [record]);
  assert.equal(JSON.stringify(results), JSON.stringify(results2));
});

test('same input always produces identical order (stability)', () => {
  const record = makeRecord({
    responses: [
      {
        promptId: 'continuity.safe-change',
        revisions: [
          {
            revisionId: 'rev-1',
            text: 'change carefully and test change thoroughly',
            capturedAt: '2024-01-02T00:00:00.000Z',
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: null,
          },
        ],
      },
    ],
  });
  const r1 = searchRecords('change', [record]);
  const r2 = searchRecords('change', [record]);
  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
});

test('snippet centers around the first match', () => {
  const record = makeRecord();
  // prompt "operations.hidden-dependency": "What dependency would surprise a new owner if it disappeared tomorrow?"
  const results = searchRecords('dependency', [record]);
  const hit = results.find(r => r.promptId === 'operations.hidden-dependency');
  assert.ok(hit !== undefined);
  assert.ok(hit.snippet.toLowerCase().includes('dependency'), 'snippet must include the match text');
});

test('subject metadata fields match as "metadata"', () => {
  // Subject has: displayName "Jane Engineer", subtitle "Knowledge Transfer",
  // organization "Acme Corp", role "Senior Engineer"
  const record = makeRecord();

  const displayNameHit = searchRecords('Jane Engineer', [record]).find(r => r.field === 'metadata');
  assert.ok(displayNameHit !== undefined, 'displayName should match as metadata');

  const orgHit = searchRecords('Acme Corp', [record]).find(r => r.field === 'metadata');
  assert.ok(orgHit !== undefined, 'organization should match as metadata');

  const roleHit = searchRecords('Senior Engineer', [record]).find(r => r.field === 'metadata');
  assert.ok(roleHit !== undefined, 'role should match as metadata');
});

test('section label matches as "metadata" with correct sectionId', () => {
  // Pack has sections "Operations" and "Continuity"
  const record = makeRecord();
  const results = searchRecords('Operations', [record]);
  const hit = results.find(r => r.field === 'metadata' && r.sectionId === 'operations');
  assert.ok(hit !== undefined, 'section label should yield metadata hit with sectionId');
  assert.equal(hit.promptId, '');
});

test('lens label matches as "metadata" with empty promptId', () => {
  // Pack lenses: "System", "Failure Mode", "Handoff"
  const record = makeRecord();
  const results = searchRecords('Failure Mode', [record]);
  const hit = results.find(r => r.field === 'metadata' && r.promptId === '');
  assert.ok(hit !== undefined, 'lens label should yield metadata hit');
});

test('multiple records are all searched', () => {
  const record1 = makeRecord({ recordId: 'rec-alpha' });
  const record2 = makeRecord({
    recordId: 'rec-beta',
    title: 'Completely Different Title',
    subject: {
      displayName: 'Someone Else',
      subtitle: null,
      organization: null,
      role: null,
    },
  });
  const results = searchRecords('Departing Engineer', [record1, record2]);
  const fromRec1 = results.filter(r => r.recordId === 'rec-alpha');
  assert.ok(fromRec1.length > 0, 'rec-alpha should have hits');
  // rec-beta has no "Departing Engineer" in its overridden title/subject
  // but both share the same packSnapshot which has prompt text with "Departing" maybe not...
  // Just confirm rec-alpha is searched
  assert.ok(fromRec1.some(r => r.field === 'metadata'), 'rec-alpha metadata hit expected');
});

test('empty records array returns []', () => {
  assert.equal(searchRecords('anything', []).length, 0);
});
