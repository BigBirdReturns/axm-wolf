import test from 'node:test';
import assert from 'node:assert/strict';

import { createDebounceScheduler } from '../../src/app/hooks/useDraftAutosave.js';

test('schedule runs after the delay', async () => {
  const scheduler = createDebounceScheduler(10);
  let ran = false;
  scheduler.schedule(() => {
    ran = true;
  });
  assert.equal(ran, false);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(ran, true);
});

test('a later schedule call cancels the earlier pending call', async () => {
  const scheduler = createDebounceScheduler(10);
  let calls = 0;
  let lastValue = '';
  scheduler.schedule(() => {
    calls += 1;
    lastValue = 'first';
  });
  scheduler.schedule(() => {
    calls += 1;
    lastValue = 'second';
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(calls, 1);
  assert.equal(lastValue, 'second');
});

test('cancel prevents the pending call from running', async () => {
  const scheduler = createDebounceScheduler(10);
  let ran = false;
  scheduler.schedule(() => {
    ran = true;
  });
  scheduler.cancel();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(ran, false);
});

test('flush runs the pending call immediately and clears it', async () => {
  const scheduler = createDebounceScheduler(1000);
  let calls = 0;
  scheduler.schedule(() => {
    calls += 1;
  });
  scheduler.flush();
  assert.equal(calls, 1);

  // After flush, the original timer should not also fire.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(calls, 1);
});

test('flush with nothing pending is a no-op', () => {
  const scheduler = createDebounceScheduler(10);
  scheduler.flush();
  assert.ok(true);
});
