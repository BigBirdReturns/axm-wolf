import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPersistenceState,
  requestPersistentStorage,
} from '../../src/storage/persistence.js';

// The module is exercised with explicit navigator-like stubs: node has no
// `navigator`, which also covers the unsupported path via the default
// globalThis lookup.

test('unsupported when navigator or the Storage API is missing', async () => {
  assert.equal(await requestPersistentStorage(), 'unsupported');
  assert.equal(await getPersistenceState(), 'unsupported');
  assert.equal(await requestPersistentStorage({}), 'unsupported');
  assert.equal(await requestPersistentStorage({ storage: {} }), 'unsupported');
});

test('already-persistent short-circuits without a new request', async () => {
  let persistCalls = 0;
  const nav = {
    storage: {
      persisted: async () => true,
      persist: async () => {
        persistCalls += 1;
        return true;
      },
    },
  };
  assert.equal(await requestPersistentStorage(nav), 'persistent');
  assert.equal(persistCalls, 0);
  assert.equal(await getPersistenceState(nav), 'persistent');
});

test('a granted request reports persistent', async () => {
  const nav = {
    storage: {
      persisted: async () => false,
      persist: async () => true,
    },
  };
  assert.equal(await requestPersistentStorage(nav), 'persistent');
});

test('a denied request degrades to best-effort', async () => {
  const nav = {
    storage: {
      persisted: async () => false,
      persist: async () => false,
    },
  };
  assert.equal(await requestPersistentStorage(nav), 'best-effort');
  assert.equal(await getPersistenceState(nav), 'best-effort');
});

test('a throwing Storage API degrades to best-effort, never throws', async () => {
  const nav = {
    storage: {
      persisted: async () => {
        throw new Error('storage access blocked');
      },
      persist: async () => {
        throw new Error('storage access blocked');
      },
    },
  };
  assert.equal(await requestPersistentStorage(nav), 'best-effort');
  assert.equal(await getPersistenceState(nav), 'best-effort');
});
