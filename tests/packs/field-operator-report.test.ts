import test from 'node:test';
import assert from 'node:assert/strict';

import packJson from '../../src/packs/field-operator-report/field-operator-report.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/index.js';

test('field operator report is a valid voice-or-text pack with no media requirement', () => {
  const pack = validatePack(packJson);
  assert.equal(pack.packId, 'field-operator-report');
  assert.equal(pack.sections.length, 2);
  assert.equal(pack.prompts.length, 8);
  assert.ok(pack.prompts.every((prompt) => prompt.kind === 'long_text'));
  assert.ok(pack.prompts.every((prompt) => !/photo|photograph|screenshot|video/i.test(prompt.text)));
});
