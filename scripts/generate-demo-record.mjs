#!/usr/bin/env node
// Generate a demo .wolfrecord.json from an authored testimony file, driving
// the real engine (validatePack, digestPack, createRecord, commitResponse,
// buildRecordBundle) so the output is valid by construction, never
// hand-assembled. Fictional demo records are authored as a pack + a
// testimony.json; this script turns the pair into an importable bundle.
//
// Usage:
//   node scripts/generate-demo-record.mjs \
//     --pack src/packs/<id>/<id>.wolfpack.json \
//     --testimony examples/<name>/testimony.json \
//     --out examples/<name>/<id>.demo.wolfrecord.json
//
// Testimony file shape (authored by hand; timestamps are deliberate content,
// not generated -- revision IDs are the only nondeterministic output):
//   {
//     "recordId": "uuid",
//     "title": "...",                    // optional; defaults to pack title
//     "subject": { ... },               // optional; defaults to pack subjectDefaults
//     "status": "active",
//     "createdAt": "ISO-8601",
//     "exportedAt": "ISO-8601",
//     "appVersion": "0.1.0",
//     "entries": [ { "promptId": "...", "revisions": [ { "text", "capturedAt", "source" } ] } ],
//     "drafts":  [ { "promptId": "...", "text": "...", "updatedAt": "ISO-8601" } ]
//   }

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i === process.argv.length - 1) {
    console.error(`Missing required argument: --${name}`);
    console.error('Usage: node scripts/generate-demo-record.mjs --pack <path> --testimony <path> --out <path>');
    process.exit(1);
  }
  return process.argv[i + 1];
}

const packPath = arg('pack');
const testimonyPath = arg('testimony');
const outPath = arg('out');

const enginePath = resolve('dist-tests/src/engine/index.js');
if (!existsSync(enginePath)) {
  console.log('Compiled engine not found; running tsc -p tsconfig.test.json ...');
  execSync('npx tsc -p tsconfig.test.json', { stdio: 'inherit' });
}

const engine = await import(pathToFileURL(enginePath).href);
const { validatePack, digestPack, createRecord, commitResponse, buildRecordBundle, importRecordBundle, computeProgress } = engine;

const pack = validatePack(JSON.parse(readFileSync(packPath, 'utf8')));
const testimony = JSON.parse(readFileSync(testimonyPath, 'utf8'));
const packDigest = await digestPack(pack);

let record = createRecord({
  recordId: testimony.recordId,
  pack,
  packDigest,
  appVersion: testimony.appVersion ?? '0.1.0',
  subject: testimony.subject,
  title: testimony.title,
  now: testimony.createdAt,
});

// Commit every authored revision through the engine in chronological order so
// revision chains (supersedesRevisionId) and record timestamps come out the
// way real usage would produce them.
const commits = testimony.entries
  .flatMap((entry) => entry.revisions.map((rev) => ({ promptId: entry.promptId, ...rev })))
  .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

for (const commit of commits) {
  record = commitResponse(record, commit.promptId, commit.text, commit.source, commit.capturedAt);
}

const drafts = (testimony.drafts ?? []).map((d) => ({
  promptId: d.promptId,
  text: d.text,
  updatedAt: d.updatedAt,
}));
const lastActivity = [record.updatedAt, ...drafts.map((d) => d.updatedAt)].sort().at(-1);
record = { ...record, drafts, status: testimony.status ?? 'active', updatedAt: lastActivity };

const bundle = buildRecordBundle(record, {
  includeDrafts: true,
  exportedAt: testimony.exportedAt,
  engineVersion: '0.1.0',
  appVersion: testimony.appVersion ?? '0.1.0',
});

// Round-trip self-check: the emitted bundle must survive the same validation
// the app applies on import.
importRecordBundle(JSON.parse(JSON.stringify(bundle)));

writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

const progress = computeProgress(pack, record);
console.log(`Wrote ${outPath}`);
console.log(
  `  ${progress.answeredPrompts}/${progress.totalPrompts} prompts answered, ` +
    `${progress.draftPrompts} draft(s), ${progress.wordCount} words, ` +
    `${commits.length} committed revision(s)`,
);
