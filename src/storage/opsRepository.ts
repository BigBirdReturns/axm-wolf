import type {
  EvidenceArtifact,
  OpsAssetPassport,
  OpsInspectionCase,
  OpsObservation,
  OpsWorkOrder,
  OpsAnalysisReceipt,
} from '../ops/types.js';
import type { StoredOpsSubmission } from './opsExchange.js';
import type { StoreName, WolfDb } from './db.js';

export async function saveOpsInspectionCase(db: WolfDb, inspectionCase: OpsInspectionCase): Promise<void> {
  await db.put('opsCases', inspectionCase);
}

export async function loadOpsInspectionCase(
  db: WolfDb,
  caseId: string,
): Promise<OpsInspectionCase | undefined> {
  return db.get<OpsInspectionCase>('opsCases', caseId);
}

export async function listOpsInspectionCases(db: WolfDb): Promise<OpsInspectionCase[]> {
  const cases = await db.getAll<OpsInspectionCase>('opsCases');
  return cases.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveOpsAssetPassport(db: WolfDb, asset: OpsAssetPassport): Promise<void> {
  await db.put('opsAssets', asset);
}

export async function loadOpsAssetPassport(
  db: WolfDb,
  assetId: string,
): Promise<OpsAssetPassport | undefined> {
  return db.get<OpsAssetPassport>('opsAssets', assetId);
}

export async function listOpsAssetPassports(db: WolfDb): Promise<OpsAssetPassport[]> {
  const assets = await db.getAll<OpsAssetPassport>('opsAssets');
  return assets.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveOpsCaseAndAsset(
  db: WolfDb,
  inspectionCase: OpsInspectionCase,
  asset: OpsAssetPassport,
): Promise<void> {
  if (inspectionCase.assetId !== asset.assetId) {
    throw new Error('Inspection case and asset passport must share an assetId');
  }
  await db.transaction(['opsCases', 'opsAssets'], 'readwrite', async (tx) => {
    await tx.put('opsAssets', asset);
    await tx.put('opsCases', inspectionCase);
  });
}

export async function saveOpsObservation(db: WolfDb, observation: OpsObservation): Promise<void> {
  await db.put('opsObservations', observation);
}

export async function listOpsObservations(
  db: WolfDb,
  caseId: string,
): Promise<OpsObservation[]> {
  const observations = await db.getAll<OpsObservation>('opsObservations');
  return observations
    .filter((observation) => observation.caseId === caseId)
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
}

export async function listAllOpsObservations(db: WolfDb): Promise<OpsObservation[]> {
  return db.getAll<OpsObservation>('opsObservations');
}

export async function saveOpsEvidenceArtifact(db: WolfDb, artifact: EvidenceArtifact): Promise<void> {
  await db.put('opsEvidence', artifact);
}

export async function commitOpsEvidenceCapture(
  db: WolfDb,
  artifact: EvidenceArtifact,
  inspectionCase: OpsInspectionCase,
  asset?: OpsAssetPassport,
): Promise<void> {
  if (artifact.caseId !== inspectionCase.caseId) {
    throw new Error('Evidence and inspection case must share a caseId');
  }
  if (asset && inspectionCase.assetId !== asset.assetId) {
    throw new Error('Inspection case and asset passport must share an assetId');
  }

  const storeNames: StoreName[] = asset
    ? ['opsCases', 'opsAssets', 'opsEvidence']
    : ['opsCases', 'opsEvidence'];
  await db.transaction(storeNames, 'readwrite', async (tx) => {
    await tx.put('opsEvidence', artifact);
    if (asset) await tx.put('opsAssets', asset);
    await tx.put('opsCases', inspectionCase);
  });
}

export async function listOpsEvidenceArtifacts(
  db: WolfDb,
  caseId: string,
): Promise<EvidenceArtifact[]> {
  const artifacts = await db.getAll<EvidenceArtifact>('opsEvidence');
  return artifacts
    .filter((artifact) => artifact.caseId === caseId)
    .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
}

export async function listAllOpsEvidenceArtifacts(db: WolfDb): Promise<EvidenceArtifact[]> {
  return db.getAll<EvidenceArtifact>('opsEvidence');
}

export async function saveOpsWorkOrder(db: WolfDb, workOrder: OpsWorkOrder): Promise<void> {
  await db.put('opsWorkOrders', workOrder);
}

export async function loadOpsWorkOrder(
  db: WolfDb,
  workOrderId: string,
): Promise<OpsWorkOrder | undefined> {
  return db.get<OpsWorkOrder>('opsWorkOrders', workOrderId);
}

export async function listAllOpsWorkOrders(db: WolfDb): Promise<OpsWorkOrder[]> {
  const workOrders = await db.getAll<OpsWorkOrder>('opsWorkOrders');
  return workOrders.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listOpsWorkOrders(db: WolfDb, caseId: string): Promise<OpsWorkOrder[]> {
  return (await listAllOpsWorkOrders(db)).filter((workOrder) => workOrder.caseId === caseId);
}

export async function deleteOpsInspectionCase(db: WolfDb, caseId: string): Promise<void> {
  await db.transaction(
    ['opsCases', 'opsObservations', 'opsEvidence', 'opsWorkOrders', 'opsSubmissions', 'opsAnalysisReturns'],
    'readwrite',
    async (tx) => {
    const observations = await tx.getAll<OpsObservation>('opsObservations');
    for (const observation of observations) {
      if (observation.caseId === caseId) {
        await tx.delete('opsObservations', observation.observationId);
      }
    }

    const artifacts = await tx.getAll<EvidenceArtifact>('opsEvidence');
    for (const artifact of artifacts) {
      if (artifact.caseId === caseId) await tx.delete('opsEvidence', artifact.artifactId);
    }
    const workOrders = await tx.getAll<OpsWorkOrder>('opsWorkOrders');
    for (const workOrder of workOrders) {
      if (workOrder.caseId === caseId) await tx.delete('opsWorkOrders', workOrder.workOrderId);
    }
    const submissions = await tx.getAll<StoredOpsSubmission>('opsSubmissions');
    for (const submission of submissions) {
      if (submission.caseId === caseId) await tx.delete('opsSubmissions', submission.submissionId);
    }
    const analysisReturns = await tx.getAll<OpsAnalysisReceipt>('opsAnalysisReturns');
    for (const receipt of analysisReturns) {
      if (receipt.caseId === caseId) await tx.delete('opsAnalysisReturns', receipt.responseId);
    }
    await tx.delete('opsCases', caseId);
    },
  );
}

export async function deleteOpsAssetPassport(db: WolfDb, assetId: string): Promise<void> {
  const cases = await listOpsInspectionCases(db);
  if (cases.some((inspectionCase) => inspectionCase.assetId === assetId)) {
    throw new Error('Cannot delete an asset passport while inspection cases still reference it');
  }
  await db.delete('opsAssets', assetId);
}
