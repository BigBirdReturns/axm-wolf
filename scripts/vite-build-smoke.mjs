import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
copyFileSync('index.html', 'dist/index.html');
writeFileSync('dist/build-smoke.txt', 'Vite scaffold present; full bundling awaits dependency installation.\n');
console.log('Build smoke complete.');
