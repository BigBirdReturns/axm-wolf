import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

import {
  createAssetPassport,
  createInspectionCase,
  createObservation,
  createWorkOrder,
  recessedLightingPlaybook,
} from '../../src/ops/index.js';
import { openWolfDb } from '../../src/storage/db.js';
import { exportOpsArchive, importOpsArchive, parseOpsArchive } from '../../src/storage/opsArchive.js';
import {
  listOpsEvidenceArtifacts,
  listOpsWorkOrders,
  loadOpsAssetPassport,
  saveOpsAssetPassport,
  saveOpsEvidenceArtifact,
  saveOpsInspectionCase,
  saveOpsObservation,
  saveOpsWorkOrder,
} from '../../src/storage/opsRepository.js';

const NOW = '2026-07-12T12:00:00.000Z';

test('Ops archive round-trips assets, cases, observations, work orders, and Blob bytes', async () => {
  const source = await openWolfDb(new IDBFactory());
  const target = await openWolfDb(new IDBFactory());
  try {
    const asset = createAssetPassport({ assetId: 'asset-1', displayName: 'Lights', category: recessedLightingPlaybook.assetCategory, now: NOW });
    const inspectionCase = createInspectionCase({ caseId: 'case-1', playbook: recessedLightingPlaybook, assetId: asset.assetId, now: NOW });
    await saveOpsAssetPassport(source, asset);
    await saveOpsInspectionCase(source, inspectionCase);
    await saveOpsObservation(source, createObservation({ observationId: 'obs-1', caseId: inspectionCase.caseId, assetId: asset.assetId, kind: 'reported_symptom', text: 'Winks out when warm.', sourceClass: 'occupant_reported', recordedAt: NOW }));
    await saveOpsEvidenceArtifact(source, { artifactId: 'evidence-1', caseId: inspectionCase.caseId, requestId: 'room-wide-context', kind: 'photo', sourceClass: 'operator_observed', fileName: 'room.jpg', mimeType: 'image/jpeg', sizeBytes: 5, capturedAt: NOW, notes: null, blob: new Blob(['hello'], { type: 'image/jpeg' }) });
    await saveOpsWorkOrder(source, createWorkOrder({ workOrderId: 'work-1', caseId: inspectionCase.caseId, assetId: asset.assetId, issueCode: 'lighting.intermittent', title: 'Diagnose lights', openedAt: NOW }));

    const archive = await exportOpsArchive(source, NOW);
    assert.ok((archive.evidence[0]?.blobBase64?.length ?? 0) > 0);
    await importOpsArchive(target, JSON.parse(JSON.stringify(archive)) as unknown);

    assert.equal((await loadOpsAssetPassport(target, asset.assetId))?.displayName, 'Lights');
    assert.equal((await listOpsWorkOrders(target, inspectionCase.caseId))[0]?.issueCode, 'lighting.intermittent');
    const evidence = await listOpsEvidenceArtifacts(target, inspectionCase.caseId);
    assert.equal(await evidence[0]?.blob?.text(), 'hello');
  } finally {
    source.close();
    target.close();
  }
});

test('Ops archive rejects orphaned case references before replacing local data', () => {
  assert.throws(
    () => parseOpsArchive({ schemaVersion: 1, exportedAt: NOW, assets: [], cases: [], observations: [{ observationId: 'obs', caseId: 'missing', kind: 'reported_symptom', text: 'Orphaned report', sourceClass: 'occupant_reported', recordedAt: NOW }], evidence: [], workOrders: [] }),
    /missing case/,
  );
});

test('Ops archive rejects prototype-pollution keys', () => {
  assert.throws(
    () => parseOpsArchive(JSON.parse(`{"schemaVersion":1,"exportedAt":"${NOW}","assets":[],"cases":[],"observations":[],"evidence":[],"workOrders":[],"__proto__":{"polluted":true}}`) as unknown),
    /unsafe key/,
  );
});
