import { WolfEngineError, WolfValidationError } from './errors.js';
import { validatePack } from './schema.js';
import type {
  CapturePack,
  CaptureSource,
  CreateRecordInput,
  Draft,
  ExportOptions,
  HumanExportOptions,
  Prompt,
  PromptResponse,
  ProgressSummary,
  ResponseRevision,
  SearchResult,
  Section,
  SubjectMetadata,
  WolfRecord,
  WolfRecordBundle
} from './types.js';

const DEFAULT_ENGINE_VERSION = '0.1.0';
const DEFAULT_APP_VERSION = '0.1.0';
const VALID_SOURCES = new Set<CaptureSource>(['typed', 'speech_transcript', 'mixed', 'imported']);
const VALID_STATUSES = new Set<WolfRecord['status']>(['active', 'completed', 'archived']);

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function assertIsoTimestamp(value: string, path: string): void {
  if (Number.isNaN(Date.parse(value))) throw new WolfValidationError(`${path} must be an ISO-8601 timestamp`);
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new WolfValidationError(`${path} must be an object`);
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new WolfValidationError(`${path} must be a non-empty string`);
  return value;
}

function clonePack(pack: CapturePack): CapturePack {
  return validatePack(structuredClone(pack));
}

function normalizeSubject(defaults: SubjectMetadata | undefined, override: Partial<SubjectMetadata> | undefined): SubjectMetadata {
  return {
    displayName: override?.displayName ?? defaults?.displayName ?? 'Unnamed subject',
    subtitle: override?.subtitle ?? defaults?.subtitle ?? null,
    organization: override?.organization ?? defaults?.organization ?? null,
    role: override?.role ?? defaults?.role ?? null
  };
}

function promptIdsForPack(pack: CapturePack): Set<string> {
  return new Set(pack.prompts.map((prompt) => prompt.id));
}

function assertPromptExists(record: WolfRecord, promptId: string): void {
  if (!promptIdsForPack(record.packSnapshot).has(promptId)) throw new WolfEngineError(`Unknown prompt ID: ${promptId}`);
}

export function createRecord(input: CreateRecordInput): WolfRecord {
  const packSnapshot = clonePack(input.pack);
  const timestamp = input.timestamp ?? nowIso();
  assertIsoTimestamp(timestamp, 'timestamp');
  assertString(input.packDigest, 'packDigest');
  return {
    recordId: input.recordId ?? newId('record'),
    title: input.title ?? packSnapshot.title,
    subject: normalizeSubject(packSnapshot.subjectDefaults, input.subject),
    packId: packSnapshot.packId,
    packVersion: packSnapshot.packVersion,
    packDigest: input.packDigest,
    packSnapshot,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'active',
    responses: [],
    drafts: [],
    lastExportedAt: null,
    appVersion: input.appVersion ?? DEFAULT_APP_VERSION
  };
}

export function getCurrentResponse(record: WolfRecord, promptId: string): ResponseRevision | null {
  assertPromptExists(record, promptId);
  const response = record.responses.find((candidate) => candidate.promptId === promptId);
  return response?.revisions.at(-1) ?? null;
}

export function commitResponse(record: WolfRecord, promptId: string, text: string, source: CaptureSource, timestamp = nowIso()): WolfRecord {
  assertPromptExists(record, promptId);
  if (!VALID_SOURCES.has(source)) throw new WolfEngineError(`Unsupported capture source: ${source}`);
  if (text.trim().length === 0) throw new WolfEngineError('Committed responses must not be empty');
  assertIsoTimestamp(timestamp, 'timestamp');

  const existing = record.responses.find((response) => response.promptId === promptId);
  const previousRevision = existing?.revisions.at(-1) ?? null;
  const nextRevision: ResponseRevision = {
    revisionId: newId('revision'),
    text,
    capturedAt: timestamp,
    source,
    locale: 'en-US',
    supersedesRevisionId: previousRevision?.revisionId ?? null
  };

  const responses = existing
    ? record.responses.map((response) => response.promptId === promptId ? { ...response, revisions: [...response.revisions, nextRevision] } : { ...response, revisions: [...response.revisions] })
    : [...record.responses.map((response) => ({ ...response, revisions: [...response.revisions] })), { promptId, revisions: [nextRevision] }];

  return {
    ...record,
    updatedAt: timestamp,
    responses,
    drafts: record.drafts.filter((draft) => draft.promptId !== promptId).map((draft) => ({ ...draft }))
  };
}

export function countWords(input: string): number {
  const matches = input.trim().match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu);
  return matches?.length ?? 0;
}

function percent(answered: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((answered / total) * 100);
}

