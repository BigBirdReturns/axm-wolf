import type { CapturePack } from './types.js';
import { canonicalizePack } from './canonicalize.js';

/**
 * Compute a SHA-256 digest of the canonicalized pack JSON.
 *
 * Uses the global `crypto.subtle.digest` (available in Node 22+ and all
 * modern browsers). Does NOT import 'node:crypto'.
 *
 * Returns a lowercase 64-character hex string with no prefix.
 */
export async function digestPack(pack: CapturePack): Promise<string> {
  const canonical = canonicalizePack(pack);
  const encoded = new TextEncoder().encode(canonical);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
