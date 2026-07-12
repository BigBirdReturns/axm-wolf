import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { __test } from '../../cloudflare/_worker.js';

test('friendly survey and dashboard paths are rewritten to the WOLF shell', async () => {
  const seen = [];
  const env = { ASSETS: { fetch(request) { seen.push(new URL(request.url).pathname); return new Response('shell'); } } };
  const survey = await worker.fetch(new Request('https://axm.tools/wolf/SUR01'), env);
  const dashboard = await worker.fetch(new Request('https://axm.tools/wolf/dashboard'), env);
  assert.equal(await survey.text(), 'shell');
  assert.equal(await dashboard.text(), 'shell');
  assert.deepEqual(seen, ['/wolf/index.html', '/wolf/index.html']);
});

test('non-WOLF paths pass through unchanged', async () => {
  let path = '';
  const env = { ASSETS: { fetch(request) { path = new URL(request.url).pathname; return new Response('asset'); } } };
  await worker.fetch(new Request('https://axm.tools/autopsy/03/'), env);
  assert.equal(path, '/autopsy/03/');
});

test('dashboard API rejects requests without the configured key before querying D1', async () => {
  const env = { WOLF_DB: {}, WOLF_ADMIN_KEY: 'secret', ASSETS: { fetch() { throw new Error('unexpected'); } } };
  const response = await worker.fetch(new Request('https://axm.tools/wolf/api/admin/session'), env);
  assert.equal(response.status, 401);
  assert.match(await response.text(), /authorization required/i);
});

test('capability tokens are random and hash deterministically', async () => {
  const first = __test.randomToken();
  const second = __test.randomToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.equal(await __test.sha256(first), await __test.sha256(first));
  assert.notEqual(await __test.sha256(first), first);
});

test('admin creates a numbered invitation and stores only the token hash', async () => {
  let inserted = null;
  const db = {
    prepare(sql) {
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() { return { maximum: 0 }; },
        async run() { inserted = { sql, values: this.values }; return { meta: { changes: 1 } }; },
      };
    },
  };
  const request = new Request('https://axm.tools/wolf/api/admin/surveys', {
    method: 'POST',
    headers: { 'x-wolf-admin-key': 'owner-secret', 'content-type': 'application/json' },
    body: JSON.stringify({ packId: 'field-operator-report', recipientLabel: 'Lotus', surveyLabel: 'July walkthrough' }),
  });
  const response = await worker.fetch(request, { WOLF_DB: db, WOLF_ADMIN_KEY: 'owner-secret' });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.code, 'SUR01');
  assert.match(body.invitationUrl, /^https:\/\/axm\.tools\/wolf\/SUR01#k=/);
  assert.equal(inserted.values[0], 'SUR01');
  assert.notEqual(inserted.values[4], body.token);
  assert.equal(inserted.values[4], await __test.sha256(body.token));
});

test('recipient sync rejects a stale base revision without overwriting the server copy', async () => {
  const token = 'recipient-secret';
  const row = { code: 'SUR01', pack_id: 'field-operator-report', token_hash: await __test.sha256(token), revision: 3, record_json: '{"recordId":"SUR01"}', status: 'started' };
  const db = {
    prepare() {
      return { bind() { return this; }, async first() { return row; } };
    },
  };
  const request = new Request('https://axm.tools/wolf/api/surveys/SUR01/sync', {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ baseRevision: 2, record: { recordId: 'SUR01', packId: 'field-operator-report' } }),
  });
  const response = await worker.fetch(request, { WOLF_DB: db });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.conflict, true);
  assert.equal(body.revision, 3);
});
