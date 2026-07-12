import { AppHeader } from './components/AppHeader.js';
import { UpdateBanner } from './components/UpdateBanner.js';
import { navigate, useHashRoute } from './hooks/useHashRoute.js';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate.js';
import { useWolfApp } from './hooks/useWolfApp.js';
import { LaunchScreen } from './screens/LaunchScreen.js';
import { RecordHomeScreen } from './screens/RecordHomeScreen.js';
import { SectionScreen } from './screens/SectionScreen.js';
import { PromptScreen } from './screens/PromptScreen.js';
import { SearchScreen } from './screens/SearchScreen.js';
import { ExportScreen } from './screens/ExportScreen.js';
import { NotFoundScreen } from './screens/PlaceholderScreens.js';
import { RecordsScreen } from './screens/RecordsScreen.js';
import { PacksScreen } from './screens/PacksScreen.js';
import { OpsScreen } from './screens/OpsScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { GuidedStartScreen } from './screens/GuidedStartScreen.js';
import { guidedPackId } from './lib/guided.js';
import { HostedSurveyScreen } from './screens/HostedSurveyScreen.js';

export function App(): JSX.Element {
  const route = useHashRoute();
  const wolfApp = useWolfApp();
  const swUpdate = useServiceWorkerUpdate();
  const guided = route.name === 'guided-start' || guidedPackId() !== null;

  return (
    <div className="app-shell">
      <UpdateBanner {...swUpdate} />
      <AppHeader>
        {!guided ? <><a className="btn btn--secondary" href={window.location.pathname.startsWith('/wolf') ? '/wolf/dashboard' : '#/records'}>
          Dashboard
        </a>
        <a className="btn btn--secondary" href="#/packs">
          Packs
        </a>
        <a className="btn btn--secondary" href="#/ops">
          Ops
        </a>
        <a className="btn btn--secondary" href="#/settings">
          Settings
        </a>
        </> : null}
      </AppHeader>

      <main className="app-main">
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
        <p>{guided ? 'Your work saves on this device. You can stop and return later.' : 'AXM Wolf — local-first institutional knowledge capture.'}</p>
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
    case 'hosted-survey':
      return <HostedSurveyScreen {...wolfApp} code={route.code} onNavigate={navigate} />;
    case 'guided-start':
      return <GuidedStartScreen {...wolfApp} invitation={route} onNavigate={navigate} />;
    case 'records':
      return <RecordsScreen {...wolfApp} />;
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
      return <PacksScreen {...wolfApp} />;
    case 'ops':
      return <OpsScreen db={db} />;
    case 'settings':
      return <SettingsScreen />;
    case 'not-found':
      return <NotFoundScreen path={route.path} />;
  }
}
