import { z } from 'zod';

export const captureSourceSchema = z.enum(['typed', 'speech_transcript', 'mixed', 'imported']);

export const subjectMetadataSchema = z.object({
  displayName: z.string().min(1).max(160),
  subtitle: z.string().max(160).nullable().optional(),
  organization: z.string().max(160).nullable().optional(),
  role: z.string().max(160).nullable().optional()
}).strict();

export const lensSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(80)
}).strict();

export const promptSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.literal('long_text'),
  lensId: z.string().min(1).max(80),
  text: z.string().min(1).max(4000),
  context: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(80)).max(32).optional(),
  required: z.boolean().optional(),
  suggestedFollowUp: z.string().max(2000).nullable().optional()
}).strict();

export const sectionSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  rangeLabel: z.string().max(120).nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  promptIds: z.array(z.string().min(1).max(160)).min(1).max(500)
}).strict();

export const capturePackSchema = z.object({
  schemaVersion: z.literal(1),
  packId: z.string().min(1).max(120),
  packVersion: z.string().min(1).max(80),
  engineVersion: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(240).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  subjectDefaults: subjectMetadataSchema.optional(),
  theme: z.object({
    accent: z.string().length(7)
  }).strict(),
  lenses: z.array(lensSchema).min(1).max(100),
  sections: z.array(sectionSchema).min(1).max(100),
  prompts: z.array(promptSchema).min(1).max(2000),
  exportDefaults: z.object({
    basename: z.string().max(160).nullable().optional()
  }).strict().optional()
}).strict();

export const responseRevisionSchema = z.object({
  revisionId: z.string().min(1),
  text: z.string(),
  capturedAt: z.string().min(1),
  source: captureSourceSchema,
  locale: z.string().min(1).max(35),
  supersedesRevisionId: z.string().min(1).nullable()
}).strict();

export const promptResponseSchema = z.object({
  promptId: z.string().min(1),
  revisions: z.array(responseRevisionSchema).min(1)
}).strict();

export const draftSchema = z.object({
  promptId: z.string().min(1),
  text: z.string(),
  updatedAt: z.string().min(1)
}).strict();

export const wolfRecordBundleSchema = z.object({
  schemaVersion: z.literal(1),
  recordId: z.string().min(1),
  title: z.string().min(1).max(160),
  subject: subjectMetadataSchema,
  status: z.enum(['active', 'completed', 'archived']),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  pack: z.object({
    packId: z.string().min(1),
    packVersion: z.string().min(1),
    packDigest: z.string().min(1),
    snapshot: capturePackSchema
  }).strict(),
  responses: z.array(promptResponseSchema),
  drafts: z.array(draftSchema),
  provenance: z.object({
    engineVersion: z.string().min(1),
    appVersion: z.string().min(1),
    exportedAt: z.string().min(1)
  }).strict()
}).strict();

export type CapturePackSchemaInput = z.input<typeof capturePackSchema>;
export type WolfRecordBundleSchemaInput = z.input<typeof wolfRecordBundleSchema>;
