import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInspectionPlan } from '../../src/ops/inspection.js';
import { cafeDisplayInspectionTemplate } from '../../src/ops/pilots/small-cafe-display.js';
import { recessedLightingInspectionTemplate } from '../../src/ops/pilots/small-property-recessed-lighting.js';
import type { AssetPassport } from '../../src/ops/types.js';

const NOW = '2026-07-12T12:00:00.000Z';

function lightingAsset(attributes: AssetPassport['attributes'] = {}): AssetPassport {
  return {
    assetId: 'lighting-unit-b-living-room',
    siteId: 'small-property',
    label: 'Unit B living room recessed lighting',
    category: 'recessed-lighting-system',
    location: 'Unit B living room',
    make: null,
    model: null,
    serialNumber: null,
    attributes,
    evidenceIds: [],
    updatedAt: NOW,
  };
}

test('guided lighting inspection asks for the highest-value safe observation before professional work', () => {
  const plan = buildInspectionPlan(recessedLightingInspectionTemplate, lightingAsset());

  assert.equal(plan.complete, false);
  assert.equal(plan.nextRequest?.requirementId, 'symptom-video');
  assert.equal(plan.nextRequest?.safeForSubject, true);
  assert.equal(plan.blockedByProfessional, false);
});

test('guided lighting inspection never presents internal fixture capture as subject-safe', () => {
  const asset = lightingAsset({
    failurePatternDocumented: true,
    fixtureLayoutDocumented: true,
    controlModelDocumented: true,
    workingFailingPairDocumented: true,
  });
  const plan = buildInspectionPlan(recessedLightingInspectionTemplate, asset);

  assert.equal(plan.nextRequest?.requirementId, 'fixture-label-and-connector');
  assert.equal(plan.nextRequest?.executor, 'licensed_professional');
  assert.equal(plan.nextRequest?.safeForSubject, false);
  assert.equal(plan.blockedByProfessional, true);
});

test('completed evidence fields remove their capture requests', () => {
  const asset = lightingAsset({
    failurePatternDocumented: true,
    fixtureLayoutDocumented: true,
    controlModelDocumented: true,
    workingFailingPairDocumented: true,
    fixtureFamiliesDocumented: true,
    connectorDocumented: true,
    mountingDocumented: true,
    cutoutMeasured: 6,
    housingTypeDocumented: 'retrofit can',
    sharedCauseTested: true,
  });
  const plan = buildInspectionPlan(recessedLightingInspectionTemplate, asset);
  assert.equal(plan.complete, true);
  assert.equal(plan.nextRequest, null);
});

test('cafe display inspection prioritizes the rear ventilation condition', () => {
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
    evidenceIds: [],
    updatedAt: NOW,
  };

  const plan = buildInspectionPlan(cafeDisplayInspectionTemplate, asset);
  assert.equal(plan.nextRequest?.requirementId, 'rear-ventilation');
});
