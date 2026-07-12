import type {
  CaptureRequest,
  EvidenceArtifact,
  FactCondition,
  FactProvenance,
  InspectionGuidance,
  InspectionPlaybook,
  OpsInspectionCase,
  ScalarFact,
} from './types.js';

const PRIORITY_ORDER: Record<CaptureRequest['priority'], number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function isMissing(value: ScalarFact | undefined): boolean {
  return value === undefined || value === null || value === '';
}

export function factConditionMatches(
  facts: Record<string, ScalarFact>,
  condition: FactCondition,
): boolean {
  const value = facts[condition.factKey];

  switch (condition.operator) {
    case 'missing':
      return isMissing(value);
    case 'present':
      return !isMissing(value);
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return !isMissing(value) && value !== condition.value;
  }
}

export function factConditionsMatch(
  facts: Record<string, ScalarFact>,
  conditions: FactCondition[] | undefined,
): boolean {
  return conditions === undefined || conditions.every((condition) => factConditionMatches(facts, condition));
}

export function createInspectionCase(input: {
  caseId: string;
  playbook: InspectionPlaybook;
  title?: string;
  siteLabel?: string | null;
  assetId?: string | null;
  now?: string;
}): OpsInspectionCase {
  const now = input.now ?? new Date().toISOString();
  return {
    caseId: input.caseId,
    playbookId: input.playbook.playbookId,
    playbookVersion: input.playbook.version,
    title: input.title ?? input.playbook.title,
    siteLabel: input.siteLabel ?? null,
    assetId: input.assetId ?? null,
    facts: {},
    factProvenance: {},
    completedRequestIds: [],
    skippedRequests: [],
    evidenceArtifactIds: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function setInspectionFact(
  inspectionCase: OpsInspectionCase,
  factKey: string,
  value: ScalarFact,
  now = new Date().toISOString(),
  provenance: Partial<FactProvenance> = {},
): OpsInspectionCase {
  const note = provenance.note?.trim() || null;
  const factProvenance: FactProvenance = {
    sourceClass: provenance.sourceClass ?? 'operator_observed',
    recordedAt: provenance.recordedAt ?? now,
    evidenceArtifactIds: [...new Set(provenance.evidenceArtifactIds ?? [])],
    note,
  };

  return {
    ...inspectionCase,
    facts: { ...inspectionCase.facts, [factKey]: value },
    factProvenance: {
      ...(inspectionCase.factProvenance ?? {}),
      [factKey]: factProvenance,
    },
    status: inspectionCase.status === 'draft' ? 'capturing' : inspectionCase.status,
    updatedAt: now,
  };
}

export function completeCaptureRequest(
  inspectionCase: OpsInspectionCase,
  playbook: InspectionPlaybook,
  artifact: EvidenceArtifact,
  now = artifact.capturedAt,
): OpsInspectionCase {
  if (artifact.caseId !== inspectionCase.caseId) {
    throw new Error(`Evidence ${artifact.artifactId} belongs to a different inspection case`);
  }
  if (!playbook.captureRequests.some((request) => request.requestId === artifact.requestId)) {
    throw new Error(`Unknown capture request ${artifact.requestId}`);
  }

  const completedRequestIds = inspectionCase.completedRequestIds.includes(artifact.requestId)
    ? inspectionCase.completedRequestIds
    : [...inspectionCase.completedRequestIds, artifact.requestId];
  const evidenceArtifactIds = inspectionCase.evidenceArtifactIds.includes(artifact.artifactId)
    ? inspectionCase.evidenceArtifactIds
    : [...inspectionCase.evidenceArtifactIds, artifact.artifactId];

  return {
    ...inspectionCase,
    completedRequestIds,
    evidenceArtifactIds,
    skippedRequests: inspectionCase.skippedRequests.filter((entry) => entry.requestId !== artifact.requestId),
    status: 'capturing',
    updatedAt: now,
  };
}

export function skipCaptureRequest(
  inspectionCase: OpsInspectionCase,
  playbook: InspectionPlaybook,
  requestId: string,
  reason: string,
  now = new Date().toISOString(),
): OpsInspectionCase {
  if (!playbook.captureRequests.some((request) => request.requestId === requestId)) {
    throw new Error(`Unknown capture request ${requestId}`);
  }
  if (reason.trim().length === 0) {
    throw new Error('A skipped capture request requires a reason');
  }

  return {
    ...inspectionCase,
    skippedRequests: [
      ...inspectionCase.skippedRequests.filter((entry) => entry.requestId !== requestId),
      { requestId, reason: reason.trim(), skippedAt: now },
    ],
    status: 'capturing',
    updatedAt: now,
  };
}

export function reopenCaptureRequest(
  inspectionCase: OpsInspectionCase,
  requestId: string,
  now = new Date().toISOString(),
): OpsInspectionCase {
  return {
    ...inspectionCase,
    completedRequestIds: inspectionCase.completedRequestIds.filter((id) => id !== requestId),
    skippedRequests: inspectionCase.skippedRequests.filter((entry) => entry.requestId !== requestId),
    status: 'capturing',
    updatedAt: now,
  };
}

export function buildInspectionGuidance(
  playbook: InspectionPlaybook,
  inspectionCase: OpsInspectionCase,
): InspectionGuidance {
  if (inspectionCase.playbookId !== playbook.playbookId) {
    throw new Error(`Inspection case ${inspectionCase.caseId} does not use playbook ${playbook.playbookId}`);
  }

  const blockers = playbook.hazardRules.filter((rule) => factConditionsMatch(inspectionCase.facts, rule.when));
  const completedIds = new Set(inspectionCase.completedRequestIds);
  const skippedIds = new Set(inspectionCase.skippedRequests.map((entry) => entry.requestId));
  const eligible = playbook.captureRequests.filter((request) =>
    factConditionsMatch(inspectionCase.facts, request.when),
  );
  const pendingRequests = eligible
    .filter((request) => !completedIds.has(request.requestId) && !skippedIds.has(request.requestId))
    .map((request, sourceIndex) => ({ request, sourceIndex }))
    .sort((left, right) => {
      const priorityDelta = PRIORITY_ORDER[left.request.priority] - PRIORITY_ORDER[right.request.priority];
      return priorityDelta === 0 ? left.sourceIndex - right.sourceIndex : priorityDelta;
    })
    .map(({ request }) => request);

  const completedRequests = playbook.captureRequests.filter((request) => completedIds.has(request.requestId));
  const skippedRequests = playbook.captureRequests.filter((request) => skippedIds.has(request.requestId));
  const missingRequiredFact = playbook.factPrompts.some(
    (prompt) => prompt.required && isMissing(inspectionCase.facts[prompt.factKey]),
  );
  const captureBlocked = missingRequiredFact || blockers.some((rule) => rule.blocksCapture);

  return {
    blockers,
    nextRequest: captureBlocked ? null : (pendingRequests[0] ?? null),
    pendingRequests,
    completedRequests,
    skippedRequests,
    readyForReview: !captureBlocked && pendingRequests.length === 0,
  };
}

export function markInspectionReadyForReview(
  inspectionCase: OpsInspectionCase,
  playbook: InspectionPlaybook,
  now = new Date().toISOString(),
): OpsInspectionCase {
  const guidance = buildInspectionGuidance(playbook, inspectionCase);
  if (!guidance.readyForReview) {
    throw new Error('Inspection cannot be marked ready while required facts, capture requests, or safety blockers remain');
  }
  return { ...inspectionCase, status: 'ready_for_review', updatedAt: now };
}
