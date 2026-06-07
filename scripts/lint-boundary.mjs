import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const forbiddenImports = [/from ['"](?:\.\.\/)*packs\//, /from ['"](?:\.\.\/)*app\//, /from ['"](?:\.\.\/)*storage\//, /src\/packs/, /src\/app/, /src\/storage/];
const forbiddenContent = ['William Sandhu', 'HP', 'Agilent', 'EDS', 'Autonomy', "Wolf's Deposition", 'oral history', 'career era', 'The Room', 'The Decision', 'The Person', 'The Moment', 'The Thing Nobody Said'];
const engineDir = 'src/engine';
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(ts|tsx|js|mjs)$/.test(path)) files.push(path);
  }
}
walk(engineDir);
let failed = false;
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbiddenImports) {
    if (pattern.test(content)) {
      console.error(`${file}: forbidden engine import matched ${pattern}`);
      failed = true;
    }
  }
  for (const phrase of forbiddenContent) {
    if (content.includes(phrase)) {
      console.error(`${file}: first-pack-specific phrase found: ${phrase}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log(`Engine boundary OK (${files.length} files scanned).`);
