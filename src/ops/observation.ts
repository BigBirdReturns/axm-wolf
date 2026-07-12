import type {
  EvidenceConfidence,
  EvidenceSourceClass,
  ObservationKind,
  OpsObservation,
} from './types.js';

export function createObservation(input: {
  observationId: string;
  caseId: string;
  assetId?: string | null;
  kind: ObservationKind;
  text: string;
  sourceClass: EvidenceSourceClass;
  sourceLabel?: string | null;
  confidence?: EvidenceConfidence;
  observedAt?: string;
  recordedAt?: string;
  evidenceArtifactIds?: string[];
  supersedesObservationId?: string | null;
}): OpsObservation {
  const text = input.text.trim();
  if (text.length === 0) throw new Error('An observation requires text');

  const recordedAt = input.recordedAt ?? new Date().toISOString();
  return {
    observationId: input.observationId,
    caseId: input.caseId,
    assetId: input.assetId ?? null,
    kind: input.kind,
    text,
    sourceClass: input.sourceClass,
    sourceLabel: normalizeOptionalText(input.sourceLabel),
    confidence: input.confidence ?? defaultConfidence(input.sourceClass, input.kind),
    observedAt: input.observedAt ?? recordedAt,
    recordedAt,
    evidenceArtifactIds: [...new Set(input.evidenceArtifactIds ?? [])],
    supersedesObservationId: input.supersedesObservationId ?? null,
    status: 'active',
  };
}

export function supersedeObservation(
  prior: OpsObservation,
  replacement: OpsObservation,
): { prior: OpsObservation; replacement: OpsObservation } {
  if (prior.caseId !== replacement.caseId) {
    throw new Error('A replacement observation must belong to the same case');
  }
  if (prior.status === 'superseded') {
    throw new Error('The prior observation is already superseded');
  }

  return {
    prior: { ...prior, status: 'superseded' },
    replacement: {
      ...replacement,
      supersedesObservationId: prior.observationId,
      status: 'active',
    },
  };
}

function defaultConfidence(
  sourceClass: EvidenceSourceClass,
  kind: ObservationKind,
): EvidenceConfidence {
  if (sourceClass === 'system_inferred' || kind === 'inference') return 'possible';
  if (sourceClass === 'operator_observed' || sourceClass === 'contractor_documented') return 'confirmed';
  if (sourceClass === 'manufacturer_documented' || sourceClass === 'official_source') return 'confirmed';
  return 'unknown';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}
