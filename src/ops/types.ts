export type EvidenceBasis =
  | 'direct_observation'
  | 'reported'
  | 'documented'
  | 'external_source'
  | 'inferred'
  | 'awaiting_confirmation';

export type EvidenceKind =
  | 'photo'
  | 'video'
  | 'document'
  | 'invoice'
  | 'manual'
  | 'measurement'
  | 'transcript'
  | 'note';

export type CaptureMode = 'photo' | 'video' | 'document' | 'measurement' | 'spoken_answer';

export type CaptureExecutor = 'subject' | 'staff' | 'contractor' | 'licensed_professional';

export type AssetValue = string | number | boolean | null;

export type EvidenceArtifact = {
  evidenceId: string;
  kind: EvidenceKind;
  basis: EvidenceBasis;
  capturedAt: string;
  capturedBy: string;
  localRef: string;
  description: string;
  sha256?: string | null;
  metadata?: Record<string, AssetValue>;
};

export type Observation = {
  observationId: string;
  subjectRef: string;
  statement: string;
  basis: EvidenceBasis;
  evidenceIds: string[];
  confidence: number;
  observedAt: string;
};

export type AssetPassport = {
  assetId: string;
  siteId: string;
  label: string;
  category: string;
  location: string;
  make?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  attributes: Record<string, AssetValue>;
  evidenceIds: string[];
  updatedAt: string;
};

export type InspectionRequirement = {
  requirementId: string;
  prompt: string;
  rationale: string;
  captureMode: CaptureMode;
  executor: CaptureExecutor;
  targetFields: string[];
  expectedUncertaintyReduction: number;
  decisionConsequence: number;
  effort: number;
  safetyRisk: number;
  blocking?: boolean;
};

export type InspectionTemplate = {
  templateId: string;
  label: string;
  assetCategory: string;
  requirements: InspectionRequirement[];
};

export type CaptureRequest = InspectionRequirement & {
  missingFields: string[];
  informationValue: number;
  safeForSubject: boolean;
};

export type InspectionPlan = {
  templateId: string;
  assetId: string;
  complete: boolean;
  nextRequest: CaptureRequest | null;
  requests: CaptureRequest[];
  blockedByProfessional: boolean;
};

export type MoneyRange = {
  currency: string;
  low: number;
  high: number;
};

export type DecisionMetrics = {
  initialCost: MoneyRange;
  fiveYearCost: MoneyRange;
  ownerAttentionHours: number;
  recurrenceRisk: number;
  disruption: number;
  complianceRisk: number;
  reversibility: number;
  evidenceConfidence: number;
};

export type OptionAvailability = 'live' | 'conditional' | 'blocked';

export type DecisionOption = {
  optionId: string;
  title: string;
  description: string;
  availability: OptionAvailability;
  condition?: string | null;
  assumptions: string[];
  advantages: string[];
  tradeoffs: string[];
  requiredEvidenceIds: string[];
  requiresProfessional: boolean;
  metrics: DecisionMetrics;
};

export type HypothesisStatus = 'open' | 'supported' | 'weakened' | 'ruled_out';

export type DecisionHypothesis = {
  hypothesisId: string;
  statement: string;
  status: HypothesisStatus;
  evidenceFor: string[];
  evidenceAgainst: string[];
};

export type DecisionCase = {
  caseId: string;
  title: string;
  assetIds: string[];
  hypotheses: DecisionHypothesis[];
  options: DecisionOption[];
  evidenceIds: string[];
  reopeningTriggers: string[];
};

export type DecisionPreferenceWeights = {
  fiveYearCost: number;
  ownerAttentionHours: number;
  recurrenceRisk: number;
  disruption: number;
  complianceRisk: number;
  reversibility: number;
  evidenceConfidence: number;
};

export type EvaluatedDecisionOption = DecisionOption & {
  weightedScore: number;
  paretoEfficient: boolean;
};

export type DecisionEvaluation = {
  frontier: EvaluatedDecisionOption[];
  ranked: EvaluatedDecisionOption[];
  blocked: DecisionOption[];
};

export type WorkOrderStatus =
  | 'observed'
  | 'classified'
  | 'triaged'
  | 'assigned'
  | 'temporarily_stabilized'
  | 'verified'
  | 'closed';

export type ResolutionKind = 'none' | 'temporary' | 'durable';

export type WorkOrderHistoryEntry = {
  from: WorkOrderStatus | null;
  to: WorkOrderStatus;
  at: string;
  actor: string;
  note: string;
  evidenceIds: string[];
};

export type WorkOrder = {
  workOrderId: string;
  assetId: string | null;
  summary: string;
  status: WorkOrderStatus;
  resolutionKind: ResolutionKind;
  owner: string | null;
  dueAt: string | null;
  evidenceIds: string[];
  verificationEvidenceIds: string[];
  updatedAt: string;
  history: WorkOrderHistoryEntry[];
};

export type WorkOrderTransition = {
  at: string;
  actor: string;
  note: string;
  resolutionKind?: ResolutionKind;
  owner?: string | null;
  dueAt?: string | null;
  evidenceIds?: string[];
};

export type ProcedureStatus = 'provisional' | 'confirmed';

export type MaintenanceProcedure = {
  procedureId: string;
  assetCategory: string;
  title: string;
  preventedFailure: string;
  steps: string[];
  intervalDays: number | null;
  trigger: string | null;
  assignedRole: string;
  safetyBoundary: string;
  closureEvidence: string[];
  status: ProcedureStatus;
  sourceEvidenceIds: string[];
};
