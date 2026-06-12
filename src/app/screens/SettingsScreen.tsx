import { appConfig, APP_VERSION } from '../config.js';
import '../styles/data.css';

/**
 * Settings screen (DESIGN.md 10.1, 12.1). States the local-first storage
 * model plainly, reports the app version and deploy mode, and points to the
 * per-record delete flow (a true wipe-all action is a known gap tracked in
 * STATUS.md).
 */
export function SettingsScreen(): JSX.Element {
  return (
    <div className="stack">
      <h1>Settings</h1>

      <section aria-labelledby="data-heading">
        <h2 id="data-heading">Your data</h2>
        <p className="notice">
          Responses are stored only in this browser profile, on this device. Clearing browser data
          (or this site&rsquo;s storage) may remove a local record permanently. Exporting a record is
          the backup and transfer mechanism &mdash; no server receives your testimony in v0.1.
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="about-heading">
        <h2 id="about-heading">About this app</h2>
        <p className="meta">
          <span className="field-chip">version {APP_VERSION}</span>
          <span className="field-chip">deploy mode: {appConfig.deployMode}</span>
          {appConfig.deployMode === 'single-pack' && appConfig.defaultPackId ? (
            <span className="field-chip">default pack: {appConfig.defaultPackId}</span>
          ) : null}
        </p>
      </section>

      <hr className="section-rule" />

      <section aria-labelledby="danger-heading" className="danger-zone">
        <h2 id="danger-heading">Danger: delete all local data</h2>
        <p className="notice">
          There is no single &ldquo;delete everything&rdquo; action yet. To remove a record, open{' '}
          <a href="#/records">Records</a>, choose a record, go to its export and data screen, and use
          the delete action there (export a copy first &mdash; this is the only backup mechanism). A
          full wipe-all action is planned for a later release.
        </p>
      </section>
    </div>
  );
}
