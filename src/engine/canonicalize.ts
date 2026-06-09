import type { CapturePack } from './types.js';
import { WolfValidationError } from './errors.js';

/**
 * Recursively canonicalize a JSON-compatible value:
 * - Object keys are sorted lexicographically at every nesting level.
 * - Array order is preserved.
 * - Strings, numbers, booleans, and null are returned as-is.
 * - undefined values are dropped (matching JSON.stringify default behavior).
 */
function canonicalizeValue(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v !== undefined) {
        sorted[key] = canonicalizeValue(v);
      }
    }
    return sorted;
  }
  // undefined at top-level is not valid JSON; skip it
  return value;
}

/**
 * Produce a deterministic JSON string for a CapturePack.
 * Object keys at every level are recursively sorted; array order is preserved;
 * string contents are preserved exactly; no extra whitespace is added.
 * undefined-valued fields are omitted; null is kept.
 *
 * Two packs with the same logical content but keys supplied in different order
 * MUST produce an identical string.
 *
 * Throws WolfValidationError when the pack argument is not a plain object.
 */
export function canonicalizePack(pack: CapturePack): string {
  if (typeof pack !== 'object' || pack === null || Array.isArray(pack)) {
    throw new WolfValidationError('canonicalizePack requires a plain CapturePack object');
  }
  return JSON.stringify(canonicalizeValue(pack));
}
