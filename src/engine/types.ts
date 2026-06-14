export type PromptKind = 'long_text';

export type Cadence = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'campaign';

export type CaptureSource = 'typed' | 'speech_transcript' | 'mixed' | 'imported';

export type PackTrust = 'bundled' | 'imported_unsigned' | 'quarantined';

export type CapturePack = {
  schemaVersion: 1;
  packId: string;
  packVersion: string;
  engineVersion: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  subjectDefaults?: SubjectMetadata;
  theme: { accent: string };
  lenses: Array<{ id: string; label: string }>;
  sections: Section[];
  prompts: Prompt[];
  exportDefaults?: { basename?: string | null };
  recommendedCadence?: Cadence;
};

export type SubjectMetadata = {
  displayName: string;
  subtitle?: string | null;
  organization?: string | null;
  role?: string | null;
};

export type Section = {
  id: string;
  label: string;
  rangeLabel?: string | null;
  description?: string | null;
  promptIds: string[];
};

export type Prompt = {
  id: string;
  kind: PromptKind;
  lensId: string;
  text: string;
  context?: string | null;
  tags?: string[];
  required?: boolean;
  suggestedFollowUp?: string | null;
};

export type ResponseRevision = {
  revisionId: string;
  text: string;
  capturedAt: string;
  source: CaptureSource;
  locale: string;
  supersedesRevisionId: string | null;
};

export type PromptResponse = {
  promptId: string;
  revisions: ResponseRevision[];
};

export type Draft = {
  promptId: string;
  text: string;
  updatedAt: string;
};

export type WolfRecord = {
  recordId: string;
  title: string;
  subject: SubjectMetadata;
  packId: string;
  packVersion: string;
  packDigest: string;
  packSnapshot: CapturePack;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'archived';
  responses: PromptResponse[];
  drafts: Draft[];
  lastExportedAt?: string | null;
  appVersion: string;
};

export type WolfRecordBundle = {
  schemaVersion: 1;
  recordId: string;
  title: string;
  subject: SubjectMetadata;
  status: WolfRecord['status'];
  createdAt: string;
  updatedAt: string;
  pack: {
    packId: string;
    packVersion: string;
    packDigest: string;
    snapshot: CapturePack;
  };
  responses: PromptResponse[];
  drafts: Draft[];
  provenance: {
    engineVersion: string;
    appVersion: string;
    exportedAt: string;
  };
};

// ---------------------------------------------------------------------------
// Phase 2 engine interface contracts (locked by the architect; agents fill in
// the implementations against these signatures and must not change them).
// ---------------------------------------------------------------------------

export type CreateRecordInput = {
  recordId: string;
  pack: CapturePack;
  packDigest: string;
  appVersion: string;
  /** Defaults to pack.subjectDefaults when omitted. */
  subject?: SubjectMetadata;
  /** Defaults to pack.title when omitted. */
  title?: string;
  /** ISO-8601; defaults to now. Injected for deterministic tests. */
  now?: string;
};

export type ExportOptions = {
  /** Include active drafts in the full record bundle. Default false. */
  includeDrafts?: boolean;
  /** ISO-8601 export timestamp. Injected for deterministic tests. */
  exportedAt?: string;
  engineVersion?: string;
  appVersion?: string;
};

export type HumanExportOptions = {
  /** Include the full revision chain, not just the current revision. */
  includeRevisionHistory?: boolean;
  /** Include prompts that have no committed response. Default false. */
  includeUnanswered?: boolean;
};

export type SearchResult = {
  recordId: string;
  sectionId: string;
  promptId: string;
  field: 'prompt' | 'response' | 'metadata';
  snippet: string;
  score: number;
};

export type ProgressSummary = {
  totalPrompts: number;
  answeredPrompts: number;
  draftPrompts: number;
  wordCount: number;
  percentAnswered: number;
  bySection: Array<{
    sectionId: string;
    totalPrompts: number;
    answeredPrompts: number;
    draftPrompts: number;
    percentAnswered: number;
  }>;
};
