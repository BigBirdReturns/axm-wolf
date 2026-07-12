import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Dedicated Vitest config for the component-test layer (DESIGN.md 14.1,
 * 14.5). Kept separate from `vite.config.ts` so the PWA plugin (and its
 * Pages-deploy base path / manifest config) never runs under the test
 * environment -- this config only needs the React plugin plus jsdom.
 *
 * This layer is intentionally separate from the `npm test` node:test gate
 * (tests/engine, tests/storage, tests/app, tests/packs, tests/scripts):
 * those suites use `node:test`'s own API and would error if picked up here.
 * The `include` below restricts Vitest to `tests/components/**`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/components/setup.ts'],
    include: ['tests/components/**/*.test.{ts,tsx}'],
    testTimeout: 10_000,
  },
});
