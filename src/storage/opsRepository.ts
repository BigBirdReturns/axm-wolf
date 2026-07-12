import type { EvidenceArtifact, OpsInspectionCase } from '../ops/types.js';
import type { WolfDb } from './db.js';

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

export async function saveOpsEvidenceArtifact(db: WolfDb, artifact: EvidenceArtifact): Promise<void> {
  await db.put('opsEvidence', artifact);
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

export async function deleteOpsInspectionCase(db: WolfDb, caseId: string): Promise<void> {
  await db.transaction(['opsCases', 'opsEvidence'], 'readwrite', async (tx) => {
    const artifacts = await tx.getAll<EvidenceArtifact>('opsEvidence');
    for (const artifact of artifacts) {
      if (artifact.caseId === caseId) await tx.delete('opsEvidence', artifact.artifactId);
    }
    await tx.delete('opsCases', caseId);
  });
}
