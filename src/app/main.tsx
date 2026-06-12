import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/theme.css';

/**
 * Entry point: mounts the AXM Wolf app shell into #root.
 *
 * Exported for tests / tooling that want to confirm this module loads
 * without mounting (e.g. a build smoke check).
 */
export function bootstrap(): string {
  return 'AXM Wolf React/Vite application boundary scaffold';
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
