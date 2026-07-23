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
  assert.deepEqual(seen, ['/wolf/', '/wolf/']);
});

test('non-WOLF paths pass through unchanged', async () => {
  let path = '';
  const env = { ASSETS: { fetch(request) { path = new URL(request.url).pathname; return new Response('asset'); } } };
  await worker.fetch(new Request('https://axm.tools/autopsy/03/'), env);
  assert.equal(path, '/autopsy/03/');
});

test('operator API requires a Cloudflare Access identity before querying D1', async () => {
  const env = { WOLF_DB: {}, ASSETS: { fetch() { throw new Error('unexpected'); } } };
  const response = await worker.fetch(new Request('https://axm.tools/wolf/api/operator/session'), env);
  assert.equal(response.status, 401);
  assert.match(await response.text(), /access login required/i);
});

test('capability tokens are random and hash deterministically', async () => {
  const first = __test.randomToken();
  const second = __test.randomToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.equal(await __test.sha256(first), await __test.sha256(first));
  assert.notEqual(await __test.sha256(first), first);
});

test('workspace operator creates a numbered invitation and stores only the token hash', async () => {
  let inserted = null;
  const db = {
    async batch() { return [{ success: true }, { success: true, results: [{ value: 1 }] }]; },
    prepare(sql) {
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() { return null; },
        async run() { inserted = { sql, values: this.values }; return { meta: { changes: 1 } }; },
      };
    },
  };
  const request = new Request('https://axm.tools/wolf/api/operator/workspaces/root/surveys', {
    method: 'POST',
    headers: { 'x-wolf-test-email': 'owner@example.com', 'content-type': 'application/json' },
    body: JSON.stringify({ packId: 'field-operator-report', recipientLabel: 'Lotus', surveyLabel: 'July walkthrough' }),
  });
  const response = await worker.fetch(request, { WOLF_DB: db, WOLF_TEST_MODE: 'true', WOLF_OWNER_EMAIL: 'owner@example.com' });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.code, 'SUR01');
  assert.match(body.invitationUrl, /^https:\/\/axm\.tools\/wolf\/SUR01#k=/);
  assert.equal(inserted.values[0], 'SUR01');
  assert.equal(inserted.values[1], 'root');
  assert.notEqual(inserted.values[5], body.token);
  assert.equal(inserted.values[5], await __test.sha256(body.token));
});

test('an authenticated operator cannot cross an unassigned workspace boundary', async () => {
  const db = { prepare() { return { bind() { return this; }, async first() { return null; } }; } };
  const request = new Request('https://axm.tools/wolf/api/operator/workspaces/helen/surveys', {
    headers: { 'x-wolf-test-email': 'lotus@example.com' },
  });
  const response = await worker.fetch(request, { WOLF_DB: db, WOLF_TEST_MODE: 'true', WOLF_OWNER_EMAIL: 'owner@example.com' });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /do not have access/i);
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

test('completed interviews are readable but reject further writes', async () => {
  const token = 'recipient-secret';
  const row = { code: 'SUR01', pack_id: 'field-operator-report', token_hash: await __test.sha256(token), revision: 3, record_json: '{"recordId":"SUR01"}', status: 'completed' };
  const db = { prepare() { return { bind() { return this; }, async first() { return row; } }; } };
  const request = new Request('https://axm.tools/wolf/api/surveys/SUR01/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ baseRevision: 3, record: { recordId: 'SUR01', packId: 'field-operator-report' } }),
  });
  const response = await worker.fetch(request, { WOLF_DB: db });
  assert.equal(response.status, 423);
  assert.match(await response.text(), /read-only/i);
});

test('analysis returns must cite exact synchronized testimony', () => {
  const record = {
    recordId: 'SUR01',
    responses: [{ promptId: 'operations.normal-day', revisions: [{ revisionId: 'rev-1', text: 'I check the overnight notes first.' }] }],
  };
  assert.doesNotThrow(() => __test.validateAnalysisReturnAgainstRecord({
    schemaVersion: 1,
    kind: 'wolf-survey-analysis-return',
    claims: [{ claimId: 'claim-1', sourceReferences: [{ recordId: 'SUR01', promptId: 'operations.normal-day', revisionId: 'rev-1', quote: 'overnight notes' }] }],
  }, record));
  assert.throws(() => __test.validateAnalysisReturnAgainstRecord({
    schemaVersion: 1,
    kind: 'wolf-survey-analysis-return',
    claims: [{ claimId: 'claim-1', sourceReferences: [{ recordId: 'SUR01', promptId: 'operations.normal-day', revisionId: 'rev-1', quote: 'invented words' }] }],
  }, record), /outside the synchronized record/i);
});

test('operator cannot publish a manual analysis return without participant authorization', async () => {
  const row = { code: 'SUR01', workspace_id: 'root', analysis_consent: 0, record_json: JSON.stringify({ recordId: 'SUR01', responses: [] }) };
  const db = { prepare() { return { bind() { return this; }, async first() { return row; } }; } };
  const request = new Request('https://axm.tools/wolf/api/operator/surveys/SUR01/analysis', {
    method: 'POST',
    headers: { 'x-wolf-test-email': 'owner@example.com', 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { schemaVersion: 1, kind: 'wolf-survey-analysis-return', claims: [] } }),
  });
  const response = await worker.fetch(request, { WOLF_DB: db, WOLF_TEST_MODE: 'true', WOLF_OWNER_EMAIL: 'owner@example.com' });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /did not authorize/i);
});
