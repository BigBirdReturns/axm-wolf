import type { Cadence } from './types.js';

/**
 * Maps a pack-declared recommended cadence to a recurring interval in days,
 * for use by the app's gentle, opt-out cadence nudge (DESIGN.md 2.6, 2.7).
 *
 * 'once' has no recurring nudge (a single-sitting capture has nothing to
 * return to), so it maps to null.
 */
export function cadenceIntervalDays(cadence: Cadence): number | null {
  switch (cadence) {
    case 'once':
      return null;
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30;
    case 'campaign':
      return 3;
    default:
      return null;
  }
}
