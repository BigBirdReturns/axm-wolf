import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import packJson from '../../src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json' with { type: 'json' };
import migrationMap from '../../src/packs/wolfs-deposition/legacy-id-migration-map.json' with { type: 'json' };
import inventory from '../../reference/legacy-v0/prompt-inventory.json' with { type: 'json' };
import { validatePack } from '../../src/engine/index.js';

function readLegacyEras(): Array<{ id: string; questions: Array<{ text: string; sub: string | null }> }> {
  const html = readFileSync('reference/legacy-v0/index.html', 'utf8');
  const match = html.match(/const ERAS = (\[[\s\S]*?\n\]);/);
  assert.ok(match, 'legacy ERAS array exists');
  return vm.runInNewContext(match[1]);
}

test('legacy source inventory is 7 sections and 58 prompts, not the stale 62 claim', () => {
  const eras = readLegacyEras();
  assert.equal(eras.length, 7);
  assert.equal(eras.reduce((total, era) => total + era.questions.length, 0), 58);
  assert.equal(inventory.actualSectionCount, 7);
  assert.equal(inventory.actualPromptCount, 58);
});

test('first pack has unique prompt IDs and derived totals', () => {
  const pack = validatePack(packJson);
  assert.equal(pack.sections.length, 7);
  assert.equal(pack.prompts.length, 58);
  assert.equal(new Set(pack.prompts.map((prompt) => prompt.id)).size, 58);
});

test('complete legacy ID migration map targets existing prompt IDs', () => {
  const pack = validatePack(packJson);
  const promptIds = new Set(pack.prompts.map((prompt) => prompt.id));
  const entries = Object.entries(migrationMap);
  assert.equal(entries.length, 58);
  for (const [legacyKey, promptId] of entries) {
    assert.match(legacyKey, /^[a-z_]+__\d+$/);
    assert.equal(promptIds.has(String(promptId)), true, `${legacyKey} target exists`);
  }
});

test('extracted pack preserves legacy prompt text and context cues', () => {
  const eras = readLegacyEras();
  const promptsById = new Map(validatePack(packJson).prompts.map((prompt) => [prompt.id, prompt]));
  for (const era of eras) {
    era.questions.forEach((legacyQuestion, index) => {
      const promptId = migrationMap[`${era.id}__${index}` as keyof typeof migrationMap];
      const prompt = promptsById.get(promptId);
      assert.ok(prompt, `prompt exists for ${era.id}__${index}`);
      assert.equal(prompt.text, legacyQuestion.text);
      assert.equal(prompt.context, legacyQuestion.sub);
    });
  }
});

test('new production sources do not hard-code the stale 62-question claim', () => {
  const files = [
    'src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json',
    'src/app/main.tsx',
    'index.html'
  ];
  for (const file of files) {
    assert.equal(readFileSync(file, 'utf8').includes('62'), false, `${file} has no stale hard-coded 62`);
  }
});
