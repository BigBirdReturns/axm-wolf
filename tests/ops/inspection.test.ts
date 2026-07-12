import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInspectionGuidance,
  completeCaptureRequest,
  createInspectionCase,
  markInspectionReadyForReview,
  recessedLightingPlaybook,
  setInspectionFact,
  skipCaptureRequest,
  type EvidenceArtifact,
  type OpsInspectionCase,
} from '../../src/ops/index.js';

const T0 = '2026-07-12T12:00:00.000Z';

function caseWithRequiredFacts(overrides: Record<string, string | boolean | null> = {}): OpsInspectionCase {
  let inspectionCase = createInspectionCase({
    caseId: 'inspection-1',
    playbook: recessedLightingPlaybook,
    now: T0,
  });
  const facts: Record<string, string | boolean | null> = {
    active_hazard: false,
    fail_together: 'unknown',
    dimmer_present: 'unknown',
    changes_with_dimmer: 'unknown',
    model_known: true,
    replacement_being_considered: false,
    ...overrides,
  };
  for (const [key, value] of Object.entries(facts)) {
    inspectionCase = setInspectionFact(inspectionCase, key, value, T0);
  }
  return inspectionCase;
}

test('guidance returns the highest-priority unresolved observation first', () => {
  const inspectionCase = caseWithRequiredFacts();
  const guidance = buildInspectionGuidance(recessedLightingPlaybook, inspectionCase);

  assert.equal(guidance.blockers.length, 0);
  assert.equal(guidance.nextRequest?.requestId, 'room-wide-context');
  assert.equal(guidance.pendingRequests.some((request) => request.requestId === 'isolated-label-and-connector'), false);
  assert.equal(guidance.pendingRequests.some((request) => request.requestId === 'replacement-dimensions'), false);
});

test('active electrical hazard blocks ordinary capture', () => {
  const inspectionCase = caseWithRequiredFacts({ active_hazard: true });
  const guidance = buildInspectionGuidance(recessedLightingPlaybook, inspectionCase);

  assert.equal(guidance.blockers.length, 1);
  assert.equal(guidance.blockers[0]?.ruleId, 'electrical-hazard-stop');
  assert.equal(guidance.nextRequest, null);
  assert.equal(guidance.readyForReview, false);
});

test('conditional requests appear only when their decision branch is live', () => {
  const inspectionCase = caseWithRequiredFacts({
    model_known: false,
    replacement_being_considered: true,
  });
  const ids = buildInspectionGuidance(recessedLightingPlaybook, inspectionCase).pendingRequests.map(
    (request) => request.requestId,
  );

  assert.ok(ids.includes('isolated-label-and-connector'));
  assert.ok(ids.includes('replacement-dimensions'));
});

test('captured evidence advances the queue and skipped requests retain a reason', () => {
  let inspectionCase = caseWithRequiredFacts();
  const artifact: EvidenceArtifact = {
    artifactId: 'evidence-1',
    caseId: inspectionCase.caseId,
    requestId: 'room-wide-context',
    kind: 'photo',
    sourceClass: 'operator_observed',
    fileName: 'ceiling.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    capturedAt: '2026-07-12T12:01:00.000Z',
    notes: null,
  };

  inspectionCase = completeCaptureRequest(inspectionCase, recessedLightingPlaybook, artifact);
  assert.equal(
    buildInspectionGuidance(recessedLightingPlaybook, inspectionCase).nextRequest?.requestId,
    'operating-pattern-video',
  );

  inspectionCase = skipCaptureRequest(
    inspectionCase,
    recessedLightingPlaybook,
    'operating-pattern-video',
    'Electrician will capture this safely',
    '2026-07-12T12:02:00.000Z',
  );
  assert.equal(inspectionCase.skippedRequests[0]?.reason, 'Electrician will capture this safely');
});

test('inspection can be marked ready only after required facts and eligible capture requests are resolved', () => {
  let inspectionCase = caseWithRequiredFacts();
  const eligibleIds = buildInspectionGuidance(recessedLightingPlaybook, inspectionCase).pendingRequests.map(
    (request) => request.requestId,
  );

  for (const requestId of eligibleIds) {
    inspectionCase = skipCaptureRequest(
      inspectionCase,
      recessedLightingPlaybook,
      requestId,
      'Deferred with a documented handoff',
      T0,
    );
  }

  const guidance = buildInspectionGuidance(recessedLightingPlaybook, inspectionCase);
  assert.equal(guidance.readyForReview, true);
  assert.equal(markInspectionReadyForReview(inspectionCase, recessedLightingPlaybook, T0).status, 'ready_for_review');
});
