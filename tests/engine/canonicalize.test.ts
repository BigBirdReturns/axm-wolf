import test from 'node:test';
import assert from 'node:assert/strict';
import genericPack from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/schema.js';
import { canonicalizePack } from '../../src/engine/canonicalize.js';
import { digestPack } from '../../src/engine/digest.js';
import type { CapturePack } from '../../src/engine/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a CapturePack from the fixture via validatePack. */
function fixture(): CapturePack {
  return validatePack(genericPack);
}

/**
 * Return a shallow-reordered clone of a plain-object record.
 * Keys are reversed so that the insertion order is opposite to the original.
 */
function reverseKeys<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const key of Object.keys(obj).reverse()) {
    (result as Record<string, unknown>)[key] = (obj as Record<string, unknown>)[key];
  }
  return result;
}

/**
 * Deep-clone via JSON round-trip, then reverse every object's keys recursively.
 * This exercises the canonicalizer's recursive key-sorting because the
 * in-memory key insertion order is deliberately inverted.
 */
function deepReverseKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepReverseKeys);
  const obj = value as Record<string, unknown>;
  const reversed = reverseKeys(obj);
  for (const k of Object.keys(reversed)) {
    (reversed as Record<string, unknown>)[k] = deepReverseKeys((reversed as Record<string, unknown>)[k]);
  }
  return reversed;
}

// ---------------------------------------------------------------------------
// canonicalizePack — stability across key reordering
// ---------------------------------------------------------------------------

test('canonical string is stable across key reordering', () => {
  const pack = fixture();

  // Build a second object with the same data but every nested object's keys
  // inserted in reverse order.
  const reordered = deepReverseKeys(pack) as CapturePack;

  const a = canonicalizePack(pack);
  const b = canonicalizePack(reordered);

  assert.equal(typeof a, 'string');
  assert.ok(a.length > 0);
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// canonicalizePack — validatePack round-trip also produces identical strings
// ---------------------------------------------------------------------------

test('canonical string is equal for validatePack result and a reordered clone', () => {
  const validated = fixture();

  // Build an alternative object by constructing the same CapturePack shape
  // but with top-level keys in a different order.
  const alternative: CapturePack = {
    theme: validated.theme,
    prompts: validated.prompts,
    sections: validated.sections,
    lenses: validated.lenses,
    title: validated.title,
    packVersion: validated.packVersion,
    engineVersion: validated.engineVersion,
    packId: validated.packId,
    schemaVersion: validated.schemaVersion,
    exportDefaults: validated.exportDefaults,
    subtitle: validated.subtitle,
    description: validated.description,
    subjectDefaults: validated.subjectDefaults,
  };

  assert.equal(canonicalizePack(validated), canonicalizePack(alternative));
});

// ---------------------------------------------------------------------------
// canonicalizePack — array order is preserved
// ---------------------------------------------------------------------------

test('array order is preserved: reversing sections changes the canonical string', () => {
  const pack = fixture();

  const reversed: CapturePack = {
    ...pack,
    sections: [...pack.sections].reverse(),
  };

  const original = canonicalizePack(pack);
  const reordered = canonicalizePack(reversed);

  // The same sections in different order must produce a different string.
  assert.ok(original !== reordered, 'reversed section order must change the canonical string');
});

test('array order is preserved: reversing prompts within a section changes the canonical string', () => {
  const pack = fixture();

  const firstSection = pack.sections[0];
  // Only proceed if the section has more than one prompt.
  if (firstSection.promptIds.length < 2) {
    // Trivially pass — nothing to reverse.
    return;
  }

  const modifiedSections = pack.sections.map((section, i) =>
    i === 0
      ? { ...section, promptIds: [...section.promptIds].reverse() }
      : section
  );

  const modified: CapturePack = { ...pack, sections: modifiedSections };

  assert.ok(
    canonicalizePack(pack) !== canonicalizePack(modified),
    'reversed promptIds must change the canonical string'
  );
});

// ---------------------------------------------------------------------------
// canonicalizePack — string contents are preserved exactly
// ---------------------------------------------------------------------------

test('canonical string parses back to a valid JSON object', () => {
  const pack = fixture();
  const canonical = canonicalizePack(pack);
  const parsed = JSON.parse(canonical) as Record<string, unknown>;

  assert.equal(parsed['packId'], pack.packId);
  assert.equal(parsed['title'], pack.title);
});

// ---------------------------------------------------------------------------
// digestPack — basic properties
// ---------------------------------------------------------------------------

test('digestPack returns a 64-character lowercase hex string', async () => {
  const pack = fixture();
  const hex = await digestPack(pack);

  assert.equal(typeof hex, 'string');
  assert.equal(hex.length, 64);
  assert.match(hex, /^[0-9a-f]{64}$/);
});

// ---------------------------------------------------------------------------
// digestPack — determinism
// ---------------------------------------------------------------------------

test('digestPack is deterministic across repeated calls', async () => {
  const pack = fixture();
  const first = await digestPack(pack);
  const second = await digestPack(pack);
  assert.equal(first, second);
});

// ---------------------------------------------------------------------------
// digestPack — key-reordering invariance
// ---------------------------------------------------------------------------

test('digest is identical for key-reordered but logically equal packs', async () => {
  const pack = fixture();
  const reordered = deepReverseKeys(pack) as CapturePack;

  const a = await digestPack(pack);
  const b = await digestPack(reordered);

  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// digestPack — sensitivity to content changes
// ---------------------------------------------------------------------------

test('digest differs when a prompt text changes by one character', async () => {
  const pack = fixture();
  const original = await digestPack(pack);

  // Append a single character to the first prompt's text.
  const modified: CapturePack = {
    ...pack,
    prompts: pack.prompts.map((p, i) =>
      i === 0 ? { ...p, text: p.text + 'X' } : p
    ),
  };

  const changed = await digestPack(modified);

  assert.ok(original !== changed, 'one-character prompt change must change the digest');
});
