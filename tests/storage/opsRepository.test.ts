import test from 'node:test';
import assert from 'node:assert/strict';

import { IDBFactory } from 'fake-indexeddb';

import { createInspectionCase, recessedLightingPlaybook, type EvidenceArtifact } from '../../src/ops/index.js';
import { openWolfDb } from '../../src/storage/db.js';
import {
  deleteOpsInspectionCase,
  listOpsEvidenceArtifacts,
  listOpsInspectionCases,
  loadOpsInspectionCase,
  saveOpsEvidenceArtifact,
  saveOpsInspectionCase,
} from '../../src/storage/opsRepository.js';

function freshFactory(): IDBFactory {
  return new IDBFactory();
}

const NOW = '2026-07-12T12:00:00.000Z';

test('operational case and media evidence survive a local round trip', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const inspectionCase = createInspectionCase({
      caseId: 'case-1',
      playbook: recessedLightingPlaybook,
      siteLabel: 'Unit B',
      now: NOW,
    });
    const artifact: EvidenceArtifact = {
      artifactId: 'artifact-1',
      caseId: inspectionCase.caseId,
      requestId: 'room-wide-context',
      kind: 'photo',
      sourceClass: 'operator_observed',
      fileName: 'ceiling.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      capturedAt: NOW,
      notes: null,
      blob: new Blob(['test'], { type: 'image/jpeg' }),
    };

    await saveOpsInspectionCase(db, inspectionCase);
    await saveOpsEvidenceArtifact(db, artifact);

    const loaded = await loadOpsInspectionCase(db, inspectionCase.caseId);
    const evidence = await listOpsEvidenceArtifacts(db, inspectionCase.caseId);

    assert.equal(loaded?.siteLabel, 'Unit B');
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0]?.fileName, 'ceiling.jpg');
    assert.equal(evidence[0]?.blob?.size, 4);
  } finally {
    db.close();
  }
});

test('operational cases list most recently updated first', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    await saveOpsInspectionCase(
      db,
      createInspectionCase({
        caseId: 'older',
        playbook: recessedLightingPlaybook,
        now: '2026-07-10T12:00:00.000Z',
      }),
    );
    await saveOpsInspectionCase(
      db,
      createInspectionCase({
        caseId: 'newer',
        playbook: recessedLightingPlaybook,
        now: '2026-07-12T12:00:00.000Z',
      }),
    );

    assert.deepEqual((await listOpsInspectionCases(db)).map((entry) => entry.caseId), ['newer', 'older']);
  } finally {
    db.close();
  }
});

test('deleting an operational case removes its evidence but preserves other cases', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const first = createInspectionCase({ caseId: 'first', playbook: recessedLightingPlaybook, now: NOW });
    const second = createInspectionCase({ caseId: 'second', playbook: recessedLightingPlaybook, now: NOW });
    await saveOpsInspectionCase(db, first);
    await saveOpsInspectionCase(db, second);

    for (const [artifactId, caseId] of [
      ['artifact-first', 'first'],
      ['artifact-second', 'second'],
    ] as const) {
      await saveOpsEvidenceArtifact(db, {
        artifactId,
        caseId,
        requestId: 'room-wide-context',
        kind: 'photo',
        sourceClass: 'operator_observed',
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        capturedAt: NOW,
        notes: null,
      });
    }

    await deleteOpsInspectionCase(db, 'first');

    assert.equal(await loadOpsInspectionCase(db, 'first'), undefined);
    assert.ok((await loadOpsInspectionCase(db, 'second')) !== undefined);
    assert.equal((await listOpsEvidenceArtifacts(db, 'first')).length, 0);
    assert.equal((await listOpsEvidenceArtifacts(db, 'second')).length, 1);
  } finally {
    db.close();
  }
});
