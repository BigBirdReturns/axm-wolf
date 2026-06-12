// Section summary card for the record home screen (DESIGN.md 10.1).

import { ProgressStrip } from './ProgressStrip.js';

export function SectionCard({
  href,
  label,
  rangeLabel,
  answered,
  total,
  percent,
  draftCount,
}: {
  href: string;
  label: string;
  rangeLabel?: string | null;
  answered: number;
  total: number;
  percent: number;
  draftCount: number;
}): JSX.Element {
  return (
    <li>
      <a className="card-link" href={href}>
        <div className="card">
          <div className="section-card__head">
            <h3>{label}</h3>
            {rangeLabel ? <span className="section-card__range">{rangeLabel}</span> : null}
          </div>
          <p className="section-card__counts">
            {answered} of {total} answered
            {draftCount > 0 ? (
              <>
                {' '}
                &middot; <span className="chip chip--draft">{draftCount} draft{draftCount === 1 ? '' : 's'}</span>
              </>
            ) : null}
          </p>
          <div className="section-card__progress">
            <ProgressStrip percent={percent} label={`${label} progress`} mini />
          </div>
        </div>
      </a>
    </li>
  );
}
