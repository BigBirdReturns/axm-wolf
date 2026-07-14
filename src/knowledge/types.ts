export type KnowledgeDropKind =
  | 'symptom'
  | 'workaround'
  | 'constraint'
  | 'decision_rule'
  | 'unwritten_rule'
  | 'failure_mode'
  | 'exception'
  | 'success_condition';

export type KnowledgeDropVisibility = 'private' | 'workspace';

export type KnowledgeDropReviewStatus = 'pending' | 'confirmed' | 'corrected' | 'rejected';

export type KnowledgeDropSource = {
  recordId: string;
  promptId: string;
  revisionId: string;
  revisionDigest: string;
  offsetEncoding: 'utf16-code-unit';
  startOffset: number;
  endOffset: number;
  exactQuote: string;
  quoteDigest: string;
};

export type KnowledgeDropReviewEvent = {
  eventId: string;
  action: 'confirm' | 'correct' | 'reject' | 'keep_private';
  actor: string;
  at: string;
  priorStatus: KnowledgeDropReviewStatus;
  nextStatus: KnowledgeDropReviewStatus;
  priorVisibility: KnowledgeDropVisibility;
  nextVisibility: KnowledgeDropVisibility;
  priorText: string;
  nextText: string;
  priorKind: KnowledgeDropKind;
  nextKind: KnowledgeDropKind;
  note: string | null;
};

export type KnowledgeDrop = {
  schemaVersion: 1;
  dropId: string;
  source: KnowledgeDropSource;
  kind: KnowledgeDropKind;
  text: string;
  operationalPattern: string | null;
  reviewStatus: KnowledgeDropReviewStatus;
  visibility: KnowledgeDropVisibility;
  extractionMethod: 'human_marked' | 'deterministic' | 'subscription_assisted';
  version: number;
  createdAt: string;
  updatedAt: string;
  reviewHistory: KnowledgeDropReviewEvent[];
};

export type CreateKnowledgeDropCandidate = {
  dropId: string;
  kind: KnowledgeDropKind;
  startOffset: number;
  endOffset: number;
  text?: string;
  operationalPattern?: string | null;
  extractionMethod?: KnowledgeDrop['extractionMethod'];
};

export type KnowledgeDropReviewInput =
  | { action: 'confirm'; actor: string; at?: string; note?: string | null }
  | { action: 'correct'; actor: string; text: string; kind?: KnowledgeDropKind; operationalPattern?: string | null; at?: string; note?: string | null }
  | { action: 'reject'; actor: string; at?: string; note?: string | null }
  | { action: 'keep_private'; actor: string; at?: string; note?: string | null };

export type StoredKnowledgeDropReviewEvent = KnowledgeDropReviewEvent & {
  dropId: string;
  sequence: number;
  expectedPriorVersion: number;
  requestId: string;
  priorEventDigest: string | null;
  eventDigest: string;
};

export type CreateDropFromStoredRevisionInput = {
  recordId: string;
  promptId: string;
  revisionId: string;
  kind: KnowledgeDropKind;
  startOffset: number;
  endOffset: number;
  operationalPattern?: string | null;
  extractionMethod?: KnowledgeDrop['extractionMethod'];
  createdAt?: string;
};

export type AppendKnowledgeDropReviewInput = {
  dropId: string;
  expectedPriorVersion: number;
  requestId: string;
  review: KnowledgeDropReviewInput;
};
