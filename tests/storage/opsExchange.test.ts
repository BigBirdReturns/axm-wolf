import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

import {
  createAssetPassport,
  createInspectionCase,
  createObservation,
  recessedLightingPlaybook,
} from '../../src/ops/index.js';
import { openWolfDb } from '../../src/storage/db.js';
import {
  createOpsAnalysisSubmission,
  importOpsAnalysisReturn,
  reviewAnalysisObservation,
} from '../../src/storage/opsExchange.js';
import {
  listOpsObservations,
  saveOpsAssetPassport,
  saveOpsEvidenceArtifact,
  saveOpsInspectionCase,
  saveOpsObservation,
} from '../../src/storage/opsRepository.js';

const NOW = '2026-07-12T12:00:00.000Z';

async function seededDb() {
  const db = await openWolfDb(new IDBFactory());
  const asset = createAssetPassport({ assetId: 'asset-1', displayName: 'Unit B lights', category: recessedLightingPlaybook.assetCategory, now: NOW });
  const inspectionCase = createInspectionCase({ caseId: 'case-1', playbook: recessedLightingPlaybook, assetId: asset.assetId, now: NOW });
  await saveOpsAssetPassport(db, asset);
  await saveOpsInspectionCase(db, inspectionCase);
  await saveOpsEvidenceArtifact(db, { artifactId: 'evidence-1', caseId: inspectionCase.caseId, requestId: 'room-wide-context', kind: 'photo', sourceClass: 'operator_observed', fileName: 'room.jpg', mimeType: 'image/jpeg', sizeBytes: 5, capturedAt: NOW, notes: null, blob: new Blob(['hello'], { type: 'image/jpeg' }) });
  return db;
}

test('analysis return appends pending claims while preserving work added after submission', async () => {
  const db = await seededDb();
  try {
    const submission = await createOpsAnalysisSubmission(db, 'case-1', 'Compare visible fixture families.', NOW);
    await saveOpsObservation(db, createObservation({ observationId: 'new-local-work', caseId: 'case-1', kind: 'direct_observation', text: 'A second fixture failed after submission.', sourceClass: 'operator_observed', recordedAt: '2026-07-12T13:00:00.000Z' }));
    const analysisReturn = {
      ...submission.returnTemplate,
      responseId: 'response-1',
      analyzedAt: '2026-07-12T14:00:00.000Z',
      analyst: 'BAM',
      claims: [{ claimId: 'claim-1', text: 'Two visually distinct trim families appear present.', confidence: 'probable' as const, evidenceArtifactIds: ['evidence-1'], rationale: 'Trim profile and aperture differ.' }],
    };

    const first = await importOpsAnalysisReturn(db, analysisReturn, '2026-07-12T15:00:00.000Z');
    assert.equal(first.alreadyImported, false);
    assert.equal(first.receipt.caseAdvancedSinceSubmission, true);
    const observations = await listOpsObservations(db, 'case-1');
    assert.equal(observations.length, 2);
    assert.equal(observations.find((entry) => entry.observationId === 'new-local-work')?.text, 'A second fixture failed after submission.');
    const claim = observations.find((entry) => entry.analysisClaimId === 'claim-1');
    assert.equal(claim?.analysisReviewStatus, 'pending');
    assert.equal(claim?.sourceClass, 'subscription_assisted_analysis');

    const duplicate = await importOpsAnalysisReturn(db, analysisReturn);
    assert.equal(duplicate.alreadyImported, true);
    assert.equal((await listOpsObservations(db, 'case-1')).length, 2);

    const accepted = await reviewAnalysisObservation(db, claim!.observationId, 'accepted');
    assert.equal(accepted.analysisReviewStatus, 'accepted');
  } finally {
    db.close();
  }
});

test('analysis return rejects evidence that was not in the frozen submission', async () => {
  const db = await seededDb();
  try {
    const submission = await createOpsAnalysisSubmission(db, 'case-1', 'Inspect the evidence.', NOW);
    await assert.rejects(
      () => importOpsAnalysisReturn(db, {
        ...submission.returnTemplate,
        responseId: 'response-bad',
        claims: [{ claimId: 'claim-bad', text: 'Unsupported claim', confidence: 'possible', evidenceArtifactIds: ['not-submitted'], rationale: null }],
      }),
      /unknown evidence/,
    );
  } finally {
    db.close();
  }
});
