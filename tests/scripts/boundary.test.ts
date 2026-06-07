import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('engine/content/storage/UI boundary script passes', () => {
  const output = execFileSync('node', ['scripts/lint-boundary.mjs'], { encoding: 'utf8' });
  assert.match(output, /Engine boundary OK/);
});
