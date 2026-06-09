// Shared text primitives for the pure engine.
//
// DESIGN.md 7.2 requires ONE word-count implementation shared across progress
// computation, exports, and the UI. Do not fork this. Both renderers and
// progress must import countWords from here.

/**
 * Deterministic word count: split on Unicode whitespace, ignore empty tokens.
 * No locale, no inference. Identical input always yields identical output.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/u).length;
}
