import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps the build relative-path safe so the same `dist/`
// output can be served from a sub-path or the repo root (DESIGN.md 11.3).
// Full PWA / service-worker handling is deferred to Phase 5.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
