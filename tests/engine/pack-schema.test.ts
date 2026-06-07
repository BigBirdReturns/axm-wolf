import test from 'node:test';
import assert from 'node:assert/strict';
import genericPack from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import wolfPack from '../../src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json' with { type: 'json' };
import { validatePack, WolfValidationError } from '../../src/engine/index.js';

test('validates the generic non-Wolf fixture', () => {
  const pack = validatePack(genericPack);
  assert.equal(pack.sections.length, 2);
  assert.equal(pack.prompts.length, 5);
  assert.equal(pack.theme.accent, '#215f6d');
});

test('validates the first bundled capture pack', () => {
  const pack = validatePack(wolfPack);
  assert.equal(pack.sections.length, 7);
  assert.equal(pack.prompts.length, 58);
});

test('rejects duplicate prompt IDs', () => {
  const malformed = structuredClone(genericPack);
  malformed.prompts[1].id = malformed.prompts[0].id;
  assert.throws(() => validatePack(malformed), WolfValidationError);
});

test('rejects unresolved lens references', () => {
  const malformed = structuredClone(genericPack);
  malformed.prompts[0].lensId = 'missing-lens';
  assert.throws(() => validatePack(malformed), /unresolved lens/);
});

test('rejects HTML-bearing imported strings', () => {
  const malformed = structuredClone(genericPack);
  malformed.prompts[0].text = '<img src=x onerror=alert(1)>';
  assert.throws(() => validatePack(malformed), /plain text/);
});

test('rejects unknown fields by default', () => {
  const malformed = { ...genericPack, executable: 'never' };
  assert.throws(() => validatePack(malformed), /not allowed/);
});

test('rejects incompatible engine versions loudly', () => {
  const malformed = { ...genericPack, engineVersion: '>=9.0.0 <10.0.0' };
  assert.throws(() => validatePack(malformed), /incompatible/);
});
