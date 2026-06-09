import type { WolfRecord, SearchResult } from './types.js';

/**
 * Returns all non-overlapping occurrences of `needle` in `haystack`
 * using case-insensitive comparison. Returns the count.
 */
function countOccurrences(haystack: string, needle: string): number {
  const lower = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = lower.indexOf(lowerNeedle, pos);
    if (idx === -1) break;
    count++;
    pos = idx + lowerNeedle.length;
  }
  return count;
}

/**
 * Extracts a ~80-char snippet centered on the first match of `needle` in
 * `source`. The returned string always includes the matching text.
 */
function extractSnippet(source: string, needle: string): string {
  const lowerSource = source.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const matchIdx = lowerSource.indexOf(lowerNeedle);
  if (matchIdx === -1) return source.slice(0, 80);

  const WINDOW = 80;
  const half = Math.floor((WINDOW - needle.length) / 2);
  const start = Math.max(0, matchIdx - half);
  const end = Math.min(source.length, start + WINDOW);
  let snippet = source.slice(start, end);
  if (start > 0) snippet = '…' + snippet.slice(1);
  if (end < source.length) snippet = snippet.slice(0, snippet.length - 1) + '…';
  return snippet;
}

/**
 * Deterministic, local, lexical (case-insensitive substring) search over
 * WolfRecord arrays. Returns [] for empty/whitespace query.
 *
 * Search fields and their field classification:
 *  - record.title                  -> 'metadata'
 *  - subject displayName/subtitle/organization/role -> 'metadata'
 *  - section label / rangeLabel    -> 'metadata'
 *  - lens label                    -> 'metadata'
 *  - prompt text / prompt tags     -> 'prompt'
 *  - current response text (last revision) -> 'response'
 */
export function searchRecords(query: string, records: WolfRecord[]): SearchResult[] {
  if (typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const record of records) {
    const pack = record.packSnapshot;
    const recordId = record.recordId;

    // Build a promptId -> sectionId lookup from the pack
    const promptSectionMap = new Map<string, string>();
    for (const section of pack.sections) {
      for (const pid of section.promptIds) {
        promptSectionMap.set(pid, section.id);
      }
    }

    // Build a promptId -> current response text lookup
    const currentResponseMap = new Map<string, string>();
    for (const resp of record.responses) {
      if (resp.revisions.length > 0) {
        const lastRev = resp.revisions[resp.revisions.length - 1];
        if (lastRev.text.length > 0) {
          currentResponseMap.set(resp.promptId, lastRev.text);
        }
      }
    }

    // Helper: emit a hit if the text matches
    const emit = (
      source: string,
      field: SearchResult['field'],
      sectionId: string,
      promptId: string,
    ): void => {
      const score = countOccurrences(source, query);
      if (score === 0) return;
      const snippet = extractSnippet(source, query);
      results.push({ recordId, sectionId, promptId, field, snippet, score });
    };

    // --- record title ---
    emit(record.title, 'metadata', '', '');

    // --- subject metadata ---
    const subj = record.subject;
    emit(subj.displayName, 'metadata', '', '');
    if (subj.subtitle) emit(subj.subtitle, 'metadata', '', '');
    if (subj.organization) emit(subj.organization, 'metadata', '', '');
    if (subj.role) emit(subj.role, 'metadata', '', '');

    // --- section label and rangeLabel ---
    for (const section of pack.sections) {
      emit(section.label, 'metadata', section.id, '');
      if (section.rangeLabel) emit(section.rangeLabel, 'metadata', section.id, '');
    }

    // --- lens labels ---
    for (const lens of pack.lenses) {
      emit(lens.label, 'metadata', '', '');
    }

    // --- prompts: text and tags ---
    for (const prompt of pack.prompts) {
      const sectionId = promptSectionMap.get(prompt.id) ?? '';

      // prompt text
      emit(prompt.text, 'prompt', sectionId, prompt.id);

      // prompt tags (each tag is a separate candidate string)
      if (prompt.tags) {
        for (const tag of prompt.tags) {
          emit(tag, 'prompt', sectionId, prompt.id);
        }
      }
    }

    // --- current response text ---
    for (const [promptId, text] of currentResponseMap.entries()) {
      const sectionId = promptSectionMap.get(promptId) ?? '';
      emit(text, 'response', sectionId, promptId);
    }
  }

  // Sort: score DESC, then recordId ASC, sectionId ASC, promptId ASC, field ASC
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.recordId !== b.recordId) return a.recordId < b.recordId ? -1 : 1;
    if (a.sectionId !== b.sectionId) return a.sectionId < b.sectionId ? -1 : 1;
    if (a.promptId !== b.promptId) return a.promptId < b.promptId ? -1 : 1;
    if (a.field !== b.field) return a.field < b.field ? -1 : 1;
    return 0;
  });

  return results;
}
