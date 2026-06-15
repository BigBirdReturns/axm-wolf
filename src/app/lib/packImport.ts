// Pure helpers for importing a Capture Pack bundle (DESIGN.md 4.1, 4.8, 5,
// 12.3). Kept free of File/Blob/DOM and storage access so it can be
// unit-tested under node:test.

import { validatePack, digestPack, WolfValidationError, type CapturePack } from '../../engine/index.js';
import type { StoredPack } from '../hooks/useWolfApp.js';

/**
 * Parses and validates a pack bundle from raw file text. Throws
 * WolfValidationError (with a friendly prefix) if the text is not valid
 * JSON, or if the parsed object fails pack validation.
 */
export async function parsePackFromText(text: string): Promise<{ pack: CapturePack; digest: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new WolfValidationError('That file is not valid JSON.');
  }

  const pack = validatePack(parsed);
  const digest = await digestPack(pack);
  return { pack, digest };
}

/**
 * Converts a validated, freshly-imported pack into a StoredPack row with
 * trust `imported_unsigned` (DESIGN.md 4.8, 12.3 LOCKED DECISIONS). Caller
 * is responsible for persisting the row and handling any packId conflict.
 */
export function bundledPackToStoredPack(pack: CapturePack, digest: string, now?: string): StoredPack {
  return {
    packId: pack.packId,
    packVersion: pack.packVersion,
    digest,
    trust: 'imported_unsigned',
    installedAt: now ?? new Date().toISOString(),
    pack,
  };
}
