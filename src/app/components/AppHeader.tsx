import type { ReactNode } from 'react';
import { appConfig } from '../config.js';

export function AppHeader({ children }: { children?: ReactNode }): JSX.Element {
  const title = appConfig.deployMode === 'single-pack' ? "The Wolf's Deposition" : 'AXM Wolf';
  const homeHref = window.location.pathname.startsWith('/wolf') ? '/wolf/' : '#/';

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <a className="app-header__title" href={homeHref}>
          {title}
        </a>
        <nav className="app-header__nav" aria-label="Primary">
          {children}
        </nav>
      </div>
    </header>
  );
}
