export type ScalarFact = string | number | boolean | null;

export type EvidenceKind = 'photo' | 'video' | 'document' | 'measurement' | 'statement';

export type EvidenceSourceClass =
  | 'operator_observed'
  | 'occupant_reported'
  | 'contractor_documented'
  | 'manufacturer_documented'
  | 'official_source'
  | 'system_inferred';

export type EvidenceConfidence = 'confirmed' | 'probable' | 'possible' | 'unknown';

export type EvidencePriority = 'critical' | 'high' | 'normal' | 'low';

export type CaptureSafety = 'routine' | 'power_off' | 'licensed_trade' | 'stop_and_escalate';

export type InspectionStatus = 'draft' | 'capturing' | 'ready_for_review' | 'closed';

export type FactProvenance = {
  sourceClass: EvidenceSourceClass;
  recordedAt: string;
  evidenceArtifactIds: string[];
  note: string | null;
};

export type FactCondition =
  | { factKey: string; operator: 'missing' | 'present' }
  | { factKey: string; operator: 'equals' | 'not_equals'; value: ScalarFact };

export type FactPrompt = {
  factKey: string;
  label: string;
  help?: string | null;
  kind: 'boolean' | 'choice' | 'text';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
};

export type CaptureRequest = {
  requestId: string;
  label: string;
  instruction: string;
  purpose: string;
  acceptedKinds: EvidenceKind[];
  priority: EvidencePriority;
  safety: CaptureSafety;
  resolves: string[];
  when?: FactCondition[];
};

export type HazardRule = {
  ruleId: string;
  label: string;
  message: string;
  severity: 'caution' | 'urgent' | 'emergency';
  blocksCapture: boolean;
  when: FactCondition[];
};

export type InspectionPlaybook = {
  playbookId: string;
  version: string;
  title: string;
  summary: string;
  assetCategory: string;
  factPrompts: FactPrompt[];
  hazardRules: HazardRule[];
  captureRequests: CaptureRequest[];
};

export type SkippedCaptureRequest = {
  requestId: string;
  reason: string;
  skippedAt: string;
};

export type OpsInspectionCase = {
  caseId: string;
  playbookId: string;
  playbookVersion: string;
  title: string;
  siteLabel: string | null;
  assetId: string | null;
  facts: Record<string, ScalarFact>;
  factProvenance: Record<string, FactProvenance>;
  completedRequestIds: string[];
  skippedRequests: SkippedCaptureRequest[];
  evidenceArtifactIds: string[];
  status: InspectionStatus;
  createdAt: string;
  updatedAt: string;
};

export type AssetStatus = 'active' | 'out_of_service' | 'retired' | 'unknown';

export type OpsAssetPassport = {
  assetId: string;
  displayName: string;
  category: string;
  siteLabel: string | null;
  locationLabel: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  installedAt: string | null;
  status: AssetStatus;
  attributes: Record<string, ScalarFact>;
  evidenceArtifactIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ObservationKind =
  | 'direct_observation'
  | 'reported_symptom'
  | 'documented_fact'
  | 'measurement'
  | 'inference';

export type ObservationStatus = 'active' | 'superseded';

export type OpsObservation = {
  observationId: string;
  caseId: string;
  assetId: string | null;
  kind: ObservationKind;
  text: string;
  sourceClass: EvidenceSourceClass;
  sourceLabel: string | null;
  confidence: EvidenceConfidence;
  observedAt: string;
  recordedAt: string;
  evidenceArtifactIds: string[];
  supersedesObservationId: string | null;
  status: ObservationStatus;
};

export type EvidenceArtifact = {
  artifactId: string;
  caseId: string;
  requestId: string;
  kind: EvidenceKind;
  sourceClass: EvidenceSourceClass;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  capturedAt: string;
  notes: string | null;
  blob?: Blob | null;
};

export type InspectionGuidance = {
  blockers: HazardRule[];
  nextRequest: CaptureRequest | null;
  pendingRequests: CaptureRequest[];
  completedRequests: CaptureRequest[];
  skippedRequests: CaptureRequest[];
  readyForReview: boolean;
};

export type MetricDirection = 'minimize' | 'maximize';

export type DecisionMetricDefinition = {
  metricId: string;
  label: string;
  description: string;
  direction: MetricDirection;
  weight: number;
  unit?: string | null;
};

export type DecisionOption = {
  optionId: string;
  label: string;
  summary: string;
  metricValues: Record<string, number | null>;
  evidenceConfidence: number;
  benefits: string[];
  burdens: string[];
  assumptions: string[];
  reopeningTriggers: string[];
};

export type DecisionCase = {
  decisionCaseId: string;
  title: string;
  context: string;
  metrics: DecisionMetricDefinition[];
  options: DecisionOption[];
};

export type EvaluatedDecisionOption = DecisionOption & {
  normalizedValues: Record<string, number | null>;
  weightedScore: number | null;
  missingMetricIds: string[];
  dominatedByOptionIds: string[];
  onParetoFrontier: boolean;
};

export type DecisionEvaluation = {
  decisionCaseId: string;
  frontierOptionIds: string[];
  options: EvaluatedDecisionOption[];
};

export type WorkOrderStatus =
  | 'observed'
  | 'classified'
  | 'triaged'
  | 'assigned'
  | 'stabilized'
  | 'verified'
  | 'closed'
  | 'cancelled';

export type WorkOrderTransition = {
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  at: string;
  actor: string;
  note: string | null;
  evidenceIds: string[];
};

export type OpsWorkOrder = {
  workOrderId: string;
  caseId: string;
  assetId: string | null;
  issueCode: string;
  title: string;
  status: WorkOrderStatus;
  openedAt: string;
  updatedAt: string;
  assignedTo: string | null;
  recurrenceOfWorkOrderIds: string[];
  stabilizationNote: string | null;
  verificationTest: string | null;
  verificationEvidenceIds: string[];
  followUpCompleted: boolean;
  transitions: WorkOrderTransition[];
};

export type WorkOrderTransitionInput = {
  to: WorkOrderStatus;
  at: string;
  actor: string;
  note?: string | null;
  evidenceIds?: string[];
  assignedTo?: string | null;
  verificationTest?: string | null;
  followUpCompleted?: boolean;
};

export type RecurrenceMatch = {
  workOrderId: string;
  openedAt: string;
  status: WorkOrderStatus;
};
