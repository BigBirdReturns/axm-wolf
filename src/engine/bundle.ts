import type { WolfRecord, WolfRecordBundle, ExportOptions } from './types.js';
import { WolfValidationError } from './errors.js';
import { validatePack } from './schema.js';

// ---------------------------------------------------------------------------
// buildRecordBundle
// ---------------------------------------------------------------------------

export function buildRecordBundle(record: WolfRecord, options?: ExportOptions): WolfRecordBundle {
  return {
    schemaVersion: 1,
    recordId: record.recordId,
    title: record.title,
    subject: structuredClone(record.subject),
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    pack: {
      packId: record.packId,
      packVersion: record.packVersion,
      packDigest: record.packDigest,
      snapshot: structuredClone(record.packSnapshot),
    },
    responses: structuredClone(record.responses),
    drafts: options?.includeDrafts ? structuredClone(record.drafts) : [],
    provenance: {
      engineVersion: options?.engineVersion ?? '0.1.0',
      appVersion: options?.appVersion ?? record.appVersion,
      exportedAt: options?.exportedAt ?? new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// importRecordBundle
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const VALID_STATUSES = new Set(['active', 'completed', 'archived']);
const VALID_SOURCES = new Set(['typed', 'speech_transcript', 'mixed', 'imported']);
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WolfValidationError(`${path} must be a plain object`);
  }
  // Reject a tampered prototype (e.g. obj['__proto__'] = {} sets the prototype
  // rather than an own key, so Object.keys cannot see it). A legitimate JSON
  // bundle always has Object.prototype or a null prototype.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new WolfValidationError(`${path} has a tampered prototype`);
  }
  // getOwnPropertyNames also catches non-enumerable own keys (e.g. an own
  // "__proto__" produced by JSON.parse) that Object.keys would miss.
  for (const key of Object.getOwnPropertyNames(value as object)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new WolfValidationError(`${path} contains forbidden key: ${key}`);
    }
  }
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new WolfValidationError(`${path} must be a string`);
  }
  return value;
}

function optionalStringOrNull(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new WolfValidationError(`${path} must be a string or null`);
  }
  return value;
}

function assertIsoString(value: unknown, path: string): string {
  const s = requiredString(value, path);
  if (!ISO_PATTERN.test(s)) {
    throw new WolfValidationError(`${path} must be an ISO-8601 timestamp string`);
  }
  return s;
}

function validateSubject(value: unknown, path: string) {
  assertPlainObject(value, path);
  const subj = value as Record<string, unknown>;
  const displayName = requiredString(subj.displayName, `${path}.displayName`);
  const subtitle = optionalStringOrNull(subj.subtitle, `${path}.subtitle`);
  const organization = optionalStringOrNull(subj.organization, `${path}.organization`);
  const role = optionalStringOrNull(subj.role, `${path}.role`);
  return { displayName, subtitle, organization, role };
}

function validateProvenance(value: unknown, path: string) {
  assertPlainObject(value, path);
  const prov = value as Record<string, unknown>;
  const engineVersion = requiredString(prov.engineVersion, `${path}.engineVersion`);
  const appVersion = requiredString(prov.appVersion, `${path}.appVersion`);
  const exportedAt = requiredString(prov.exportedAt, `${path}.exportedAt`);
  return { engineVersion, appVersion, exportedAt };
}

function validateRevision(value: unknown, index: number, promptId: string) {
  const path = `responses[promptId=${promptId}].revisions[${index}]`;
  assertPlainObject(value, path);
  const rev = value as Record<string, unknown>;
  const revisionId = requiredString(rev.revisionId, `${path}.revisionId`);
  const text = requiredString(rev.text, `${path}.text`);
  const capturedAt = requiredString(rev.capturedAt, `${path}.capturedAt`);
  const source = requiredString(rev.source, `${path}.source`);
  if (!VALID_SOURCES.has(source)) {
    throw new WolfValidationError(`${path}.source must be one of: typed, speech_transcript, mixed, imported`);
  }
  const locale = requiredString(rev.locale, `${path}.locale`);
  const supersedesRevisionId = optionalStringOrNull(rev.supersedesRevisionId, `${path}.supersedesRevisionId`);
  return {
    revisionId,
    text,
    capturedAt,
    source: source as 'typed' | 'speech_transcript' | 'mixed' | 'imported',
    locale,
    supersedesRevisionId,
  };
}

function validateResponses(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw new WolfValidationError(`${path} must be an array`);
  }
  return value.map((item: unknown, i: number) => {
    assertPlainObject(item, `${path}[${i}]`);
    const resp = item as Record<string, unknown>;
    const promptId = requiredString(resp.promptId, `${path}[${i}].promptId`);
    if (!Array.isArray(resp.revisions)) {
      throw new WolfValidationError(`${path}[${i}].revisions must be an array`);
    }
    const revisions = resp.revisions.map((rev: unknown, j: number) => validateRevision(rev, j, promptId));
    return { promptId, revisions };
  });
}

function validateDrafts(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw new WolfValidationError(`${path} must be an array`);
  }
  return value.map((item: unknown, i: number) => {
    assertPlainObject(item, `${path}[${i}]`);
    const draft = item as Record<string, unknown>;
    const promptId = requiredString(draft.promptId, `${path}[${i}].promptId`);
    const text = requiredString(draft.text, `${path}[${i}].text`);
    const updatedAt = requiredString(draft.updatedAt, `${path}[${i}].updatedAt`);
    return { promptId, text, updatedAt };
  });
}

export function importRecordBundle(input: unknown): WolfRecordBundle {
  assertPlainObject(input, 'bundle');
  const obj = input as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    throw new WolfValidationError('bundle.schemaVersion must be 1');
  }

  const recordId = requiredString(obj.recordId, 'bundle.recordId');
  const title = requiredString(obj.title, 'bundle.title');
  const subject = validateSubject(obj.subject, 'bundle.subject');

  const status = requiredString(obj.status, 'bundle.status');
  if (!VALID_STATUSES.has(status)) {
    throw new WolfValidationError('bundle.status must be one of: active, completed, archived');
  }

  const createdAt = assertIsoString(obj.createdAt, 'bundle.createdAt');
  const updatedAt = assertIsoString(obj.updatedAt, 'bundle.updatedAt');

  // pack object
  assertPlainObject(obj.pack, 'bundle.pack');
  const packObj = obj.pack as Record<string, unknown>;
  const packId = requiredString(packObj.packId, 'bundle.pack.packId');
  const packVersion = requiredString(packObj.packVersion, 'bundle.pack.packVersion');
  const packDigest = requiredString(packObj.packDigest, 'bundle.pack.packDigest');
  const snapshot = validatePack(packObj.snapshot);

  const responses = validateResponses(obj.responses, 'bundle.responses');
  const drafts = validateDrafts(obj.drafts, 'bundle.drafts');
  const provenance = validateProvenance(obj.provenance, 'bundle.provenance');

  return {
    schemaVersion: 1,
    recordId,
    title,
    subject,
    status: status as 'active' | 'completed' | 'archived',
    createdAt,
    updatedAt,
    pack: { packId, packVersion, packDigest, snapshot },
    responses,
    drafts,
    provenance,
  };
}
