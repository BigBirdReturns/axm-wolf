import { createObservation } from '../ops/observation.js';
import type {
  EvidenceArtifact,
  OpsAnalysisReceipt,
  OpsAnalysisReturn,
  OpsAssetPassport,
  OpsInspectionCase,
  OpsObservation,
  OpsWorkOrder,
} from '../ops/types.js';
import type { WolfDb } from './db.js';
import {
  listOpsEvidenceArtifacts,
  listOpsObservations,
  listOpsWorkOrders,
  loadOpsAssetPassport,
  loadOpsInspectionCase,
} from './opsRepository.js';

type PortableEvidence = Omit<EvidenceArtifact, 'blob'> & {
  blobBase64: string | null;
  contentDigest: string | null;
};

type AnalysisSnapshot = {
  inspectionCase: OpsInspectionCase;
  asset: OpsAssetPassport | null;
  observations: OpsObservation[];
  evidence: PortableEvidence[];
  workOrders: OpsWorkOrder[];
};

export type OpsAnalysisSubmission = {
  schemaVersion: 1;
  kind: 'wolf-analysis-submission';
  submissionId: string;
  caseId: string;
  createdAt: string;
  baseCaseDigest: string;
  analysisRequest: string;
  snapshot: AnalysisSnapshot;
  returnInstructions: string;
  returnTemplate: OpsAnalysisReturn;
};

export type StoredOpsSubmission = {
  submissionId: string;
  caseId: string;
  createdAt: string;
  baseCaseDigest: string;
  evidenceArtifactIds: string[];
};

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function rejectUnsafeKeys(value: unknown, path = 'return'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectUnsafeKeys(entry, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (UNSAFE_KEYS.has(key)) throw new Error(`Analysis return contains unsafe key ${path}.${key}`);
    rejectUnsafeKeys(entry, `${path}.${key}`);
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) result[key] = canonicalize(entry);
    }
    return result;
  }
  return value;
}

async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function portableEvidence(artifact: EvidenceArtifact): Promise<PortableEvidence> {
  const { blob, ...metadata } = artifact;
  if (!blob) return { ...metadata, blobBase64: null, contentDigest: null };
  const bytes = await blob.arrayBuffer();
  return {
    ...metadata,
    blobBase64: bytesToBase64(new Uint8Array(bytes)),
    contentDigest: await sha256(bytes),
  };
}

async function buildSnapshot(db: WolfDb, caseId: string): Promise<AnalysisSnapshot> {
  const inspectionCase = await loadOpsInspectionCase(db, caseId);
  if (!inspectionCase) throw new Error(`Inspection case ${caseId} is not available`);
  const [asset, observations, evidence, workOrders] = await Promise.all([
    inspectionCase.assetId ? loadOpsAssetPassport(db, inspectionCase.assetId) : undefined,
    listOpsObservations(db, caseId),
    listOpsEvidenceArtifacts(db, caseId),
    listOpsWorkOrders(db, caseId),
  ]);
  return {
    inspectionCase,
    asset: asset ?? null,
    observations,
    evidence: await Promise.all(evidence.map(portableEvidence)),
    workOrders,
  };
}

