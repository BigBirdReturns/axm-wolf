import test from 'node:test';
import assert from 'node:assert/strict';
import pack from '../../src/packs/senior-engineer-handoff/senior-engineer-handoff.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/index.js';

test('the departing engineer handoff pack validates', () => {
  const p = validatePack(pack);
  assert.equal(p.packId, 'senior-engineer-handoff');
  assert.equal(p.sections.length, 5);
  assert.equal(p.prompts.length, 30);
  assert.equal(p.recommendedCadence, 'campaign');
});

test('each section has six prompts and every reference resolves, with no orphans', () => {
  const p = validatePack(pack);
  const promptIds = new Set(p.prompts.map((x) => x.id));
  const referenced = new Set<string>();
  for (const section of p.sections) {
    assert.equal(section.promptIds.length, 6, `section ${section.id} should have 6 prompts`);
    for (const id of section.promptIds) {
      assert.ok(promptIds.has(id), `section ${section.id} references missing prompt ${id}`);
      referenced.add(id);
    }
  }
  assert.equal(referenced.size, p.prompts.length);
});

test('all five engineering lenses resolve and the Unwritten Rule lens carries the most', () => {
  const p = validatePack(pack);
  const lensIds = new Set(p.lenses.map((l) => l.id));
  assert.equal(lensIds.size, 5);
  const counts: Record<string, number> = {};
  for (const prompt of p.prompts) {
    assert.ok(lensIds.has(prompt.lensId), `prompt ${prompt.id} uses unresolved lens ${prompt.lensId}`);
    counts[prompt.lensId] = (counts[prompt.lensId] ?? 0) + 1;
  }
  for (const lens of p.lenses) {
    assert.ok((counts[lens.id] ?? 0) >= 4, `lens ${lens.id} is underused (${counts[lens.id] ?? 0})`);
  }
  // The tacit, off-the-record lens should dominate (docs/METHODOLOGY.md).
  const maxCount = Math.max(...Object.values(counts));
  assert.equal(counts['unwritten-rule'], maxCount, 'the Unwritten Rule lens should carry the most weight');
});
