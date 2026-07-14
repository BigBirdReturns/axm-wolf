import test from 'node:test';
import assert from 'node:assert/strict';
import { runHelenLotusPlaytest } from './helen-lotus.support.js';

test('Helen then Lotus complete isolated survey-to-dashboard-to-reviewed-plan loops', async () => {
  const result = await runHelenLotusPlaytest();

  assert.equal(result.events.length, 18);
  assert.deepEqual(result.events.filter((event) => event.dashboardStatus === 'completed').map((event) => event.recipient), ['Helen', 'Lotus']);
  assert.equal(result.handoffs.length, 2);
  assert.equal(result.handoffs.every((handoff) => handoff.runMode === 'manual-subscription'), true);
  assert.equal(result.handoffs.every((handoff) => handoff.sourceSnapshot.every((source) => source.revisionId && source.quote)), true);
  assert.equal(result.finalDashboard.every((row) => row.status === 'completed'), true);
  assert.equal(result.finalDashboard.every((row) => row.answeredPrompts === 3 && row.pendingDrafts === 0), true);
  assert.equal(result.reviews.find((review) => review.claimId === 'helen-plan-1')?.decision, 'rejected');
  assert.equal(result.events.every((event) => event.receipt.runtimeApiCalls === undefined || event.receipt.runtimeApiCalls === 0), true);
  assert.match(result.syntheticDataNotice, /synthetic/i);
});
