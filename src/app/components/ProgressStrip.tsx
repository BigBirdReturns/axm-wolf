// Shared horizontal progress strip (DESIGN.md 10.1, 10.6).
//
// Renders an accent-colored fill plus a screen-reader-readable text
// alternative -- progress must not be conveyed by color/width alone.

export function ProgressStrip({
  percent,
  label,
  mini,
}: {
  /** 0-100, already rounded. */
  percent: number;
  /** Accessible label describing what this strip measures, e.g. "Record progress". */
  label: string;
  mini?: boolean;
}): JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={mini ? 'progress-strip progress-strip--mini' : 'progress-strip'}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${clamped} percent`}
    >
      <div className="progress-strip__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