export function computeProgress(pack: CapturePack, record: WolfRecord): ProgressSummary {
  const validPromptIds = promptIdsForPack(pack);
  const answeredPromptIds = new Set(
    record.responses
      .filter((response) => validPromptIds.has(response.promptId) && response.revisions.some((revision) => revision.text.trim().length > 0))
      .map((response) => response.promptId)
  );
  const draftPromptIds = new Set(record.drafts.filter((draft) => validPromptIds.has(draft.promptId) && draft.text.trim().length > 0).map((draft) => draft.promptId));
  const wordCount = record.responses
    .filter((response) => validPromptIds.has(response.promptId))
    .map((response) => response.revisions.at(-1)?.text ?? '')
    .reduce((total, text) => total + countWords(text), 0);

  const bySection = pack.sections.map((section) => {
    const sectionPromptIds = section.promptIds.filter((promptId) => validPromptIds.has(promptId));
    const totalPrompts = sectionPromptIds.length;
    const answeredPrompts = sectionPromptIds.filter((promptId) => answeredPromptIds.has(promptId)).length;
    const draftPrompts = sectionPromptIds.filter((promptId) => draftPromptIds.has(promptId)).length;
    return { sectionId: section.id, totalPrompts, answeredPrompts, draftPrompts, percentAnswered: percent(answeredPrompts, totalPrompts) };
  });

  return {
    totalPrompts: validPromptIds.size,
    answeredPrompts: answeredPromptIds.size,
    draftPrompts: draftPromptIds.size,
    wordCount,
    percentAnswered: percent(answeredPromptIds.size, validPromptIds.size),
    bySection
  };
}

function lower(input: string | null | undefined): string {
  return input?.toLowerCase() ?? '';
}

function snippet(source: string, query: string): string {
  const normalized = source.replace(/\s+/g, ' ').trim();
  const index = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return normalized.slice(0, 120);
  return normalized.slice(Math.max(0, index - 40), Math.min(normalized.length, index + query.length + 80));
}

