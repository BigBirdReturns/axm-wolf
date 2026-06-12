import test from 'node:test';
import assert from 'node:assert/strict';

import { bundleToRecord, makeImportCopy } from '../../src/app/lib/import.js';
import type { WolfRecordBundle } from '../../src/engine/index.js';

const samplePack = {
  schemaVersion: 1 as const,
  packId: 'generic-fixture',
  packVersion: '1.0.0',
  engineVersion: '>=0.1.0',
  title: 'Generic Fixture',
  theme: { accent: '#7a4a1e' },
  lenses: [{ id: 'lens-a', label: 'Lens A' }],
  sections: [{ id: 'sec-1', label: 'Section 1', promptIds: ['p1'] }],
  prompts: [{ id: 'p1', kind: 'long_text' as const, lensId: 'lens-a', text: 'Tell me about it.' }],
};

const sampleBundle: WolfRecordBundle = {
  schemaVersion: 1,
  recordId: 'rec-1',
  title: 'Sample Record',
  subject: { displayName: 'Subject Name', subtitle: null, organization: null, role: null },
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  pack: {
    packId: 'generic-fixture',
    packVersion: '1.0.0',
    packDigest: 'sha256-deadbeef',
    snapshot: samplePack,
  },
  responses: [
    {
      promptId: 'p1',
      revisions: [
        {
          revisionId: 'rev-1',
          text: 'An answer.',
          capturedAt: '2024-01-02T00:00:00.000Z',
          source: 'typed',
          locale: 'en-US',
          supersedesRevisionId: null,
        },
      ],
    },
  ],
  drafts: [],
  provenance: { engineVersion: '0.1.0', appVersion: '0.1.0', exportedAt: '2024-01-03T00:00:00.000Z' },
};

test('bundleToRecord maps fields 1:1 and resets lastExportedAt', () => {
  const record = bundleToRecord(sampleBundle);

  assert.equal(record.recordId, 'rec-1');
  assert.equal(record.title, 'Sample Record');
  assert.equal(record.status, 'active');
  assert.equal(record.createdAt, sampleBundle.createdAt);
  assert.equal(record.updatedAt, sampleBundle.updatedAt);
  assert.equal(record.packId, 'generic-fixture');
  assert.equal(record.packVersion, '1.0.0');
  assert.equal(record.packDigest, 'sha256-deadbeef');
  assert.equal(JSON.stringify(record.packSnapshot), JSON.stringify(samplePack));
  assert.equal(JSON.stringify(record.responses), JSON.stringify(sampleBundle.responses));
  assert.equal(record.drafts.length, 0);
  assert.equal(record.lastExportedAt, null);
  assert.equal(record.appVersion, '0.1.0');
});

test('makeImportCopy assigns a new recordId and suffixes the title', () => {
  const record = bundleToRecord(sampleBundle);
  const copy = makeImportCopy(record, 'rec-2');

  assert.equal(copy.recordId, 'rec-2');
  assert.equal(copy.title, 'Sample Record (copy)');
  // Other fields preserved
  assert.equal(JSON.stringify(copy.responses), JSON.stringify(record.responses));
  assert.equal(copy.packId, record.packId);
});
