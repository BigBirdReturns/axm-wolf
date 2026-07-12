import test from 'node:test';
import assert from 'node:assert/strict';

import { IDBFactory } from 'fake-indexeddb';

import { DB_NAME, DB_VERSION, openWolfDb, STORE_NAMES } from '../../src/storage/db.js';

function freshFactory(): IDBFactory {
  return new IDBFactory();
}

test('openWolfDb creates all expected object stores', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    for (const name of STORE_NAMES) {
      // Indirect check: get() on a non-existent store would throw, so a
      // resolved get() implies the store exists.
      const value = await db.get(name, 'does-not-exist');
      assert.equal(value, undefined);
    }
  } finally {
    db.close();
  }
});

test('put/get round-trip on records store', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const record = { recordId: 'rec-1', title: 'Test Record', status: 'active', updatedAt: '2024-01-01T00:00:00.000Z' };
    await db.put('records', record);
    const fetched = await db.get('records', 'rec-1');
    assert.equal(JSON.stringify(fetched), JSON.stringify(record));
  } finally {
    db.close();
  }
});

test('composite key store (drafts) put/get with [recordId, promptId]', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    const draft = { recordId: 'rec-1', promptId: 'prompt-1', text: 'in progress', updatedAt: '2024-01-01T00:00:00.000Z' };
    await db.put('drafts', draft);
    const fetched = await db.get('drafts', ['rec-1', 'prompt-1']);
    assert.equal(JSON.stringify(fetched), JSON.stringify(draft));

    const missing = await db.get('drafts', ['rec-1', 'prompt-2']);
    assert.equal(missing, undefined);
  } finally {
    db.close();
  }
});

test('transaction commits: two puts in one tx are both visible after', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    await db.transaction(['records', 'drafts'], 'readwrite', async (tx) => {
      await tx.put('records', { recordId: 'rec-2', title: 'Two', status: 'active', updatedAt: '2024-01-02T00:00:00.000Z' });
      await tx.put('drafts', { recordId: 'rec-2', promptId: 'prompt-1', text: 'draft text', updatedAt: '2024-01-02T00:00:00.000Z' });
    });

    const record = await db.get('records', 'rec-2');
    const draft = await db.get('drafts', ['rec-2', 'prompt-1']);
    assert.ok(record !== undefined);
    assert.ok(draft !== undefined);
  } finally {
    db.close();
  }
});

test('transaction rolls back: fn that puts then throws leaves neither value visible', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    let caught: unknown;
    try {
      await db.transaction(['records', 'drafts'], 'readwrite', async (tx) => {
        await tx.put('records', { recordId: 'rec-3', title: 'Three', status: 'active', updatedAt: '2024-01-03T00:00:00.000Z' });
        await tx.put('drafts', { recordId: 'rec-3', promptId: 'prompt-1', text: 'draft text', updatedAt: '2024-01-03T00:00:00.000Z' });
        throw new Error('boom');
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof Error);
    assert.match((caught as Error).message, /boom/);

    const record = await db.get('records', 'rec-3');
    const draft = await db.get('drafts', ['rec-3', 'prompt-1']);
    assert.equal(record, undefined);
    assert.equal(draft, undefined);
  } finally {
    db.close();
  }
});

test('delete removes a stored value', async () => {
  const db = await openWolfDb(freshFactory());
  try {
    await db.put('settings', { key: 'theme', value: 'dark' });
    assert.ok((await db.get('settings', 'theme')) !== undefined);

    await db.delete('settings', 'theme');
    assert.equal(await db.get('settings', 'theme'), undefined);
  } finally {
    db.close();
  }
});

test('opening a v1 database upgrades it in place with WOLF Ops stores', async () => {
  const factory = freshFactory();
  await new Promise<void>((resolve, reject) => {
    const request = factory.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const legacyDb = request.result;
      legacyDb.createObjectStore('packs', { keyPath: 'packId' });
      legacyDb.createObjectStore('records', { keyPath: 'recordId' });
      legacyDb.createObjectStore('responses', { keyPath: ['recordId', 'promptId'] });
      legacyDb.createObjectStore('drafts', { keyPath: ['recordId', 'promptId'] });
      legacyDb.createObjectStore('settings', { keyPath: 'key' });
      legacyDb.createObjectStore('migrations', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });

  assert.equal(DB_VERSION, 2);
  const db = await openWolfDb(factory);
  try {
    assert.equal(await db.get('opsCases', 'missing'), undefined);
    assert.equal(await db.get('opsEvidence', 'missing'), undefined);
  } finally {
    db.close();
  }
});
