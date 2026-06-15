import test from 'node:test';
import assert from 'node:assert/strict';
import pack from '../../src/packs/contracting-officers-deposition/contracting-officers-deposition.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/index.js';

test('the contracting officers deposition pack validates', () => {
  const p = validatePack(pack);
  assert.equal(p.packId, 'contracting-officers-deposition');
  assert.equal(p.sections.length, 5);
  assert.equal(p.prompts.length, 30);
  assert.equal(p.theme.accent, '#33475b');
});

test('each section contains exactly six prompts and every reference resolves', () => {
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
  // Every authored prompt is placed in exactly one section (no orphans).
  assert.equal(referenced.size, p.prompts.length);
});

test('every prompt resolves a declared lens and the five lenses are all used', () => {
  const p = validatePack(pack);
  const lensIds = new Set(p.lenses.map((l) => l.id));
  assert.equal(lensIds.size, 5);
  const counts: Record<string, number> = {};
  for (const prompt of p.prompts) {
    assert.ok(lensIds.has(prompt.lensId), `prompt ${prompt.id} uses unresolved lens ${prompt.lensId}`);
    counts[prompt.lensId] = (counts[prompt.lensId] ?? 0) + 1;
  }
  // No lens is left unused or left carrying the whole pack: the cognitive net
  // must actually be spread (docs/METHODOLOGY.md). The Room lens is expected to
  // be the heaviest (tacit, off-file knowledge), but every lens earns >= 4.
  for (const lens of p.lenses) {
    assert.ok((counts[lens.id] ?? 0) >= 4, `lens ${lens.id} is underused (${counts[lens.id] ?? 0})`);
  }
  assert.ok(counts.room >= counts.program, 'the Room lens should carry the most weight');
});
