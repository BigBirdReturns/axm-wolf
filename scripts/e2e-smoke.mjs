// Offline/PWA static smoke check (DESIGN.md Part 11, Part 14.6).
//
// Builds the app, then statically verifies the `docs/app/` output:
// - a service worker and web manifest are present
// - `index.html` references all build assets via the Pages base path,
//   never via leading-'/' root paths that would break a subpath deploy
//   (DESIGN.md 11.3). The configured base is `/axm-wolf/app/`; we accept
//   that prefix or any non-leading-'/' relative reference, and reject
//   anything else.
//
// This does not require a browser and runs in any CI environment. A full
// Playwright offline e2e test (build + preview + offline reload) is added
// separately when a Chromium download is available in the environment --
// see tests/e2e/offline.spec.ts and the `test:e2e:real` script.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'docs', 'app');
const BASE = '/axm-wolf/app/';

console.log('Building app (vite build)...');
execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });

function requireFile(relPath) {
  const full = join(distDir, relPath);
  if (!existsSync(full)) {
    throw new Error(`Expected docs/app/${relPath} to exist after build, but it does not.`);
  }
  return full;
}

const swPath = requireFile('sw.js');
const manifestPath = requireFile('manifest.webmanifest');
const indexPath = requireFile('index.html');

console.log('docs/app/sw.js present:', swPath);
console.log('docs/app/manifest.webmanifest present:', manifestPath);

const indexHtml = readFileSync(indexPath, 'utf8');

// Collect every src="" / href="" attribute value.
const refs = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);

if (refs.length === 0) {
  throw new Error('index.html has no src/href references to check.');
}

// References must either start with the Pages base path or be a non-root
// relative path. A leading "/" that isn't the configured base would break
// the deploy.
const badRefs = refs.filter(
  (ref) => ref.startsWith('/') && !ref.startsWith('//') && !ref.startsWith(BASE),
);
if (badRefs.length > 0) {
  throw new Error(
    `index.html contains absolute references that do not match the Pages base ` +
      `path "${BASE}" (DESIGN.md 11.3): ${badRefs.join(', ')}`,
  );
}

const mustReference = ['manifest.webmanifest'];
for (const name of mustReference) {
  if (!refs.some((ref) => ref.includes(name))) {
    throw new Error(`index.html does not reference ${name}.`);
  }
}

console.log('index.html asset references:', refs);
console.log('Offline/PWA static smoke check passed.');
