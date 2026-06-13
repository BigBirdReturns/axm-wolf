import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePackFromText, bundledPackToStoredPack } from '../../src/app/lib/packImport.js';
import { WolfValidationError } from '../../src/engine/index.js';
import genericFixture from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };

test('parsePackFromText accepts the generic fixture', async () => {
  const text = JSON.stringify(genericFixture);
  const { pack, digest } = await parsePackFromText(text);

  assert.equal(pack.packId, 'departing-engineer-handoff');
  assert.equal(pack.packVersion, '1.0.0');
  assert.match(digest, /^[0-9a-f]{64}$/);
});

test('parsePackFromText rejects non-JSON text with WolfValidationError', async () => {
  let threw: unknown = null;
  try {
    await parsePackFromText('not json {{{');
  } catch (err) {
    threw = err;
  }
  assert.ok(threw instanceof WolfValidationError);
});

test('parsePackFromText rejects a malformed pack', async () => {
  const broken = JSON.parse(JSON.stringify(genericFixture)) as typeof genericFixture;
  // Duplicate a prompt id to break uniqueness validation.
  broken.prompts[1].id = broken.prompts[0].id;
  const text = JSON.stringify(broken);

  let threw: unknown = null;
  try {
    await parsePackFromText(text);
  } catch (err) {
    threw = err;
  }
  assert.ok(threw instanceof WolfValidationError);
});

test('bundledPackToStoredPack produces trust imported_unsigned and a valid digest', async () => {
  const text = JSON.stringify(genericFixture);
  const { pack, digest } = await parsePackFromText(text);

  const stored = bundledPackToStoredPack(pack, digest, '2024-01-01T00:00:00.000Z');

  assert.equal(stored.trust, 'imported_unsigned');
  assert.equal(stored.packId, pack.packId);
  assert.equal(stored.packVersion, pack.packVersion);
  assert.equal(stored.installedAt, '2024-01-01T00:00:00.000Z');
  assert.match(stored.digest, /^[0-9a-f]{64}$/);
  assert.equal(stored.digest, digest);
});
