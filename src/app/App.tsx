import { AppHeader } from './components/AppHeader.js';
import { navigate, useHashRoute } from './hooks/useHashRoute.js';
import { useWolfApp } from './hooks/useWolfApp.js';
import { LaunchScreen } from './screens/LaunchScreen.js';
import { RecordHomeScreen } from './screens/RecordHomeScreen.js';
import { SectionScreen } from './screens/SectionScreen.js';
import { PromptScreen } from './screens/PromptScreen.js';
import { SearchScreen } from './screens/SearchScreen.js';
import { ExportScreen } from './screens/ExportScreen.js';
import { NotFoundScreen, PacksScreen, RecordsScreen, SettingsScreen } from './screens/PlaceholderScreens.js';

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
  const db = wolfApp.db;
  if (db === null) {
    return (
      <p role="alert" className="notice">
        Storage is unavailable in this browser.
      </p>
    );
  }
  switch (route.name) {
    case 'launch':
      return <LaunchScreen {...wolfApp} />;
    case 'records':
      return <RecordsScreen />;
    case 'record':
      return <RecordHomeScreen db={db} recordId={route.recordId} onNavigate={navigate} />;
    case 'record-section':
      return <SectionScreen db={db} recordId={route.recordId} sectionId={route.sectionId} onNavigate={navigate} />;
    case 'record-prompt':
      return <PromptScreen db={db} recordId={route.recordId} promptId={route.promptId} onNavigate={navigate} />;
    case 'record-search':
      return <SearchScreen db={db} recordId={route.recordId} onNavigate={navigate} />;
    case 'record-export':
      return (
        <ExportScreen
          db={db}
          recordId={route.recordId}
          onNavigate={navigate}
          onRecordDeleted={() => {
            void wolfApp.refreshRecords();
            navigate('#/');
          }}
        />
      );
    case 'packs':
      return <PacksScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'not-found':
      return <NotFoundScreen path={route.path} />;
  }
}
