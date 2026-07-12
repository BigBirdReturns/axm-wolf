import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachEvidenceToAsset,
  createAssetPassport,
  createInspectionCase,
  createObservation,
  recessedLightingPlaybook,
  setAssetAttribute,
  setInspectionFact,
  supersedeObservation,
  updateAssetPassport,
} from '../../src/ops/index.js';

const T0 = '2026-07-12T12:00:00.000Z';

test('asset passport preserves stable identity while local details accumulate', () => {
  const asset = createAssetPassport({
    assetId: 'asset-1',
    displayName: 'Unit B recessed lighting',
    category: recessedLightingPlaybook.assetCategory,
    siteLabel: 'Lotus',
    locationLabel: 'Unit B living room',
    now: T0,
  });
  const identified = updateAssetPassport(
    asset,
    { manufacturer: 'Example Lighting', model: 'R6', status: 'active' },
    '2026-07-12T12:01:00.000Z',
  );
  const measured = setAssetAttribute(identified, 'nominal_diameter_inches', 6, '2026-07-12T12:02:00.000Z');
  const evidenced = attachEvidenceToAsset(measured, 'artifact-label', '2026-07-12T12:03:00.000Z');

  assert.equal(evidenced.assetId, 'asset-1');
  assert.equal(evidenced.manufacturer, 'Example Lighting');
  assert.equal(evidenced.attributes.nominal_diameter_inches, 6);
  assert.deepEqual(evidenced.evidenceArtifactIds, ['artifact-label']);
});

test('inspection facts retain source class and evidence provenance', () => {
  const inspectionCase = createInspectionCase({
    caseId: 'case-1',
    playbook: recessedLightingPlaybook,
    now: T0,
  });
  const updated = setInspectionFact(
    inspectionCase,
    'fail_together',
    'yes',
    '2026-07-12T12:01:00.000Z',
    {
      sourceClass: 'occupant_reported',
      evidenceArtifactIds: ['video-1'],
      note: 'Reported by the current occupant',
    },
  );

  assert.equal(updated.facts.fail_together, 'yes');
  assert.equal(updated.factProvenance.fail_together?.sourceClass, 'occupant_reported');
  assert.deepEqual(updated.factProvenance.fail_together?.evidenceArtifactIds, ['video-1']);
});

test('observations keep reports, documents, direct observations, and inferences distinct', () => {
  const report = createObservation({
    observationId: 'observation-1',
    caseId: 'case-1',
    assetId: 'asset-1',
    kind: 'reported_symptom',
    text: 'The lights wink out after they have been on for a while.',
    sourceClass: 'occupant_reported',
    sourceLabel: 'Current occupant',
    recordedAt: T0,
  });
  const inference = createObservation({
    observationId: 'observation-2',
    caseId: 'case-1',
    assetId: 'asset-1',
    kind: 'inference',
    text: 'A shared control path remains a live hypothesis.',
    sourceClass: 'system_inferred',
    recordedAt: T0,
  });

  assert.equal(report.confidence, 'unknown');
  assert.equal(inference.confidence, 'possible');
  assert.notEqual(report.sourceClass, inference.sourceClass);
});

test('superseding an observation preserves the prior record', () => {
  const prior = createObservation({
    observationId: 'prior',
    caseId: 'case-1',
    kind: 'direct_observation',
    text: 'Two fixtures appear to fail together.',
    sourceClass: 'operator_observed',
    recordedAt: T0,
  });
  const replacement = createObservation({
    observationId: 'replacement',
    caseId: 'case-1',
    kind: 'direct_observation',
    text: 'Frame-by-frame review shows a three-second separation.',
    sourceClass: 'operator_observed',
    evidenceArtifactIds: ['video-1'],
    recordedAt: '2026-07-12T12:05:00.000Z',
  });
  const result = supersedeObservation(prior, replacement);

  assert.equal(result.prior.status, 'superseded');
  assert.equal(result.replacement.supersedesObservationId, 'prior');
  assert.equal(result.replacement.status, 'active');
});
