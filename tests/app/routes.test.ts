import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRoute, routeToHash } from '../../src/app/routes.js';

test('empty and root hashes resolve to launch', () => {
  assert.equal(parseRoute('').name, 'launch');
  assert.equal(parseRoute('#').name, 'launch');
  assert.equal(parseRoute('#/').name, 'launch');
});

test('parses #/records', () => {
  assert.equal(parseRoute('#/records').name, 'records');
});

test('parses #/packs, #/ops, and #/settings', () => {
  assert.equal(parseRoute('#/packs').name, 'packs');
  assert.equal(parseRoute('#/ops').name, 'ops');
  assert.equal(parseRoute('#/settings').name, 'settings');
});

test('parses #/record/:recordId', () => {
  const route = parseRoute('#/record/abc-123');
  assert.equal(route.name, 'record');
  assert.ok(route.name === 'record' && route.recordId === 'abc-123');
});

test('parses #/record/:recordId/section/:sectionId', () => {
  const route = parseRoute('#/record/abc-123/section/early');
  assert.equal(route.name, 'record-section');
  assert.ok(route.name === 'record-section' && route.recordId === 'abc-123' && route.sectionId === 'early');
});

test('parses #/record/:recordId/prompt/:promptId', () => {
  const route = parseRoute('#/record/abc-123/prompt/early.first-day');
  assert.equal(route.name, 'record-prompt');
  assert.ok(
    route.name === 'record-prompt' && route.recordId === 'abc-123' && route.promptId === 'early.first-day',
  );
});

test('parses #/record/:recordId/search and /export', () => {
  const search = parseRoute('#/record/abc-123/search');
  assert.equal(search.name, 'record-search');
  assert.ok(search.name === 'record-search' && search.recordId === 'abc-123');

  const exportRoute = parseRoute('#/record/abc-123/export');
  assert.equal(exportRoute.name, 'record-export');
  assert.ok(exportRoute.name === 'record-export' && exportRoute.recordId === 'abc-123');
});

test('trailing slash is normalized', () => {
  const route = parseRoute('#/records/');
  assert.equal(route.name, 'records');
});

test('unknown paths resolve to not-found', () => {
  const route = parseRoute('#/nope');
  assert.equal(route.name, 'not-found');
  assert.ok(route.name === 'not-found' && route.path === '/nope');

  const empty = parseRoute('#/record/');
  assert.equal(empty.name, 'not-found');
});

test('routeToHash inverts parseRoute for known routes', () => {
  const cases: string[] = [
    '#/records',
    '#/packs',
    '#/ops',
    '#/settings',
    '#/record/abc-123',
    '#/record/abc-123/section/early',
    '#/record/abc-123/prompt/early.first-day',
    '#/record/abc-123/search',
    '#/record/abc-123/export',
  ];

  for (const hash of cases) {
    const route = parseRoute(hash);
    assert.equal(routeToHash(route), hash);
  }
});

test('routeToHash for launch route', () => {
  assert.equal(routeToHash({ name: 'launch' }), '#/');
});

test('handles ids containing special characters via encoding', () => {
  const route = parseRoute('#/record/' + encodeURIComponent('rec id/with') + '/section/early');
  assert.equal(route.name, 'record-section');
  assert.ok(route.name === 'record-section' && route.recordId === 'rec id/with');
});
