import test from 'node:test';
import assert from 'node:assert/strict';
import genericPack from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { capturePackSchema, wolfRecordBundleSchema } from '../../src/engine/index.js';

test('Zod pack schema accepts the generic fixture shape', () => {
  const result = capturePackSchema.safeParse(genericPack);
  assert.equal(result.success, true);
});

test('Zod record bundle schema preserves revision-chain shape', () => {
  const bundle = {
    schemaVersion: 1,
    recordId: 'record-001',
    title: 'Departing engineer handoff',
    subject: {
      displayName: 'Example Respondent',
      subtitle: 'Operations handoff',
      organization: null,
      role: 'Principal Engineer'
    },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    pack: {
      packId: genericPack.packId,
      packVersion: genericPack.packVersion,
      packDigest: 'sha256-example',
      snapshot: genericPack
    },
    responses: [
      {
        promptId: 'systems.critical-path',
        revisions: [
          {
            revisionId: 'revision-001',
            text: 'First committed answer.',
            capturedAt: '2026-01-02T00:00:00.000Z',
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: null
          },
          {
            revisionId: 'revision-002',
            text: 'Second committed answer with preserved history.',
            capturedAt: '2026-01-03T00:00:00.000Z',
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: 'revision-001'
          }
        ]
      }
    ],
    drafts: [
      {
        promptId: 'systems.single-owner',
        text: 'Draft answer not yet committed.',
        updatedAt: '2026-01-03T00:00:00.000Z'
      }
    ],
    provenance: {
      engineVersion: '0.1.0',
      appVersion: '0.1.0',
      exportedAt: '2026-01-04T00:00:00.000Z'
    }
  };

  const result = wolfRecordBundleSchema.safeParse(bundle);
  assert.equal(result.success, true);
});

test('Zod record bundle schema rejects executable-shaped unknown fields', () => {
  const result = wolfRecordBundleSchema.safeParse({
    schemaVersion: 1,
    recordId: 'record-001',
    title: 'Invalid bundle',
    subject: { displayName: 'Example Respondent' },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    pack: {
      packId: genericPack.packId,
      packVersion: genericPack.packVersion,
      packDigest: 'sha256-example',
      snapshot: { ...genericPack, script: 'alert(1)' }
    },
    responses: [],
    drafts: [],
    provenance: {
      engineVersion: '0.1.0',
      appVersion: '0.1.0',
      exportedAt: '2026-01-04T00:00:00.000Z'
    }
  });

  assert.equal(result.success, false);
});
