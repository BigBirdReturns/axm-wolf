import type {
  EvidenceArtifact,
  OpsAssetPassport,
  OpsInspectionCase,
  OpsObservation,
  OpsWorkOrder,
  OpsAnalysisReceipt,
} from '../ops/types.js';
import type { WolfDb, WolfTx } from './db.js';
import type { StoredOpsSubmission } from './opsExchange.js';
import {
  listAllOpsEvidenceArtifacts,
  listAllOpsObservations,
  listAllOpsWorkOrders,
  listOpsAssetPassports,
  listOpsInspectionCases,
} from './opsRepository.js';

type PortableEvidenceArtifact = Omit<EvidenceArtifact, 'blob'> & {
  blobBase64: string | null;
};

export type OpsArchive = {
  schemaVersion: 1;
  exportedAt: string;
  assets: OpsAssetPassport[];
  cases: OpsInspectionCase[];
  observations: OpsObservation[];
  evidence: PortableEvidenceArtifact[];
  workOrders: OpsWorkOrder[];
  submissions: StoredOpsSubmission[];
  analysisReturns: OpsAnalysisReceipt[];
};

const OPS_STORES = [
  'opsAssets',
  'opsCases',
  'opsObservations',
  'opsEvidence',
  'opsWorkOrders',
  'opsSubmissions',
  'opsAnalysisReturns',
] as const;

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function rejectUnsafeKeys(value: unknown, path = 'archive'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectUnsafeKeys(entry, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (UNSAFE_KEYS.has(key)) throw new Error(`Ops archive contains unsafe key ${path}.${key}`);
    rejectUnsafeKeys(entry, `${path}.${key}`);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function portableEvidence(artifact: EvidenceArtifact): Promise<PortableEvidenceArtifact> {
  const { blob, ...metadata } = artifact;
  return {
    ...metadata,
    blobBase64: blob ? bytesToBase64(new Uint8Array(await blob.arrayBuffer())) : null,
  };
}

export async function exportOpsArchive(
  db: WolfDb,
  exportedAt = new Date().toISOString(),
): Promise<OpsArchive> {
  const [assets, cases, observations, artifacts, workOrders, submissions, analysisReturns] = await Promise.all([
    listOpsAssetPassports(db),
    listOpsInspectionCases(db),
    listAllOpsObservations(db),
    listAllOpsEvidenceArtifacts(db),
    listAllOpsWorkOrders(db),
    db.getAll<StoredOpsSubmission>('opsSubmissions'),
    db.getAll<OpsAnalysisReceipt>('opsAnalysisReturns'),
  ]);
  return {
    schemaVersion: 1,
    exportedAt,
    assets,
    cases,
    observations,
    evidence: await Promise.all(artifacts.map(portableEvidence)),
    workOrders,
    submissions,
    analysisReturns,
  };
}

function requireObjectArray(value: unknown, field: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.some((entry) => entry === null || typeof entry !== 'object')) {
    throw new Error(`Ops archive ${field} must be an array of objects`);
  }
  return value as Array<Record<string, unknown>>;
}

function requireUnique(rows: Array<Record<string, unknown>>, key: string, field: string): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row[key];
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error(`Ops archive ${field} contains an invalid ${key}`);
    }
    if (ids.has(id)) throw new Error(`Ops archive ${field} contains duplicate ${key} ${id}`);
    ids.add(id);
  }
  return ids;
}

function requireStrings(row: Record<string, unknown>, field: string, keys: string[]): void {
  for (const key of keys) {
    if (typeof row[key] !== 'string' || String(row[key]).trim().length === 0) {
      throw new Error(`Ops archive ${field} contains an invalid ${key}`);
    }
  }
}

