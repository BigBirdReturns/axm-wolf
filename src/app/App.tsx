import { AppHeader } from './components/AppHeader.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useWolfApp } from './hooks/useWolfApp.js';
import { LaunchScreen } from './screens/LaunchScreen.js';
import {
  NotFoundScreen,
  PacksScreen,
  RecordExportScreen,
  RecordHomeScreen,
  RecordPromptScreen,
  RecordSearchScreen,
  RecordSectionScreen,
  RecordsScreen,
  SettingsScreen,
} from './screens/PlaceholderScreens.js';

export function App(): JSX.Element {
  const route = useHashRoute();
  const wolfApp = useWolfApp();

  return (
    <div className="app-shell">
      <AppHeader>
        <a className="btn btn--secondary" href="#/records">
          Records
        </a>
        <a className="btn btn--secondary" href="#/packs">
          Packs
        </a>
        <a className="btn btn--secondary" href="#/settings">
          Settings
        </a>
      </AppHeader>

      <main className="app-main" aria-live="polite">
        {wolfApp.loading ? (
          <p>Loading AXM Wolf…</p>
        ) : wolfApp.error ? (
          <p role="alert" className="notice">
            Could not load AXM Wolf: {wolfApp.error}
          </p>
        ) : (
          renderRoute(route, wolfApp)
        )}
      </main>

      <footer className="app-footer">
        <p>AXM Wolf &mdash; local-first institutional knowledge capture.</p>
      </footer>
    </div>
  );
}

function renderRoute(route: ReturnType<typeof useHashRoute>, wolfApp: ReturnType<typeof useWolfApp>): JSX.Element {
  switch (route.name) {
    case 'launch':
      return <LaunchScreen {...wolfApp} />;
    case 'records':
      return <RecordsScreen />;
    case 'record':
      return <RecordHomeScreen recordId={route.recordId} />;
    case 'record-section':
      return <RecordSectionScreen recordId={route.recordId} sectionId={route.sectionId} />;
    case 'record-prompt':
      return <RecordPromptScreen recordId={route.recordId} promptId={route.promptId} />;
    case 'record-search':
      return <RecordSearchScreen recordId={route.recordId} />;
    case 'record-export':
      return <RecordExportScreen recordId={route.recordId} />;
    case 'packs':
      return <PacksScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'not-found':
      return <NotFoundScreen path={route.path} />;
  }
}
