# WOLF on the Glass Onion

The assembled Glass Onion directory keeps the existing direct-upload workflow. It contains the original site, WOLF at `/wolf/`, and a prebuilt root `_worker.js`.

## One-time Cloudflare setup

1. Create a D1 database and execute `schema.sql` against it. If the v0.2 schema was already deployed, execute `migrate-v0.2-to-v0.3.sql` once instead.
2. Bind the database to the Pages project as `WOLF_DB`.
3. In Cloudflare Zero Trust, enable the **One-time PIN** identity provider.
4. Create one self-hosted Access application named `WOLF Operators`. Give that application both path entries:
   - `axm.tools/wolf/dashboard`
   - `axm.tools/wolf/api/operator/*`
5. Add an Allow policy whose Include rule is **Login Methods → One-time PIN**. This authenticates any valid email; WOLF separately denies every email that has not been assigned to a workspace.
6. Copy the application's AUD tag and add these Pages environment variables:
   - `WOLF_OWNER_EMAIL` — your normalized owner email
   - `CF_ACCESS_TEAM_DOMAIN` — for example `your-team.cloudflareaccess.com`
   - `CF_ACCESS_AUD` — the Access application AUD tag
7. Upload the complete assembled Glass Onion directory through the existing Pages direct-upload screen.

Do not protect `/wolf/SUR*` or `/wolf/api/surveys/*` with Access. Those recipient routes use per-interview capability tokens and intentionally require no account.

## Operator workflow

Open `https://axm.tools/wolf/dashboard`. Cloudflare sends a single-use email code; no Google login, password, authenticator app, or device installation is required. The owner email automatically receives root access and can create workspaces. Add Helen or Lotus by email inside a workspace and choose steward, interviewer, or viewer permission. They use the same dashboard URL and see only assigned workspaces.

The Worker validates the signed `Cf-Access-Jwt-Assertion` on every operator API request. Workspace membership is then checked in D1 for every survey read or write. Recipient tokens are random, stored only as hashes, revocable, and carried after `#k=` so ordinary HTTP logs do not receive them. Completed interviews are read-only.

Every non-WOLF request is passed directly to `env.ASSETS` unchanged.