async function snapshotDigest(snapshot: AnalysisSnapshot): Promise<string> {
  return sha256(JSON.stringify(canonicalize(snapshot)));
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function createOpsAnalysisSubmission(
  db: WolfDb,
  caseId: string,
  analysisRequest: string,
  createdAt = new Date().toISOString(),
): Promise<OpsAnalysisSubmission> {
  if (analysisRequest.trim().length === 0) throw new Error('An analysis request is required');
  const snapshot = await buildSnapshot(db, caseId);
  const submissionId = id('submission');
  const baseCaseDigest = await snapshotDigest(snapshot);
  const returnTemplate: OpsAnalysisReturn = {
    schemaVersion: 1,
    kind: 'wolf-analysis-return',
    responseId: 'replace-with-stable-response-id',
    submissionId,
    caseId,
    baseCaseDigest,
    analyzedAt: new Date().toISOString(),
    analyst: 'name-or-service',
    method: 'subscription-assisted multimodal review',
    claims: [],
    nextEvidenceRequests: [],
    warnings: [],
  };
  const submission: OpsAnalysisSubmission = {
    schemaVersion: 1,
    kind: 'wolf-analysis-submission',
    submissionId,
    caseId,
    createdAt,
    baseCaseDigest,
    analysisRequest: analysisRequest.trim(),
    snapshot,
    returnInstructions:
      'Analyze only the supplied snapshot. Preserve uncertainty. Return valid JSON matching returnTemplate exactly; do not remove IDs or invent evidence references.',
    returnTemplate,
  };
  const stored: StoredOpsSubmission = {
    submissionId,
    caseId,
    createdAt,
    baseCaseDigest,
    evidenceArtifactIds: snapshot.evidence.map((artifact) => artifact.artifactId),
  };
  await db.put('opsSubmissions', stored);
  return submission;
}

function requiredString(root: Record<string, unknown>, key: string): string {
  const value = root[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Analysis return requires ${key}`);
  }
  return value;
}

export function parseOpsAnalysisReturn(input: unknown): OpsAnalysisReturn {
  if (input === null || typeof input !== 'object') throw new Error('Analysis return must be an object');
  rejectUnsafeKeys(input);
  const root = input as Record<string, unknown>;
  if (root.schemaVersion !== 1 || root.kind !== 'wolf-analysis-return') {
    throw new Error('Unsupported analysis return format');
  }
  for (const key of ['responseId', 'submissionId', 'caseId', 'baseCaseDigest', 'analyzedAt', 'analyst', 'method']) {
    requiredString(root, key);
  }
  if (!Number.isFinite(Date.parse(String(root.analyzedAt)))) throw new Error('Analysis return analyzedAt must be an ISO timestamp');
  if (!/^[a-f0-9]{64}$/.test(String(root.baseCaseDigest))) throw new Error('Analysis return baseCaseDigest is invalid');
  if (!Array.isArray(root.claims) || !Array.isArray(root.nextEvidenceRequests) || !Array.isArray(root.warnings)) {
    throw new Error('Analysis return claims, nextEvidenceRequests, and warnings must be arrays');
  }
  const claimIds = new Set<string>();
  for (const value of root.claims) {
    if (value === null || typeof value !== 'object') throw new Error('Analysis claims must be objects');
    const claim = value as Record<string, unknown>;
    const claimId = requiredString(claim, 'claimId');
    requiredString(claim, 'text');
    if (claimIds.has(claimId)) throw new Error(`Duplicate analysis claim ${claimId}`);
    claimIds.add(claimId);
    if (!Array.isArray(claim.evidenceArtifactIds)) throw new Error('Analysis claim evidenceArtifactIds must be an array');
    if (claim.evidenceArtifactIds.some((id) => typeof id !== 'string')) throw new Error('Analysis claim evidence IDs must be strings');
    if (!['confirmed', 'probable', 'possible', 'unknown'].includes(String(claim.confidence))) throw new Error('Analysis claim confidence is invalid');
    if (claim.rationale !== null && typeof claim.rationale !== 'string') throw new Error('Analysis claim rationale must be text or null');
  }
  for (const value of root.nextEvidenceRequests) {
    if (value === null || typeof value !== 'object') throw new Error('Follow-up evidence requests must be objects');
    const request = value as Record<string, unknown>;
    for (const key of ['requestId', 'label', 'instruction', 'purpose']) requiredString(request, key);
  }
  if (root.warnings.some((warning) => typeof warning !== 'string')) throw new Error('Analysis warnings must be strings');
  return input as OpsAnalysisReturn;
}

export async function importOpsAnalysisReturn(
  db: WolfDb,
  input: unknown,
  importedAt = new Date().toISOString(),
): Promise<{ receipt: OpsAnalysisReceipt; alreadyImported: boolean }> {
  const analysisReturn = parseOpsAnalysisReturn(input);
  const prior = await db.get<OpsAnalysisReceipt>('opsAnalysisReturns', analysisReturn.responseId);
  if (prior) return { receipt: prior, alreadyImported: true };
  const submission = await db.get<StoredOpsSubmission>('opsSubmissions', analysisReturn.submissionId);
  if (!submission) throw new Error('This analysis return does not match a submission created on this device');
  if (submission.caseId !== analysisReturn.caseId || submission.baseCaseDigest !== analysisReturn.baseCaseDigest) {
    throw new Error('Analysis return does not match the submitted case snapshot');
  }
  const allowedEvidence = new Set(submission.evidenceArtifactIds);
  for (const claim of analysisReturn.claims) {
    for (const artifactId of claim.evidenceArtifactIds) {
      if (!allowedEvidence.has(artifactId)) throw new Error(`Analysis claim references unknown evidence ${artifactId}`);
    }
  }
  const currentSnapshot = await buildSnapshot(db, analysisReturn.caseId);
  const caseAdvancedSinceSubmission = (await snapshotDigest(currentSnapshot)) !== submission.baseCaseDigest;
  const receipt: OpsAnalysisReceipt = {
    responseId: analysisReturn.responseId,
    submissionId: analysisReturn.submissionId,
    caseId: analysisReturn.caseId,
    importedAt,
    caseAdvancedSinceSubmission,
    analysisReturn,
  };
  const observations = analysisReturn.claims.map((claim) => ({
    ...createObservation({
      observationId: `analysis-${analysisReturn.responseId}-${claim.claimId}`,
      caseId: analysisReturn.caseId,
      assetId: currentSnapshot.inspectionCase.assetId,
      kind: 'inference',
      text: claim.text,
      sourceClass: 'subscription_assisted_analysis',
      sourceLabel: `${analysisReturn.analyst} · ${analysisReturn.method}`,
      confidence: claim.confidence,
      observedAt: analysisReturn.analyzedAt,
      recordedAt: importedAt,
      evidenceArtifactIds: claim.evidenceArtifactIds,
    }),
    analysisResponseId: analysisReturn.responseId,
    analysisClaimId: claim.claimId,
    analysisReviewStatus: 'pending' as const,
  }));
  await db.transaction(['opsObservations', 'opsAnalysisReturns'], 'readwrite', async (tx) => {
    for (const observation of observations) await tx.put('opsObservations', observation);
    await tx.put('opsAnalysisReturns', receipt);
  });
  return { receipt, alreadyImported: false };
}

export async function reviewAnalysisObservation(
  db: WolfDb,
  observationId: string,
  review: 'accepted' | 'rejected',
): Promise<OpsObservation> {
  const observation = await db.get<OpsObservation>('opsObservations', observationId);
  if (!observation || observation.analysisReviewStatus !== 'pending') {
    throw new Error('Pending analysis observation not found');
  }
  const next = { ...observation, analysisReviewStatus: review };
  await db.put('opsObservations', next);
  return next;
}

export async function listOpsAnalysisReceipts(db: WolfDb, caseId: string): Promise<OpsAnalysisReceipt[]> {
  return (await db.getAll<OpsAnalysisReceipt>('opsAnalysisReturns'))
    .filter((receipt) => receipt.caseId === caseId)
    .sort((left, right) => right.importedAt.localeCompare(left.importedAt));
}
