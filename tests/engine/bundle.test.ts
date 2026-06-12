import test from 'node:test';
import assert from 'node:assert/strict';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/schema.js';
import { buildRecordBundle, importRecordBundle } from '../../src/engine/bundle.js';
import { WolfValidationError } from '../../src/engine/errors.js';
import type { WolfRecord, CapturePack } from '../../src/engine/types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const pack: CapturePack = validatePack(genericPackJson);

const FIXED_NOW = '2024-03-01T09:00:00.000Z';
const FIXED_EXPORTED = '2024-03-01T10:00:00.000Z';

function makeRecord(): WolfRecord {
  return {
    recordId: 'test-record-001',
    title: 'Test Record',
    subject: {
      displayName: 'Test Subject',
      subtitle: 'A subtitle',
      organization: 'Test Org',
      role: 'Engineer',
    },
    packId: pack.packId,
    packVersion: pack.packVersion,
    packDigest: 'sha256-abcdef1234567890',
    packSnapshot: structuredClone(pack),
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    status: 'active',
    responses: [
      {
        promptId: 'operations.normal-day',
        revisions: [
          {
            revisionId: 'rev-001',
            text: 'A typical day involves checking monitors and reviewing alerts.',
            capturedAt: FIXED_NOW,
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: null,
          },
        ],
      },
    ],
    drafts: [
      {
        promptId: 'operations.hidden-dependency',
        text: 'This is a draft in progress.',
        updatedAt: FIXED_NOW,
      },
    ],
    lastExportedAt: null,
    appVersion: '0.1.0',
  };
}

// ---------------------------------------------------------------------------
// buildRecordBundle
// ---------------------------------------------------------------------------

test('buildRecordBundle: schemaVersion is 1', () => {
  const bundle = buildRecordBundle(makeRecord());
  assert.equal(bundle.schemaVersion, 1);
});

test('buildRecordBundle: copies record identity fields', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  assert.equal(bundle.recordId, record.recordId);
  assert.equal(bundle.title, record.title);
  assert.equal(bundle.status, record.status);
  assert.equal(bundle.createdAt, record.createdAt);
  assert.equal(bundle.updatedAt, record.updatedAt);
});

test('buildRecordBundle: pack identity fields come from record', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  assert.equal(bundle.pack.packId, record.packId);
  assert.equal(bundle.pack.packVersion, record.packVersion);
  assert.equal(bundle.pack.packDigest, record.packDigest);
});

test('buildRecordBundle: pack snapshot is deep clone (same content)', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  // Same content
  assert.equal(bundle.pack.snapshot.packId, pack.packId);
  // Different object reference
  assert.ok(bundle.pack.snapshot !== record.packSnapshot, 'snapshot must be a new object');
});

test('buildRecordBundle: responses are deep-cloned', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  assert.equal(bundle.responses.length, 1);
  assert.equal(bundle.responses[0]!.promptId, 'operations.normal-day');
  // Different reference
  assert.ok(bundle.responses !== record.responses, 'responses must be a new array');
});

test('buildRecordBundle: drafts omitted by default', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  assert.equal(bundle.drafts.length, 0);
});

test('buildRecordBundle: includeDrafts=true includes drafts', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { includeDrafts: true });
  assert.equal(bundle.drafts.length, 1);
  assert.equal(bundle.drafts[0]!.promptId, 'operations.hidden-dependency');
});

test('buildRecordBundle: includeDrafts=false omits drafts', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { includeDrafts: false });
  assert.equal(bundle.drafts.length, 0);
});

test('buildRecordBundle: provenance.appVersion defaults to record.appVersion', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  assert.equal(bundle.provenance.appVersion, record.appVersion);
});

test('buildRecordBundle: provenance.appVersion uses options.appVersion when provided', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { appVersion: '9.9.9' });
  assert.equal(bundle.provenance.appVersion, '9.9.9');
});

test('buildRecordBundle: provenance.engineVersion defaults to 0.1.0', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  assert.equal(bundle.provenance.engineVersion, '0.1.0');
});

test('buildRecordBundle: provenance.engineVersion uses options.engineVersion when provided', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { engineVersion: '1.2.3' });
  assert.equal(bundle.provenance.engineVersion, '1.2.3');
});

test('buildRecordBundle: provenance.exportedAt uses options.exportedAt when provided', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  assert.equal(bundle.provenance.exportedAt, FIXED_EXPORTED);
});

