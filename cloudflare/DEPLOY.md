# WOLF on the Glass Onion

The assembled Glass Onion directory remains the complete deployment artifact. It contains the original site, WOLF at `/wolf/`, and a prebuilt root `_worker.js`. The live `axm.tools` target is the Workers Static Assets project `holy-dream-3851`; deploy the complete folder with the checked-in Wrangler configuration so the Worker script and bindings are included.

## One-time Cloudflare setup

1. Production uses the D1 database `axm-wolf-prod` in WNAM. Its checked-in binding and database ID live in `/wrangler.jsonc`. Execute `schema.sql` for a new database. For an existing database, apply each missing migration in order: `migrate-v0.2-to-v0.3.sql`, `migrate-v0.3-to-v0.4.sql`, then `migrate-v0.4-to-v0.5.sql`. Check `wolf_schema_migrations` before applying any migration.
2. Deploy with the checked-in Workers configuration so the database is bound to `holy-dream-3851` as `WOLF_DB`. If configuring the binding through the dashboard, reproduce that exact binding before the redeploy.
3. In Cloudflare Zero Trust, enable the **One-time PIN** identity provider.
4. Create one self-hosted Access application named `WOLF Operators`. Give that application both path entries:
   - `axm.tools/wolf/dashboard`
   - `axm.tools/wolf/api/operator/*`
5. Add an Allow policy whose Include rule is **Login Methods → One-time PIN**. This authenticates any valid email; WOLF separately denies every email that has not been assigned to a workspace.
6. Copy the application's AUD tag and add these Worker environment variables:
   - `WOLF_OWNER_EMAIL` — your normalized owner email
   - `CF_ACCESS_TEAM_DOMAIN` — for example `your-team.cloudflareaccess.com`
   - `CF_ACCESS_AUD` — the Access application AUD tag
7. From the WOLF repository, run `npx wrangler deploy`. Wrangler uploads `dist/Glass_Onion` as the Worker's static assets and deploys its root `_worker.js`. The generated `.assetsignore` prevents `_worker.js` from also being published as a static file.

Do not upload `dist/wolf` by itself. The complete `dist/Glass_Onion` folder is still the source of truth for each release; deploying only WOLF would replace the host with an incomplete site.

Do not protect `/wolf/SUR*` or `/wolf/api/surveys/*` with Access. Those recipient routes use per-interview capability tokens and intentionally require no account.

## Operator workflow

Open `https://axm.tools/wolf/dashboard`. Cloudflare sends a single-use email code; no Google login, password, authenticator app, or device installation is required. The owner email automatically receives root access and can create workspaces. Add Helen or Lotus by email inside a workspace and choose steward, interviewer, or viewer permission. They use the same dashboard URL and see only assigned workspaces.

The Worker validates the signed `Cf-Access-Jwt-Assertion` on every operator API request. Workspace membership is then checked in D1 for every survey read or write. Recipient tokens are random, stored only as hashes, revocable, and carried after `#k=` so ordinary HTTP logs do not receive them. Completed interviews are read-only.

Every non-WOLF request is passed directly to `env.ASSETS` unchanged.

## Knowledge custody boundary

Schema v0.5 reserves private, source-linked knowledge-drop and append-only review-event tables and records each participant's optional manual-analysis choice. The current Worker intentionally exposes no API for knowledge tables. Do not describe knowledge details as synchronized or workspace-visible until an authorized, consent-aware API and deletion/export workflow are deployed and tested.