function score(source: string, query: string): number {
  const haystack = lower(source);
  const needle = query.toLowerCase();
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function sectionForPrompt(pack: CapturePack, promptId: string): Section | undefined {
  return pack.sections.find((section) => section.promptIds.includes(promptId));
}

function lensLabel(pack: CapturePack, prompt: Prompt): string {
  return pack.lenses.find((lens) => lens.id === prompt.lensId)?.label ?? prompt.lensId;
}

export function searchRecords(query: string, records: WolfRecord[]): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const results: SearchResult[] = [];
  for (const record of records) {
    const pack = record.packSnapshot;
    const currentResponses = new Map(record.responses.map((response) => [response.promptId, response.revisions.at(-1)?.text ?? '']));
    for (const section of pack.sections) {
      const metadataSource = [record.title, record.subject.displayName, record.subject.subtitle, record.subject.organization, record.subject.role, section.label, section.rangeLabel].filter(Boolean).join(' ');
      if (score(metadataSource, trimmed) > 0 && section.promptIds[0]) {
        results.push({ recordId: record.recordId, sectionId: section.id, promptId: section.promptIds[0], field: 'metadata', snippet: snippet(metadataSource, trimmed), score: score(metadataSource, trimmed) });
      }
      for (const promptId of section.promptIds) {
        const prompt = pack.prompts.find((candidate) => candidate.id === promptId);
        if (!prompt) continue;
        const promptSource = [section.label, section.rangeLabel, lensLabel(pack, prompt), prompt.text, prompt.context, ...(prompt.tags ?? [])].filter(Boolean).join(' ');
        const promptScore = score(promptSource, trimmed);
        if (promptScore > 0) results.push({ recordId: record.recordId, sectionId: section.id, promptId, field: 'prompt', snippet: snippet(promptSource, trimmed), score: promptScore });
        const responseText = currentResponses.get(promptId) ?? '';
        const responseScore = score(responseText, trimmed);
        if (responseScore > 0) results.push({ recordId: record.recordId, sectionId: section.id, promptId, field: 'response', snippet: snippet(responseText, trimmed), score: responseScore });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score || a.recordId.localeCompare(b.recordId) || a.promptId.localeCompare(b.promptId));
}

export function buildRecordBundle(record: WolfRecord, options: ExportOptions = {}): WolfRecordBundle {
  const exportedAt = options.exportedAt ?? nowIso();
  assertIsoTimestamp(exportedAt, 'exportedAt');
  return {
    schemaVersion: 1,
    recordId: record.recordId,
    title: record.title,
    subject: { ...record.subject },
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    pack: {
      packId: record.packId,
      packVersion: record.packVersion,
      packDigest: record.packDigest,
      snapshot: clonePack(record.packSnapshot)
    },
    responses: record.responses.map((response) => ({ promptId: response.promptId, revisions: response.revisions.map((revision) => ({ ...revision })) })),
    drafts: options.includeDrafts ? record.drafts.map((draft) => ({ ...draft })) : [],
    provenance: {
      engineVersion: options.engineVersion ?? DEFAULT_ENGINE_VERSION,
      appVersion: options.appVersion ?? record.appVersion,
      exportedAt
    }
  };
}

function validateSubject(input: unknown): SubjectMetadata {
  assertPlainObject(input, 'subject');
  return {
    displayName: assertString(input.displayName, 'subject.displayName'),
    subtitle: input.subtitle === null || input.subtitle === undefined ? null : assertString(input.subtitle, 'subject.subtitle'),
    organization: input.organization === null || input.organization === undefined ? null : assertString(input.organization, 'subject.organization'),
    role: input.role === null || input.role === undefined ? null : assertString(input.role, 'subject.role')
  };
}

function validateRevisions(input: unknown, promptId: string): ResponseRevision[] {
  if (!Array.isArray(input) || input.length < 1) throw new WolfValidationError(`response ${promptId} must contain revisions`);
  return input.map((candidate, index) => {
    assertPlainObject(candidate, `response ${promptId} revision ${index}`);
    const revisionId = assertString(candidate.revisionId, 'revisionId');
    const text = assertString(candidate.text, 'revision.text');
    const capturedAt = assertString(candidate.capturedAt, 'revision.capturedAt');
    assertIsoTimestamp(capturedAt, 'revision.capturedAt');
    const source = assertString(candidate.source, 'revision.source') as CaptureSource;
    if (!VALID_SOURCES.has(source)) throw new WolfValidationError(`invalid revision source ${source}`);
    const locale = assertString(candidate.locale, 'revision.locale');
    const supersedesRevisionId = candidate.supersedesRevisionId === null || candidate.supersedesRevisionId === undefined ? null : assertString(candidate.supersedesRevisionId, 'revision.supersedesRevisionId');
    return { revisionId, text, capturedAt, source, locale, supersedesRevisionId };
  });
}

function validateResponses(input: unknown, validPromptIds: Set<string>): PromptResponse[] {
  if (!Array.isArray(input)) throw new WolfValidationError('responses must be an array');
  return input.map((candidate, index) => {
    assertPlainObject(candidate, `responses[${index}]`);
    const promptId = assertString(candidate.promptId, `responses[${index}].promptId`);
    if (!validPromptIds.has(promptId)) throw new WolfValidationError(`response references unknown prompt ${promptId}`);
    return { promptId, revisions: validateRevisions(candidate.revisions, promptId) };
  });
}

function validateDrafts(input: unknown, validPromptIds: Set<string>): Draft[] {
  if (!Array.isArray(input)) throw new WolfValidationError('drafts must be an array');
  return input.map((candidate, index) => {
    assertPlainObject(candidate, `drafts[${index}]`);
    const promptId = assertString(candidate.promptId, `drafts[${index}].promptId`);
    if (!validPromptIds.has(promptId)) throw new WolfValidationError(`draft references unknown prompt ${promptId}`);
    const text = typeof candidate.text === 'string' ? candidate.text : assertString(candidate.text, `drafts[${index}].text`);
    const updatedAt = assertString(candidate.updatedAt, `drafts[${index}].updatedAt`);
    assertIsoTimestamp(updatedAt, `drafts[${index}].updatedAt`);
    return { promptId, text, updatedAt };
  });
}

export function importRecordBundle(input: unknown): WolfRecordBundle {
  assertPlainObject(input, 'bundle');
  if (input.schemaVersion !== 1) throw new WolfValidationError('bundle.schemaVersion must be 1');
  const recordId = assertString(input.recordId, 'recordId');
  const title = assertString(input.title, 'title');
  const subject = validateSubject(input.subject);
  const status = assertString(input.status, 'status') as WolfRecord['status'];
  if (!VALID_STATUSES.has(status)) throw new WolfValidationError(`invalid record status ${status}`);
  const createdAt = assertString(input.createdAt, 'createdAt');
  const updatedAt = assertString(input.updatedAt, 'updatedAt');
  assertIsoTimestamp(createdAt, 'createdAt');
  assertIsoTimestamp(updatedAt, 'updatedAt');
  assertPlainObject(input.pack, 'pack');
  const snapshot = validatePack(input.pack.snapshot);
  const packId = assertString(input.pack.packId, 'pack.packId');
  const packVersion = assertString(input.pack.packVersion, 'pack.packVersion');
  const packDigest = assertString(input.pack.packDigest, 'pack.packDigest');
  if (packId !== snapshot.packId || packVersion !== snapshot.packVersion) throw new WolfValidationError('bundle pack metadata must match pack snapshot');
  const validPromptIds = promptIdsForPack(snapshot);
  const responses = validateResponses(input.responses, validPromptIds);
  const drafts = validateDrafts(input.drafts, validPromptIds);
  assertPlainObject(input.provenance, 'provenance');
  const engineVersion = assertString(input.provenance.engineVersion, 'provenance.engineVersion');
  const appVersion = assertString(input.provenance.appVersion, 'provenance.appVersion');
  const exportedAt = assertString(input.provenance.exportedAt, 'provenance.exportedAt');
  assertIsoTimestamp(exportedAt, 'provenance.exportedAt');
  return { schemaVersion: 1, recordId, title, subject, status, createdAt, updatedAt, pack: { packId, packVersion, packDigest, snapshot }, responses, drafts, provenance: { engineVersion, appVersion, exportedAt } };
}

function responseMap(bundle: WolfRecordBundle): Map<string, PromptResponse> {
  return new Map(bundle.responses.map((response) => [response.promptId, response]));
}

function currentRevision(response: PromptResponse | undefined): ResponseRevision | null {
  return response?.revisions.at(-1) ?? null;
}

function subjectLines(subject: SubjectMetadata): string[] {
  return [
    `Subject: ${subject.displayName}`,
    subject.subtitle ? `Subtitle: ${subject.subtitle}` : null,
    subject.organization ? `Organization: ${subject.organization}` : null,
    subject.role ? `Role: ${subject.role}` : null
  ].filter((line): line is string => line !== null);
}

export function renderMarkdown(bundle: WolfRecordBundle, options: HumanExportOptions = {}): string {
  const exportedAt = options.exportedAt ?? bundle.provenance.exportedAt;
  const responses = responseMap(bundle);
  const lines: string[] = [
    `# ${bundle.title}`,
    '',
    ...subjectLines(bundle.subject),
    `Exported: ${exportedAt}`,
    `Pack: ${bundle.pack.packId} ${bundle.pack.packVersion}`,
    ''
  ];
  for (const section of bundle.pack.snapshot.sections) {
    const sectionLines: string[] = [`## ${section.label}`, ''];
    if (section.rangeLabel) sectionLines.push(section.rangeLabel, '');
    for (const promptId of section.promptIds) {
      const prompt = bundle.pack.snapshot.prompts.find((candidate) => candidate.id === promptId);
      if (!prompt) continue;
      const response = responses.get(promptId);
      const revision = currentRevision(response);
      if (!revision && !options.includeUnansweredPrompts) continue;
      sectionLines.push(`### ${lensLabel(bundle.pack.snapshot, prompt)}: ${prompt.text}`, '');
      if (prompt.context) sectionLines.push(`_${prompt.context}_`, '');
      if (revision) {
        sectionLines.push(revision.text, '', `Captured: ${revision.capturedAt}`, '');
        if (options.includeRevisionHistory && response && response.revisions.length > 1) {
          sectionLines.push('#### Revision history', '');
          for (const historicalRevision of response.revisions) sectionLines.push(`- ${historicalRevision.capturedAt}: ${historicalRevision.text}`);
          sectionLines.push('');
        }
      } else {
        sectionLines.push('_Unanswered_', '');
      }
    }
    if (sectionLines.length > 2) lines.push(...sectionLines);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderPlainText(bundle: WolfRecordBundle, options: HumanExportOptions = {}): string {
  const exportedAt = options.exportedAt ?? bundle.provenance.exportedAt;
  const responses = responseMap(bundle);
  const lines: string[] = [bundle.title, ...subjectLines(bundle.subject), `Exported: ${exportedAt}`, `Pack: ${bundle.pack.packId} ${bundle.pack.packVersion}`, ''];
  for (const section of bundle.pack.snapshot.sections) {
    const sectionLines: string[] = [section.rangeLabel ? `${section.label} (${section.rangeLabel})` : section.label, ''];
    for (const promptId of section.promptIds) {
      const prompt = bundle.pack.snapshot.prompts.find((candidate) => candidate.id === promptId);
      if (!prompt) continue;
      const response = responses.get(promptId);
      const revision = currentRevision(response);
      if (!revision && !options.includeUnansweredPrompts) continue;
      sectionLines.push(`[${lensLabel(bundle.pack.snapshot, prompt)}]`, prompt.text);
      if (prompt.context) sectionLines.push(prompt.context);
      sectionLines.push('');
      if (revision) {
        sectionLines.push(revision.text, '', `Captured: ${revision.capturedAt}`, '');
        if (options.includeRevisionHistory && response && response.revisions.length > 1) {
          sectionLines.push('Revision history:');
          for (const historicalRevision of response.revisions) sectionLines.push(`- ${historicalRevision.capturedAt}: ${historicalRevision.text}`);
          sectionLines.push('');
        }
      } else {
        sectionLines.push('Unanswered', '');
      }
    }
    if (sectionLines.length > 2) lines.push(...sectionLines);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function sanitizeFilename(input: string): string {
  const sanitized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120);
  return sanitized.length > 0 && sanitized !== '.' ? sanitized : 'wolf-export';
}
