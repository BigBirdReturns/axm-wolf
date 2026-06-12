// Offline/PWA static smoke check (DESIGN.md Part 11, Part 14.6).
//
// Builds the app, then statically verifies the `dist/` output:
// - a service worker and web manifest are present
// - `index.html` references all build assets via relative paths (no
//   leading '/'), which is required for base-path safety (DESIGN.md 11.3)
//   so the same build works at both `https://example.com/` and
//   `https://example.com/axm-wolf/`.
//
// This does not require a browser and runs in any CI environment. A full
// Playwright offline e2e test (build + preview + offline reload) is added
// separately when a Chromium download is available in the environment --
// see tests/e2e/offline.spec.ts and the `test:e2e:real` script.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');

console.log('Building app (vite build)...');
execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });

function requireFile(relPath) {
  const full = join(distDir, relPath);
  if (!existsSync(full)) {
    throw new Error(`Expected dist/${relPath} to exist after build, but it does not.`);
  }
  return full;
}

const swPath = requireFile('sw.js');
const manifestPath = requireFile('manifest.webmanifest');
const indexPath = requireFile('index.html');

console.log('dist/sw.js present:', swPath);
console.log('dist/manifest.webmanifest present:', manifestPath);

const indexHtml = readFileSync(indexPath, 'utf8');

// Collect every src="" / href="" attribute value.
const refs = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);

if (refs.length === 0) {
  throw new Error('index.html has no src/href references to check.');
}

const absoluteRefs = refs.filter((ref) => ref.startsWith('/') && !ref.startsWith('//'));
if (absoluteRefs.length > 0) {
  throw new Error(
    `index.html contains absolute (leading "/") asset references, which break base-path ` +
      `safety (DESIGN.md 11.3): ${absoluteRefs.join(', ')}`,
  );
}

const mustReference = ['manifest.webmanifest'];
for (const name of mustReference) {
  if (!refs.some((ref) => ref.includes(name))) {
    throw new Error(`index.html does not reference ${name}.`);
  }
}

console.log('index.html asset references (all relative):', refs);

// The service worker itself must also be discoverable via a relative path
// from the site root -- vite-plugin-pwa serves it at dist/sw.js, which
// resolves relative to the deployed base path automatically.
if (!existsSync(swPath)) {
  throw new Error('dist/sw.js missing.');
}

console.log('Offline/PWA static smoke check passed.');
