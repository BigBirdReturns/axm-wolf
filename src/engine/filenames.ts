/**
 * Produces a safe, portable filename segment.
 *
 * Rules:
 *  - Replace whitespace runs with '-'
 *  - Remove any character outside [A-Za-z0-9._-]
 *  - Collapse repeated '-' or '.' characters
 *  - Strip leading/trailing dots and dashes
 *  - Prevent directory traversal: remove '..' sequences and any surviving '/' or '\'
 *  - Cap at 100 characters
 *  - Return 'record' if the result is empty
 */
export function sanitizeFilename(input: string): string {
  let s = input;

  // Replace whitespace runs with a single '-'
  s = s.replace(/\s+/g, '-');

  // Remove characters not in the safe set
  s = s.replace(/[^A-Za-z0-9._-]/g, '');

  // Remove '..' sequences (directory traversal)
  // Repeat until stable in case of nested patterns like '...'
  while (s.includes('..')) {
    s = s.replace(/\.\./g, '.');
  }

  // Collapse runs of '-'
  s = s.replace(/-{2,}/g, '-');

  // Collapse runs of '.'
  s = s.replace(/\.{2,}/g, '.');

  // Strip leading and trailing dots and dashes
  s = s.replace(/^[.\-]+/, '').replace(/[.\-]+$/, '');

  // Cap at 100 characters
  if (s.length > 100) {
    s = s.slice(0, 100);
    // Strip again in case the cap cut mid-dot/dash
    s = s.replace(/[.\-]+$/, '');
  }

  return s.length > 0 ? s : 'record';
}
