import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeFilename } from '../../src/engine/filenames.js';

// ---------------------------------------------------------------------------
// Basic sanitization
// ---------------------------------------------------------------------------

test('sanitizeFilename: passes through a clean simple name', () => {
  assert.equal(sanitizeFilename('myfile'), 'myfile');
});

test('sanitizeFilename: replaces spaces with dashes', () => {
  assert.equal(sanitizeFilename('hello world'), 'hello-world');
});

test('sanitizeFilename: replaces whitespace runs with a single dash', () => {
  assert.equal(sanitizeFilename('hello   world'), 'hello-world');
});

test('sanitizeFilename: replaces tab whitespace with a dash', () => {
  const result = sanitizeFilename('foo\tbar');
  assert.equal(result, 'foo-bar');
});

test('sanitizeFilename: removes unsafe characters', () => {
  assert.equal(sanitizeFilename('file!@#$name'), 'filename');
});

test('sanitizeFilename: removes forward slashes (directory traversal prevention)', () => {
  assert.equal(sanitizeFilename('path/to/file'), 'pathtofile');
});

test('sanitizeFilename: removes backslashes (directory traversal prevention)', () => {
  assert.equal(sanitizeFilename('path\\to\\file'), 'pathtofile');
});

test('sanitizeFilename: strips "../" traversal pattern', () => {
  const result = sanitizeFilename('../../../etc/passwd');
  assert.ok(!result.includes('..'), 'result must not contain ".."');
  assert.ok(!result.includes('/'), 'result must not contain "/"');
});

test('sanitizeFilename: strips ".." from string containing it', () => {
  const result = sanitizeFilename('foo..bar');
  assert.ok(!result.includes('..'), 'result must not contain ".."');
});

test('sanitizeFilename: allows dots within names', () => {
  const result = sanitizeFilename('record.2024.v1');
  assert.equal(result, 'record.2024.v1');
});

test('sanitizeFilename: allows hyphens within names', () => {
  const result = sanitizeFilename('my-record-file');
  assert.equal(result, 'my-record-file');
});

test('sanitizeFilename: preserves underscores (in the safe set [A-Za-z0-9._-])', () => {
  const result = sanitizeFilename('my_record');
  assert.equal(result, 'my_record');
});

test('sanitizeFilename: strips leading dots', () => {
  const result = sanitizeFilename('.hidden');
  assert.ok(!result.startsWith('.'), 'result must not start with a dot');
});

test('sanitizeFilename: strips trailing dots', () => {
  const result = sanitizeFilename('filename.');
  assert.ok(!result.endsWith('.'), 'result must not end with a dot');
});

test('sanitizeFilename: strips leading dashes', () => {
  const result = sanitizeFilename('-leading');
  assert.ok(!result.startsWith('-'), 'result must not start with a dash');
});

test('sanitizeFilename: strips trailing dashes', () => {
  const result = sanitizeFilename('trailing-');
  assert.ok(!result.endsWith('-'), 'result must not end with a dash');
});

test('sanitizeFilename: caps at 100 characters', () => {
  const long = 'a'.repeat(200);
  const result = sanitizeFilename(long);
  assert.ok(result.length <= 100, `result length ${result.length} should be <= 100`);
});

test('sanitizeFilename: returns "record" for empty string', () => {
  assert.equal(sanitizeFilename(''), 'record');
});

test('sanitizeFilename: returns "record" for string with only unsafe characters', () => {
  assert.equal(sanitizeFilename('!@#$%^&*()'), 'record');
});

test('sanitizeFilename: returns "record" for string of only spaces', () => {
  // spaces → dash → stripped leading/trailing → empty → 'record'
  assert.equal(sanitizeFilename('   '), 'record');
});

// ---------------------------------------------------------------------------
// Directory traversal prevention
// ---------------------------------------------------------------------------

test('sanitizeFilename: strips "../../" traversal attempt', () => {
  const result = sanitizeFilename('../../etc/passwd');
  assert.ok(!result.includes('..'), '"." sequences collapsed');
  assert.ok(!result.includes('/'), 'slashes removed');
});

test('sanitizeFilename: complex traversal with encoded-like pattern', () => {
  const result = sanitizeFilename('....//evil');
  assert.ok(!result.includes('..'), '"dot-dot" must not survive');
  assert.ok(!result.includes('/'), 'slash must not survive');
});

// ---------------------------------------------------------------------------
// Collapsing repeats
// ---------------------------------------------------------------------------

test('sanitizeFilename: collapses repeated dashes', () => {
  // After replacing special chars, "---" may appear
  const result = sanitizeFilename('foo---bar');
  assert.ok(!result.includes('--'), 'repeated dashes should be collapsed');
});

// ---------------------------------------------------------------------------
// Mixed realistic scenarios
// ---------------------------------------------------------------------------

test('sanitizeFilename: typical record title becomes safe filename', () => {
  const result = sanitizeFilename('My Interview Record 2024');
  assert.equal(result, 'My-Interview-Record-2024');
});

test('sanitizeFilename: pack-style name is preserved', () => {
  const result = sanitizeFilename('departing-engineer-handoff');
  assert.equal(result, 'departing-engineer-handoff');
});

test('sanitizeFilename: preserves alphanumeric characters', () => {
  const result = sanitizeFilename('ABC123xyz');
  assert.equal(result, 'ABC123xyz');
});
