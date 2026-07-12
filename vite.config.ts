import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// AXM Arc-style Pages deploy: the build output lives in `docs/app/` so the
// same `docs/` tree carries both the hand-authored landing page
// (`docs/index.html`) and the freshly built PWA (`docs/app/`). The build
// directory is gitignored and produced by `npm run build` -- in CI by
// `.github/workflows/deploy.yml`, which uploads the whole `docs/` tree to
// GitHub Pages so visitors get the essay at `/axm-wolf/` and the running
// app at `/axm-wolf/app/`. The base path matches `bigbirdreturns.github.io`
// hosting; the relative `start_url`/`scope` in the manifest keep the PWA
// install + service worker valid at any subpath (DESIGN.md 11.3).

const GITHUB_PAGES_BASE = '/axm-wolf/app/';
const GLASS_ONION_BASE = '/wolf/';

// Minimal ambient declaration so this file type-checks without `@types/node`
// (the project has no other Node-typed sources). `vite.config.ts` only runs
// under Node, where these globals always exist.
declare const process: { env: Record<string, string | undefined>; cwd: () => string };

// Deploy-mode-aware manifest naming (DESIGN.md 9.4, 11.3). This mirrors
// `src/app/config.ts`'s validation but is evaluated at build-config time,
// where `import.meta.env` is not available -- `loadEnv` reads the same
// `VITE_*` variables (from the shell or `.env` files) without requiring
// Node type definitions for `process.env`.
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), 'VITE_');
const deployMode = env.VITE_DEPLOY_MODE === 'single-pack' ? 'single-pack' : 'platform';

const isSinglePack = deployMode === 'single-pack';

const manifestName = isSinglePack ? "The Wolf's Deposition" : 'AXM Wolf';
const manifestShortName = isSinglePack ? "Wolf's Dep." : 'AXM Wolf';
const manifestDescription = isSinglePack
  ? "William Sandhu's oral history, captured locally in this browser."
  : 'A local-first engine for capturing tacit institutional knowledge through structured, self-directed testimony.';

export default defineConfig(({ mode }) => ({
  base: mode === 'glass-onion' ? GLASS_ONION_BASE : GITHUB_PAGES_BASE,
  plugins: [
    react(),
    VitePWA({
      // DESIGN.md 11.2: activation must be user-controlled, never silent.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: manifestName,
        short_name: manifestShortName,
        description: manifestDescription,
        // Relative start_url/scope keep the manifest valid at any subpath
        // (DESIGN.md 11.3).
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#7a4a1e',
        background_color: '#f0ebe0',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // DESIGN.md 11.1: precache the app shell, compiled assets, local
        // icons/fonts, and the bundled pack JSON. The pack JSON is imported
        // by a JS module (src/app/hooks/useWolfApp.ts) and is therefore
        // bundled into a hashed chunk already covered by the `js` pattern
        // below -- no separate entry is needed.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // DESIGN.md 11.4: no runtime network policy beyond the local app
        // shell -- there are no remote origins to add runtime caching for.
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    outDir: mode === 'glass-onion' ? 'dist/wolf' : 'docs/app',
    emptyOutDir: true,
  },
}));