test('buildRecordBundle: provenance.exportedAt is an ISO string when not provided', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record);
  assert.match(bundle.provenance.exportedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('buildRecordBundle: does not mutate input record', () => {
  const record = makeRecord();
  const originalDraftsLength = record.drafts.length;
  buildRecordBundle(record, { includeDrafts: true });
  assert.equal(record.drafts.length, originalDraftsLength);
});

// ---------------------------------------------------------------------------
// Round-trip: buildRecordBundle -> JSON -> importRecordBundle
// ---------------------------------------------------------------------------

test('round-trip is semantically lossless (no drafts)', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const serialized = JSON.parse(JSON.stringify(bundle)) as unknown;
  const imported = importRecordBundle(serialized);
  // Check key fields to verify lossless round-trip
  assert.equal(imported.recordId, bundle.recordId);
  assert.equal(imported.title, bundle.title);
  assert.equal(imported.status, bundle.status);
  assert.equal(imported.createdAt, bundle.createdAt);
  assert.equal(imported.updatedAt, bundle.updatedAt);
  assert.equal(imported.pack.packId, bundle.pack.packId);
  assert.equal(imported.pack.packVersion, bundle.pack.packVersion);
  assert.equal(imported.pack.packDigest, bundle.pack.packDigest);
  assert.equal(imported.pack.snapshot.packId, bundle.pack.snapshot.packId);
  assert.equal(imported.responses.length, bundle.responses.length);
  assert.equal(imported.responses[0]!.promptId, bundle.responses[0]!.promptId);
  assert.equal(imported.responses[0]!.revisions[0]!.text, bundle.responses[0]!.revisions[0]!.text);
  assert.equal(imported.responses[0]!.revisions[0]!.revisionId, bundle.responses[0]!.revisions[0]!.revisionId);
  assert.equal(imported.drafts.length, 0);
  assert.equal(imported.provenance.engineVersion, bundle.provenance.engineVersion);
  assert.equal(imported.provenance.appVersion, bundle.provenance.appVersion);
  assert.equal(imported.provenance.exportedAt, bundle.provenance.exportedAt);
});

test('round-trip is semantically lossless (with drafts)', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, {
    includeDrafts: true,
    exportedAt: FIXED_EXPORTED,
  });
  const serialized = JSON.parse(JSON.stringify(bundle)) as unknown;
  const imported = importRecordBundle(serialized);
  assert.equal(imported.drafts.length, 1);
  assert.equal(imported.drafts[0]!.promptId, bundle.drafts[0]!.promptId);
  assert.equal(imported.drafts[0]!.text, bundle.drafts[0]!.text);
  assert.equal(imported.drafts[0]!.updatedAt, bundle.drafts[0]!.updatedAt);
});

// ---------------------------------------------------------------------------
// importRecordBundle — validation
// ---------------------------------------------------------------------------

test('importRecordBundle: rejects non-object input', () => {
  assert.throws(() => importRecordBundle('not an object'), WolfValidationError);
  assert.throws(() => importRecordBundle(null), WolfValidationError);
  assert.throws(() => importRecordBundle(42), WolfValidationError);
  assert.throws(() => importRecordBundle([]), WolfValidationError);
});

test('importRecordBundle: rejects wrong schemaVersion', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  raw.schemaVersion = 2;
  assert.throws(() => importRecordBundle(raw), WolfValidationError);
});

test('importRecordBundle: rejects prototype-pollution key at root', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  // Inject forbidden key at the top level
  (raw as Record<string, unknown>)['__proto__'] = {};
  assert.throws(() => importRecordBundle(raw), WolfValidationError);
});

test('importRecordBundle: rejects prototype-pollution key "prototype"', () => {
  const raw = {
    schemaVersion: 1,
    prototype: 'poison',
    recordId: 'x',
  };
  assert.throws(() => importRecordBundle(raw), WolfValidationError);
});

test('importRecordBundle: rejects invalid pack snapshot inside bundle', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  // Corrupt the pack snapshot
  const packRaw = raw.pack as Record<string, unknown>;
  const snapshot = packRaw.snapshot as Record<string, unknown>;
  snapshot.schemaVersion = 999;
  assert.throws(() => importRecordBundle(raw), WolfValidationError);
});

test('importRecordBundle: rejects invalid status', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  raw.status = 'deleted';
  assert.throws(() => importRecordBundle(raw), WolfValidationError);
});

test('importRecordBundle: rejects invalid createdAt timestamp', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  raw.createdAt = 'not-a-timestamp';
  assert.throws(() => importRecordBundle(raw), WolfValidationError);
});

test('importRecordBundle: rejects invalid source in revision', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  const responses = raw.responses as Array<Record<string, unknown>>;
  const revisions = responses[0]!.revisions as Array<Record<string, unknown>>;
  revisions[0]!.source = 'invalid_source';
  assert.throws(() => importRecordBundle(raw), WolfValidationError);
});

test('importRecordBundle: allows HTML in response text (free text testimony)', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  const responses = raw.responses as Array<Record<string, unknown>>;
  const revisions = responses[0]!.revisions as Array<Record<string, unknown>>;
  // HTML in testimony text must NOT be rejected
  revisions[0]!.text = 'I wrote <b>important</b> code that day.';
  // Should not throw
  const imported = importRecordBundle(raw);
  assert.equal(
    (imported.responses[0]!.revisions[0]!.text),
    'I wrote <b>important</b> code that day.',
  );
});

test('importRecordBundle: allows HTML in draft text (free text testimony)', () => {
  const record = makeRecord();
  const bundle = buildRecordBundle(record, {
    includeDrafts: true,
    exportedAt: FIXED_EXPORTED,
  });
  const raw = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
  const drafts = raw.drafts as Array<Record<string, unknown>>;
  drafts[0]!.text = 'Draft with <em>italic</em> content.';
  // Should not throw
  const imported = importRecordBundle(raw);
  assert.equal(imported.drafts[0]!.text, 'Draft with <em>italic</em> content.');
});