export function parseOpsArchive(input: unknown): OpsArchive {
  if (input === null || typeof input !== 'object') throw new Error('Ops archive must be an object');
  rejectUnsafeKeys(input);
  const root = input as Record<string, unknown>;
  if (root.schemaVersion !== 1) throw new Error('Unsupported Ops archive schema version');
  if (typeof root.exportedAt !== 'string' || !Number.isFinite(Date.parse(root.exportedAt))) {
    throw new Error('Ops archive exportedAt must be an ISO timestamp');
  }

  const assets = requireObjectArray(root.assets, 'assets');
  const cases = requireObjectArray(root.cases, 'cases');
  const observations = requireObjectArray(root.observations, 'observations');
  const evidence = requireObjectArray(root.evidence, 'evidence');
  const workOrders = requireObjectArray(root.workOrders, 'workOrders');
  const submissions = root.submissions === undefined ? [] : requireObjectArray(root.submissions, 'submissions');
  const analysisReturns = root.analysisReturns === undefined ? [] : requireObjectArray(root.analysisReturns, 'analysisReturns');
  const assetIds = requireUnique(assets, 'assetId', 'assets');
  const caseIds = requireUnique(cases, 'caseId', 'cases');
  requireUnique(observations, 'observationId', 'observations');
  requireUnique(evidence, 'artifactId', 'evidence');
  requireUnique(workOrders, 'workOrderId', 'workOrders');
  requireUnique(submissions, 'submissionId', 'submissions');
  requireUnique(analysisReturns, 'responseId', 'analysisReturns');

  for (const asset of assets) requireStrings(asset, 'assets', ['displayName', 'category', 'updatedAt']);
  for (const inspectionCase of cases) {
    requireStrings(inspectionCase, 'cases', ['playbookId', 'playbookVersion', 'title', 'status', 'updatedAt']);
  }
  for (const observation of observations) {
    requireStrings(observation, 'observations', ['kind', 'text', 'sourceClass', 'recordedAt']);
  }
  for (const artifact of evidence) {
    requireStrings(artifact, 'evidence', ['requestId', 'kind', 'sourceClass', 'capturedAt']);
  }
  for (const workOrder of workOrders) {
    requireStrings(workOrder, 'workOrders', ['issueCode', 'title', 'status', 'openedAt', 'updatedAt']);
  }

  for (const inspectionCase of cases) {
    if (inspectionCase.assetId !== null && !assetIds.has(String(inspectionCase.assetId))) {
      throw new Error(`Inspection case ${inspectionCase.caseId} references a missing asset`);
    }
  }
  for (const [field, rows] of [
    ['observation', observations],
    ['evidence artifact', evidence],
    ['work order', workOrders],
  ] as const) {
    for (const row of rows) {
      if (!caseIds.has(String(row.caseId))) {
        throw new Error(`Ops archive ${field} ${String(Object.values(row)[0])} references a missing case`);
      }
    }
  }
  for (const artifact of evidence) {
    if (artifact.blobBase64 !== null && typeof artifact.blobBase64 !== 'string') {
      throw new Error('Ops archive evidence blobBase64 must be a string or null');
    }
  }
  return { ...root, submissions, analysisReturns } as OpsArchive;
}

async function clearStore(tx: WolfTx, store: (typeof OPS_STORES)[number], key: string): Promise<void> {
  const rows = await tx.getAll<Record<string, unknown>>(store);
  for (const row of rows) await tx.delete(store, row[key] as string);
}

export async function importOpsArchive(db: WolfDb, input: unknown): Promise<OpsArchive> {
  const archive = parseOpsArchive(input);
  const artifacts: EvidenceArtifact[] = archive.evidence.map(({ blobBase64, ...metadata }) => ({
    ...metadata,
    blob: blobBase64
      ? new Blob([base64ToArrayBuffer(blobBase64)], { type: metadata.mimeType ?? '' })
      : null,
  }));

  await db.transaction([...OPS_STORES], 'readwrite', async (tx) => {
    await clearStore(tx, 'opsAnalysisReturns', 'responseId');
    await clearStore(tx, 'opsSubmissions', 'submissionId');
    await clearStore(tx, 'opsWorkOrders', 'workOrderId');
    await clearStore(tx, 'opsEvidence', 'artifactId');
    await clearStore(tx, 'opsObservations', 'observationId');
    await clearStore(tx, 'opsCases', 'caseId');
    await clearStore(tx, 'opsAssets', 'assetId');
    for (const asset of archive.assets) await tx.put('opsAssets', asset);
    for (const inspectionCase of archive.cases) await tx.put('opsCases', inspectionCase);
    for (const observation of archive.observations) await tx.put('opsObservations', observation);
    for (const artifact of artifacts) await tx.put('opsEvidence', artifact);
    for (const workOrder of archive.workOrders) await tx.put('opsWorkOrders', workOrder);
    for (const submission of archive.submissions) await tx.put('opsSubmissions', submission);
    for (const receipt of archive.analysisReturns) await tx.put('opsAnalysisReturns', receipt);
  });
  return archive;
}
