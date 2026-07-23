import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateDecisionCase } from '../../src/ops/decision.js';
import {
  buildRecessedLightingDecisionCase,
} from '../../src/ops/pilots/small-property-recessed-lighting.js';
import { buildDisplayVentilationProcedure } from '../../src/ops/pilots/small-cafe-display.js';
import type { AssetPassport } from '../../src/ops/types.js';

const NOW = '2026-07-12T12:00:00.000Z';

test('mixed discontinued lighting produces a range of live and conditional solution paths', () => {
  const decisionCase = buildRecessedLightingDecisionCase({
    caseId: 'lighting-case-1',
    assetId: 'lighting-unit-b',
    brandsDiscontinued: true,
    failuresMoveTogether: null,
    dimmerCorrelation: null,
    compatibleReplacementVerified: false,
    sharedCauseRuledOut: false,
    failuresLastSixMonths: 2,
    failedFixtureCount: 2,
    remainingFixtureCount: 6,
    contractorVisitCost: 225,
    replacementModuleCost: 65,
    roomStandardizationCost: { currency: 'USD', low: 1_100, high: 1_700 },
    stagedPropertyStandardizationCost: { currency: 'USD', low: 4_500, high: 7_500 },
  });

  assert.equal(decisionCase.options.length, 5);
  assert.equal(
    decisionCase.options.find((option) => option.optionId === 'spot-replace-failed-modules')?.availability,
    'conditional',
  );
  assert.equal(
    decisionCase.options.find((option) => option.optionId === 'standardize-room-or-circuit')?.availability,
    'live',
  );

  const evaluation = evaluateDecisionCase(decisionCase);
  assert.ok(evaluation.frontier.length >= 2, 'decision support should preserve a range of efficient options');
});

test('shared symptom evidence makes upstream diagnosis a live branch', () => {
  const decisionCase = buildRecessedLightingDecisionCase({
    caseId: 'lighting-case-2',
    assetId: 'lighting-unit-b',
    brandsDiscontinued: true,
    failuresMoveTogether: true,
    dimmerCorrelation: false,
    compatibleReplacementVerified: true,
    sharedCauseRuledOut: false,
    failuresLastSixMonths: 3,
    failedFixtureCount: 2,
    remainingFixtureCount: 6,
    contractorVisitCost: 225,
    replacementModuleCost: 65,
    roomStandardizationCost: { currency: 'USD', low: 1_100, high: 1_700 },
    stagedPropertyStandardizationCost: { currency: 'USD', low: 4_500, high: 7_500 },
  });

  const upstream = decisionCase.options.find((option) => option.optionId === 'diagnose-shared-control-or-circuit');
  assert.equal(upstream?.availability, 'live');
  assert.equal(decisionCase.hypotheses[0]?.status, 'supported');
});

test('cafe display procedure stays provisional until the model is documented', () => {
  const asset: AssetPassport = {
    assetId: 'front-display',
    siteId: 'small-cafe',
    label: 'Front menu display',
    category: 'commercial-display-screen',
    location: 'Customer counter',
    make: null,
    model: null,
    serialNumber: null,
    attributes: {},
    evidenceIds: ['rear-vent-photo'],
    updatedAt: NOW,
  };

  const procedure = buildDisplayVentilationProcedure({ asset, assignedRole: 'closing staff' });
  assert.equal(procedure.status, 'provisional');
  assert.ok(procedure.closureEvidence.some((item) => item.includes('ventilation')));
  assert.ok(procedure.safetyBoundary.includes('Do not open the housing'));
});

test('cafe display procedure becomes confirmed when model identity and guidance are documented', () => {
  const asset: AssetPassport = {
    assetId: 'front-display',
    siteId: 'small-cafe',
    label: 'Front menu display',
    category: 'commercial-display-screen',
    location: 'Customer counter',
    make: 'Example',
    model: 'Commercial-42',
    serialNumber: null,
    attributes: { manufacturerGuidanceDocumented: true },
    evidenceIds: ['model-label-photo', 'manufacturer-manual'],
    updatedAt: NOW,
  };

  const procedure = buildDisplayVentilationProcedure({ asset, assignedRole: 'closing staff' });
  assert.equal(procedure.status, 'confirmed');
});
