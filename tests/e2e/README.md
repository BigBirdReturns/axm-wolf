# Browser-driven end-to-end tests

`offline.spec.ts` implements the 16-step flow from DESIGN.md 14.6 (create
record, draft survival across reload, two revisions, export/import bundle
round trip, offline reload, Markdown export while offline) against a real
Chromium browser via Playwright's test runner (`@playwright/test`).

## Running

```sh
npx playwright install chromium
npm run test:e2e:real
```

`playwright.config.ts` builds the app and serves it with `vite preview` at
`http://localhost:4173/axm-wolf/app/` (matching the production base path),
then runs the spec against that server.

## Why this is separate from `npm run test:e2e`

`npm run test:e2e` (`scripts/e2e-smoke.mjs`) is a dependency-free static
check of the built `docs/app/` output -- it runs in any Node environment
without a browser and is part of `npm run check`. `test:e2e:real` requires a
downloaded Chromium binary and is intended for CI or a developer machine.

## Known environment caveat

`npx playwright install chromium` downloads the browser binary from
`cdn.playwright.dev`. In sandboxes where that host is not in the network
allowlist, the install step fails and `test:e2e:real` cannot run --
`playwright test --list` still works (it only collects/parses tests, no
browser needed). This is expected; allowlist `cdn.playwright.dev` (or
pre-bake the browser into the image) to run the suite.
