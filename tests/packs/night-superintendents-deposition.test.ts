import test from 'node:test';
import assert from 'node:assert/strict';
import pack from '../../src/packs/night-superintendents-deposition/night-superintendents-deposition.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/index.js';

test('the night superintendents deposition pack validates', () => {
  const p = validatePack(pack);
  assert.equal(p.packId, 'night-superintendents-deposition');
  assert.equal(p.sections.length, 3);
  assert.equal(p.prompts.length, 12);
  assert.equal(p.theme.accent, '#26566b');
});

test('the pack declares itself fictional wherever a reader could encounter it', () => {
  const p = validatePack(pack);
  // The subject is invented; the disclaimer must survive into any record or
  // export created from this pack, so it lives in the fields records copy:
  // description (pack library), subjectDefaults (record header, exports).
  assert.match(p.description ?? '', /fictional/i);
  assert.match(p.subjectDefaults?.subtitle ?? '', /fictional/i);
  assert.match(p.subjectDefaults?.organization ?? '', /fictional/i);
});

test('each section contains exactly four prompts and every reference resolves', () => {
  const p = validatePack(pack);
  const promptIds = new Set(p.prompts.map((x) => x.id));
  const referenced = new Set<string>();
  for (const section of p.sections) {
    assert.equal(section.promptIds.length, 4, `section ${section.id} should have 4 prompts`);
    for (const id of section.promptIds) {
      assert.ok(promptIds.has(id), `section ${section.id} references missing prompt ${id}`);
      referenced.add(id);
    }
  }
  assert.equal(referenced.size, p.prompts.length);
});

test('every prompt resolves a declared lens and each section spreads the lens net', () => {
  const p = validatePack(pack);
  const lensIds = new Set(p.lenses.map((l) => l.id));
  assert.equal(lensIds.size, 4);
  for (const prompt of p.prompts) {
    assert.ok(lensIds.has(prompt.lensId), `prompt ${prompt.id} uses unresolved lens ${prompt.lensId}`);
  }
  // Every era gets a place prompt, an incident prompt, a practice prompt, and
  // an unwritten-ledger prompt (docs/METHODOLOGY.md): each lens appears
  // exactly once per section.
  for (const section of p.sections) {
    const lensesInSection = section.promptIds.map(
      (id) => p.prompts.find((prompt) => prompt.id === id)?.lensId,
    );
    assert.equal(new Set(lensesInSection).size, 4, `section ${section.id} should use all 4 lenses`);
  }
});
