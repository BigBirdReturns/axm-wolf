# Deployment

AXM Wolf builds to a static site with no backend. Any static host works. This document covers the build, environment configuration, subpath safety, and two concrete hosting paths: Cloudflare Pages and GitHub Pages.

## Build

```bash
npm ci
npm run build
```

Output goes to `dist/`. `npm run build` runs `tsc -p tsconfig.build.json && vite build`.

## Environment variables

Set these at build time (they are read via `import.meta.env` and validated at startup by `src/app/config.ts`):

| Variable | Values | Effect |
| --- | --- | --- |
| `VITE_DEPLOY_MODE` | `platform` (default) or `single-pack` | `platform` shows the record library and pack library first. `single-pack` emphasizes one pack on launch. |
| `VITE_DEFAULT_PACK_ID` | a pack ID, e.g. `wolfs-deposition` | Required when `VITE_DEPLOY_MODE=single-pack`; ignored (but harmless if set) in `platform` mode. |

An invalid or incomplete combination (e.g. `single-pack` without `VITE_DEFAULT_PACK_ID`) throws at startup -- a misconfigured deployment fails loudly rather than silently falling back.

Example for William Sandhu's single-pack deployment:

```bash
VITE_DEPLOY_MODE=single-pack VITE_DEFAULT_PACK_ID=wolfs-deposition npm run build
```

Example for the general platform deployment:

```bash
VITE_DEPLOY_MODE=platform npm run build
```

(or simply `npm run build`, since `platform` is the default.)

## Subpath safety

`vite.config.ts` sets `base: './'`, so every asset and route reference in the built output is relative. The same `dist/` build works whether served from a domain root (`https://example.com/`) or a subpath (`https://example.com/axm-wolf/`). Routing is hash-based (`#/records`, `#/record/:id`, ...), so a page refresh on any route does not require server-side rewrite rules.

## Cloudflare Pages

1. Connect the repository to a Cloudflare Pages project (or use `wrangler pages deploy`).
2. Build command: `npm run build`
3. Build output directory: `dist`
4. Set environment variables under the Pages project's build configuration:
   - For a platform deployment: leave `VITE_DEPLOY_MODE` unset, or set it to `platform`.
   - For a single-pack deployment (e.g. William's app): set `VITE_DEPLOY_MODE=single-pack` and `VITE_DEFAULT_PACK_ID=wolfs-deposition`.
5. Cloudflare can run two separate Pages projects from the same repository and branch, each with its own environment variables -- one in platform mode, one in single-pack mode -- with no forked codebase.

No Cloudflare-specific configuration files are required: it is a standard static build.

## GitHub Pages (Actions)

Build the site at deploy time in CI; do not commit `dist/` to the repository (following the arc-family pattern used by sibling AXM projects).

Outline of a workflow:

1. On push to the deploy branch, run `npm ci && npm run build`, with `VITE_DEPLOY_MODE` (and `VITE_DEFAULT_PACK_ID` if needed) set as workflow environment variables or repository variables.
2. Upload `dist/` as a Pages artifact (`actions/upload-pages-artifact`).
3. Deploy with `actions/deploy-pages`.

Because the build uses a relative base path, this works for both the root `https://<user>.github.io/` and a project page at `https://<user>.github.io/axm-wolf/` without extra configuration.

### Recipient start links

After deployment, the platform launch screen can copy a guided invitation for each installed pack. Its stable form is:

```text
https://<user>.github.io/axm-wolf/app/#/start/<pack-id>
```

The recipient view explains voice transcription, draft autosave, explicit Save to Record, local storage, stopping and resuming, and final sharing. It creates or resumes only the selected pack and hides administrative navigation for that browser tab.

For multi-recipient work, use **Dashboard → Create a recipient invitation**. Each labeled invitation carries a unique assignment ID in the URL. The recipient's returned record uses that ID, allowing the local dashboard to match returns without relying on a name. The dashboard can import several `.wolfrecord.json` files in one selection and tracks `invited`, `received`, `analyzing`, and `completed` states.

The static deployment cannot observe whether somebody opened or started an invitation. An assignment remains `invited` until its return file is imported, unless the operator changes the workflow state manually.

### Glass Onion hosted mode

Run `npm run build:glass-onion`, then `npm run assemble:glass-onion -- <Glass_Onion source> <destination>`. The assembly preserves the source site, writes the WOLF app under `/wolf/`, adds a prebuilt root `_worker.js`, changes the registry entry from the GitHub Pages URL to `path: 'wolf/'`, and includes `wolf/backend/schema.sql`, migrations, and first-deployment instructions.

The complete folder remains the release artifact, but the live `axm.tools` target is now a Workers Static Assets project. Deploy it with the checked-in Wrangler configuration so the root Worker script, static assets, and D1 binding travel together. Before the first deployment, create and migrate the D1 database, bind it as `WOLF_DB`, and configure one Cloudflare Access application for `/wolf/dashboard` and `/wolf/api/operator/*` using email one-time PIN authentication. Set `WOLF_OWNER_EMAIL`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD`; the assembled `wolf/backend/DEPLOY.md` gives the exact values. Hosted interview URLs use `/wolf/SUR## #k=<capability>` (without the displayed space). Non-WOLF assets remain unchanged and bypass the Worker script.

## After deploying

The app is installable as a PWA from any of the hosts above (served over HTTPS, which both Cloudflare Pages and GitHub Pages provide by default). After the first successful load, the app shell, the bundled pack, and core capture/search/export functions work offline. When a new build is deployed, returning users see an update notice and can choose when to activate it; IndexedDB data persists across updates.
