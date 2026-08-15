import test from 'node:test';
import assert from 'node:assert/strict';
import pack from '../../src/packs/clinical-site-operators-deposition/clinical-site-operators-deposition.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/index.js';

test('the clinical site operator deposition pack validates', () => {
  const p = validatePack(pack);
  assert.equal(p.packId, 'clinical-site-operators-deposition');
  assert.equal(p.sections.length, 10);
  assert.equal(p.prompts.length, 60);
  assert.equal(p.recommendedCadence, 'campaign');
});

test('each section has six prompts and every prompt is referenced exactly once', () => {
  const p = validatePack(pack);
  const promptIds = new Set(p.prompts.map((x) => x.id));
  const referenced = new Set<string>();

  for (const section of p.sections) {
    assert.equal(section.promptIds.length, 6, `section ${section.id} should have 6 prompts`);
    for (const id of section.promptIds) {
      assert.ok(promptIds.has(id), `section ${section.id} references missing prompt ${id}`);
      assert.ok(!referenced.has(id), `prompt ${id} is referenced more than once`);
      referenced.add(id);
    }
  }

  assert.equal(referenced.size, p.prompts.length);
});

test('the pack carries all seven clinical retrieval lenses with heavy source and unwritten-rule coverage', () => {
  const p = validatePack(pack);
  const lensIds = new Set(p.lenses.map((lens) => lens.id));
  assert.deepEqual(
    [...lensIds].sort(),
    ['clock', 'fork', 'inspection', 'seat', 'site', 'sop-gap', 'source'].sort(),
  );

  const counts: Record<string, number> = {};
  for (const prompt of p.prompts) {
    assert.ok(lensIds.has(prompt.lensId), `prompt ${prompt.id} uses unresolved lens ${prompt.lensId}`);
    counts[prompt.lensId] = (counts[prompt.lensId] ?? 0) + 1;
  }

  for (const lens of p.lenses) {
    assert.ok((counts[lens.id] ?? 0) >= 6, `lens ${lens.id} is underused (${counts[lens.id] ?? 0})`);
  }
  assert.ok(counts.source >= 10, 'source lens should remain a dominant evidentiary angle');
  assert.ok(counts['sop-gap'] >= 10, 'unwritten operational rules should remain heavily represented');
});

test('the portable challenge section yields six source-authored adversarial primitives', () => {
  const p = validatePack(pack);
  const section = p.sections.find((s) => s.id === 'portable-challenge');
  assert.ok(section);
  assert.deepEqual(section.promptIds, [
    'portable-challenge.three-vendor-questions',
    'portable-challenge.show-me-dont-tell-me',
    'portable-challenge.negative-control',
    'portable-challenge.provider-loss',
    'portable-challenge.machine-refusal',
    'portable-challenge.for-the-record',
  ]);

  const challengePrompts = p.prompts.filter((prompt) => section.promptIds.includes(prompt.id));
  assert.equal(challengePrompts.length, 6);
  for (const prompt of challengePrompts) {
    assert.ok((prompt.tags ?? []).includes('challenge'), `${prompt.id} must be tagged challenge`);
  }
});
