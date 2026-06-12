// Pure helpers for converting a validated WolfRecordBundle into a WolfRecord
// (DESIGN.md 6.1, 6.3, 2.9). Kept free of File/Blob/DOM access so it can be
// unit-tested under node:test.

import type { WolfRecord, WolfRecordBundle } from '../../engine/index.js';

/**
 * Converts an imported, validated record bundle into a WolfRecord ready for
 * storage. Fields map 1:1 from the bundle; `lastExportedAt` is reset to
 * `null` (the imported copy has not itself been exported), and
 * `appVersion`/pack identity come from the bundle's provenance/pack block.
 */
export function bundleToRecord(bundle: WolfRecordBundle): WolfRecord {
  return {
    recordId: bundle.recordId,
    title: bundle.title,
    subject: bundle.subject,
    packId: bundle.pack.packId,
    packVersion: bundle.pack.packVersion,
    packDigest: bundle.pack.packDigest,
    packSnapshot: bundle.pack.snapshot,
    createdAt: bundle.createdAt,
    updatedAt: bundle.updatedAt,
    status: bundle.status,
    responses: bundle.responses,
    drafts: bundle.drafts,
    lastExportedAt: null,
    appVersion: bundle.provenance.appVersion,
  };
}

/**
 * Returns a copy of `record` suitable for "import as copy" (DESIGN.md 6.3):
 * a fresh record ID and a title suffixed with " (copy)".
 */
export function makeImportCopy(record: WolfRecord, newRecordId: string): WolfRecord {
  return {
    ...record,
    recordId: newRecordId,
    title: `${record.title} (copy)`,
  };
}
