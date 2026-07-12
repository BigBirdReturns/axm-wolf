import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWorkOrder,
  findRecurrenceMatches,
  linkRecurrence,
  transitionWorkOrder,
} from '../../src/ops/index.js';

function assignedWorkOrder() {
  let workOrder = createWorkOrder({
    workOrderId: 'wo-new',
    caseId: 'case-1',
    assetId: 'unit-b-washer',
    issueCode: 'no-spin',
    title: 'Washer does not spin',
    openedAt: '2026-07-12T10:00:00.000Z',
  });
  workOrder = transitionWorkOrder(workOrder, {
    to: 'classified',
    at: '2026-07-12T10:01:00.000Z',
    actor: 'operator',
  });
  workOrder = transitionWorkOrder(workOrder, {
    to: 'triaged',
    at: '2026-07-12T10:02:00.000Z',
    actor: 'operator',
  });
  return transitionWorkOrder(workOrder, {
    to: 'assigned',
    at: '2026-07-12T10:03:00.000Z',
    actor: 'operator',
    assignedTo: 'contractor-1',
  });
}

test('temporary stabilization is not durable closure', () => {
  const stabilized = transitionWorkOrder(assignedWorkOrder(), {
    to: 'stabilized',
    at: '2026-07-12T11:00:00.000Z',
    actor: 'contractor-1',
    note: 'Reset the belt; permanent diagnosis remains open',
  });

  assert.equal(stabilized.status, 'stabilized');
  assert.throws(
    () =>
      transitionWorkOrder(stabilized, {
        to: 'closed',
        at: '2026-07-12T11:01:00.000Z',
        actor: 'operator',
        followUpCompleted: true,
      }),
    /cannot transition from stabilized to closed/,
  );
});

test('verification requires a named test and evidence before follow-up can close the work order', () => {
  const assigned = assignedWorkOrder();
  assert.throws(
    () =>
      transitionWorkOrder(assigned, {
        to: 'verified',
        at: '2026-07-12T12:00:00.000Z',
        actor: 'operator',
      }),
    /named closure test/,
  );

  const verified = transitionWorkOrder(assigned, {
    to: 'verified',
    at: '2026-07-12T12:00:00.000Z',
    actor: 'operator',
    verificationTest: 'Complete a full wash, drain, and spin cycle without error',
    evidenceIds: ['video-cycle-1'],
  });
  assert.equal(verified.status, 'verified');

  assert.throws(
    () =>
      transitionWorkOrder(verified, {
        to: 'closed',
        at: '2026-07-12T13:00:00.000Z',
        actor: 'operator',
      }),
    /follow-up is complete/,
  );

  const closed = transitionWorkOrder(verified, {
    to: 'closed',
    at: '2026-07-13T13:00:00.000Z',
    actor: 'operator',
    followUpCompleted: true,
  });
  assert.equal(closed.status, 'closed');
});

test('recurrence matching links the same issue on the same asset within the configured window', () => {
  const old = createWorkOrder({
    workOrderId: 'wo-old',
    caseId: 'case-old',
    assetId: 'unit-b-washer',
    issueCode: 'no-spin',
    title: 'Washer does not spin',
    openedAt: '2026-04-01T10:00:00.000Z',
  });
  const unrelated = createWorkOrder({
    workOrderId: 'wo-other',
    caseId: 'case-other',
    assetId: 'unit-c-washer',
    issueCode: 'no-spin',
    title: 'Different washer does not spin',
    openedAt: '2026-05-01T10:00:00.000Z',
  });
  const candidate = assignedWorkOrder();

  const matches = findRecurrenceMatches(candidate, [old, unrelated]);
  assert.deepEqual(matches.map((match) => match.workOrderId), ['wo-old']);
  assert.deepEqual(linkRecurrence(candidate, matches).recurrenceOfWorkOrderIds, ['wo-old']);
});
