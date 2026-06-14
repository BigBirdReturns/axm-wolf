import { defineConfig, devices } from '@playwright/test';

// Minimal ambient declaration so this file type-checks without `@types/node`
// (mirrors the same pattern in vite.config.ts). `playwright.config.ts` only
// runs under Node, where `process` always exists.
declare const process: { env: Record<string, string | undefined> };

// Real-browser end-to-end config (DESIGN.md 14.6). Separate from the
// dependency-free `npm run test:e2e` smoke (scripts/e2e-smoke.mjs), which
// runs under plain Node without a browser.
//
// Base-path note (vite.config.ts): the app builds to `docs/app/` with Vite
// `base: '/axm-wolf/app/'`. `vite preview` honors that configured base, so a
// preview server started at the repo root serves the app under
// `/axm-wolf/app/` -- not at `/`. `use.baseURL` below points at that path so
// `page.goto('/')` in specs lands on the running app.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/axm-wolf/app/',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173/axm-wolf/app/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
