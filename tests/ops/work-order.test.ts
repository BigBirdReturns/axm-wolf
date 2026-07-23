import test from 'node:test';
import assert from 'node:assert/strict';

import { WolfOpsError } from '../../src/ops/errors.js';
import { createWorkOrder, transitionWorkOrder } from '../../src/ops/work-order.js';

const T0 = '2026-07-12T10:00:00.000Z';
const T1 = '2026-07-12T11:00:00.000Z';
const T2 = '2026-07-12T12:00:00.000Z';
const T3 = '2026-07-12T13:00:00.000Z';
const T4 = '2026-07-12T14:00:00.000Z';
const T5 = '2026-07-12T15:00:00.000Z';

function assignedOrder() {
  let order = createWorkOrder({
    workOrderId: 'wo-1',
    assetId: 'washer-unit-b',
    summary: 'Washer stops mid-cycle again.',
    at: T0,
    actor: 'owner',
    evidenceIds: ['tenant-report-1'],
  });
  order = transitionWorkOrder(order, 'classified', { at: T1, actor: 'system', note: 'Recurring appliance failure.' });
  order = transitionWorkOrder(order, 'triaged', { at: T2, actor: 'owner', note: 'No smoke, leak, or heat.' });
  order = transitionWorkOrder(order, 'assigned', {
    at: T3,
    actor: 'owner',
    note: 'Assigned to appliance contractor.',
    owner: 'appliance-contractor',
  });
  return order;
}

test('a temporary patch cannot be verified as durable closure', () => {
  const order = assignedOrder();
  assert.throws(
    () =>
      transitionWorkOrder(order, 'verified', {
        at: T4,
        actor: 'owner',
        note: 'Belt adjusted for now.',
        resolutionKind: 'temporary',
        evidenceIds: ['repair-photo'],
      }),
    WolfOpsError,
  );
});

test('temporary stabilization requires a durable follow-up date', () => {
  const order = assignedOrder();
  assert.throws(
    () =>
      transitionWorkOrder(order, 'temporarily_stabilized', {
        at: T4,
        actor: 'owner',
        note: 'Temporary adjustment.',
        resolutionKind: 'temporary',
      }),
    WolfOpsError,
  );
});

test('durable work requires verification evidence before closure', () => {
  let order = assignedOrder();
  order = transitionWorkOrder(order, 'verified', {
    at: T4,
    actor: 'contractor',
    note: 'Failed component replaced and complete cycle passed.',
    resolutionKind: 'durable',
    evidenceIds: ['completed-cycle-video', 'invoice-22'],
  });
  order = transitionWorkOrder(order, 'closed', {
    at: T5,
    actor: 'owner',
    note: 'Closure evidence reviewed.',
  });

  assert.equal(order.status, 'closed');
  assert.equal(order.resolutionKind, 'durable');
  assert.deepEqual(order.verificationEvidenceIds, ['completed-cycle-video', 'invoice-22']);
});
