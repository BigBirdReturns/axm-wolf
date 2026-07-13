import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repo = process.cwd();
const source = resolve(process.argv[2] ?? '../Glass_Onion_inspect/Glass_Onion');
const destination = resolve(process.argv[3] ?? 'dist/Glass_Onion');
const wolfBuild = resolve(repo, 'dist/wolf');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await rm(resolve(destination, 'wolf'), { recursive: true, force: true });
await cp(wolfBuild, resolve(destination, 'wolf'), { recursive: true });
await cp(resolve(repo, 'cloudflare/_worker.js'), resolve(destination, '_worker.js'));
await mkdir(resolve(destination, 'wolf/backend'), { recursive: true });
await cp(resolve(repo, 'cloudflare/schema.sql'), resolve(destination, 'wolf/backend/schema.sql'));
await cp(resolve(repo, 'cloudflare/migrate-v0.2-to-v0.3.sql'), resolve(destination, 'wolf/backend/migrate-v0.2-to-v0.3.sql'));
await cp(resolve(repo, 'cloudflare/DEPLOY.md'), resolve(destination, 'wolf/backend/DEPLOY.md'));

const registryPath = resolve(destination, 'registry/index.html');
let registry = await readFile(registryPath, 'utf8');
const priorWolf = /\{title:'Wolf',[^\n]+\}/;
if (!priorWolf.test(registry)) throw new Error('Could not find the Wolf registry entry in Glass Onion.');
registry = registry.replace(
  priorWolf,
  "{title:'Wolf', kind:'spoke', blurb:'Guided institutional interviews with local-first capture and automatic hosted synchronization.', status:'live', path:'wolf/'}",
);
await writeFile(registryPath, registry, 'utf8');

const readmePath = resolve(destination, 'README.md');
let readme = await readFile(readmePath, 'utf8');
readme = readme.replace(
  '3. Satellites (wolf, chat, show, embodied, genesis, core) stay on github.io;\n   they\'re `url:` entries in the registry list.',
  '3. Most satellites stay on github.io. Wolf is the hosted exception at `/wolf/`; its prebuilt `_worker.js` and D1 binding provide interview synchronization.',
);
readme += '\n\n## WOLF hosted exception\n\n`/wolf/` is compiled before assembly. The root `_worker.js` is prebuilt for Cloudflare Pages advanced mode, so the complete folder remains compatible with dashboard drag-and-drop deployment. See `wolf/backend/DEPLOY.md` before the first hosted upload.\n';
await writeFile(readmePath, readme, 'utf8');

console.log(`Assembled Glass Onion deployment at ${destination}`);
