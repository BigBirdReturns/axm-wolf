import test from 'node:test';
import assert from 'node:assert/strict';

import { IDBFactory } from 'fake-indexeddb';

import {
  attachEvidenceToAsset,
  completeCaptureRequest,
  createAssetPassport,
  createInspectionCase,
  createObservation,
  recessedLightingPlaybook,
  type EvidenceArtifact,
} from '../../src/ops/index.js';
import { openWolfDb } from '../../src/storage/db.js';
import {
  commitOpsEvidenceCapture,
  deleteOpsAssetPassport,
  deleteOpsInspectionCase,
  listOpsAssetPassports,
  listOpsEvidenceArtifacts,
  listOpsInspectionCases,
  listOpsObservations,
  loadOpsAssetPassport,
  loadOpsInspectionCase,
  saveOpsAssetPassport,
  saveOpsCaseAndAsset,
  saveOpsEvidenceArtifact,
  saveOpsInspectionCase,
  saveOpsObservation,
} from '../../src/storage/opsRepository.js';

function freshFactory(): IDBFactory {
  return new IDBFactory();
}

const NOW = '2026-07-12T12:00:00.000Z';

test('asset, operational case, and media evidence survive an atomic local round trip', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const asset = createAssetPassport({
      assetId: 'asset-1',
      displayName: 'Unit B recessed lights',
      category: recessedLightingPlaybook.assetCategory,
      siteLabel: 'Lotus',
      locationLabel: 'Unit B living room',
      now: NOW,
    });
    let inspectionCase = createInspectionCase({
      caseId: 'case-1',
      playbook: recessedLightingPlaybook,
      siteLabel: 'Lotus',
      assetId: asset.assetId,
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
    inspectionCase = completeCaptureRequest(
      inspectionCase,
      recessedLightingPlaybook,
      artifact,
      NOW,
    );
    const evidencedAsset = attachEvidenceToAsset(asset, artifact.artifactId, NOW);

    await saveOpsCaseAndAsset(db, inspectionCase, asset);
    await commitOpsEvidenceCapture(db, artifact, inspectionCase, evidencedAsset);

    const loadedCase = await loadOpsInspectionCase(db, inspectionCase.caseId);
    const loadedAsset = await loadOpsAssetPassport(db, asset.assetId);
    const evidence = await listOpsEvidenceArtifacts(db, inspectionCase.caseId);

    assert.equal(loadedCase?.siteLabel, 'Lotus');
    assert.equal(loadedAsset?.displayName, 'Unit B recessed lights');
    assert.deepEqual(loadedAsset?.evidenceArtifactIds, ['artifact-1']);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0]?.fileName, 'ceiling.jpg');
    assert.equal(evidence[0]?.blob?.size, 4);
  } finally {
    db.close();
  }
});

test('assets and operational cases list most recently updated first', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    for (const [id, now] of [
      ['older', '2026-07-10T12:00:00.000Z'],
      ['newer', '2026-07-12T12:00:00.000Z'],
    ] as const) {
      await saveOpsInspectionCase(
        db,
        createInspectionCase({ caseId: id, playbook: recessedLightingPlaybook, now }),
      );
      await saveOpsAssetPassport(
        db,
        createAssetPassport({
          assetId: `asset-${id}`,
          displayName: id,
          category: recessedLightingPlaybook.assetCategory,
          now,
        }),
      );
    }

    assert.deepEqual((await listOpsInspectionCases(db)).map((entry) => entry.caseId), ['newer', 'older']);
    assert.deepEqual((await listOpsAssetPassports(db)).map((entry) => entry.assetId), ['asset-newer', 'asset-older']);
  } finally {
    db.close();
  }
});

test('observations preserve source separation and case ordering', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    await saveOpsObservation(
      db,
      createObservation({
        observationId: 'report',
        caseId: 'case-1',
        kind: 'reported_symptom',
        text: 'The fixture winked out last night.',
        sourceClass: 'occupant_reported',
        sourceLabel: 'Current occupant',
        observedAt: '2026-07-11T20:00:00.000Z',
        recordedAt: NOW,
      }),
    );
    await saveOpsObservation(
      db,
      createObservation({
        observationId: 'direct',
        caseId: 'case-1',
        kind: 'direct_observation',
        text: 'The fixture is dark while adjacent fixtures remain on.',
        sourceClass: 'operator_observed',
        observedAt: '2026-07-12T12:00:00.000Z',
        recordedAt: NOW,
      }),
    );

    const observations = await listOpsObservations(db, 'case-1');
    assert.deepEqual(observations.map((entry) => entry.observationId), ['report', 'direct']);
    assert.deepEqual(observations.map((entry) => entry.sourceClass), [
      'occupant_reported',
      'operator_observed',
    ]);
  } finally {
    db.close();
  }
});

test('deleting an operational case removes its observations and evidence but preserves its asset passport', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const asset = createAssetPassport({
      assetId: 'asset-shared',
      displayName: 'Shared lighting asset',
      category: recessedLightingPlaybook.assetCategory,
      now: NOW,
    });
    const first = createInspectionCase({
      caseId: 'first',
      playbook: recessedLightingPlaybook,
      assetId: asset.assetId,
      now: NOW,
    });
    const second = createInspectionCase({ caseId: 'second', playbook: recessedLightingPlaybook, now: NOW });
    await saveOpsAssetPassport(db, asset);
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
      await saveOpsObservation(
        db,
        createObservation({
          observationId: `observation-${caseId}`,
          caseId,
          kind: 'direct_observation',
          text: `Observation for ${caseId}`,
          sourceClass: 'operator_observed',
          recordedAt: NOW,
        }),
      );
    }

    await deleteOpsInspectionCase(db, 'first');

    assert.equal(await loadOpsInspectionCase(db, 'first'), undefined);
    assert.ok((await loadOpsInspectionCase(db, 'second')) !== undefined);
    assert.equal((await listOpsEvidenceArtifacts(db, 'first')).length, 0);
    assert.equal((await listOpsEvidenceArtifacts(db, 'second')).length, 1);
    assert.equal((await listOpsObservations(db, 'first')).length, 0);
    assert.equal((await listOpsObservations(db, 'second')).length, 1);
    assert.ok((await loadOpsAssetPassport(db, asset.assetId)) !== undefined);
  } finally {
    db.close();
  }
});

test('an asset passport cannot be deleted while an inspection case references it', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const asset = createAssetPassport({
      assetId: 'asset-1',
      displayName: 'Unit B lights',
      category: recessedLightingPlaybook.assetCategory,
      now: NOW,
    });
    await saveOpsAssetPassport(db, asset);
    await saveOpsInspectionCase(
      db,
      createInspectionCase({
        caseId: 'case-1',
        playbook: recessedLightingPlaybook,
        assetId: asset.assetId,
        now: NOW,
      }),
    );

    await assert.rejects(() => deleteOpsAssetPassport(db, asset.assetId), /still reference it/);
  } finally {
    db.close();
  }
});
