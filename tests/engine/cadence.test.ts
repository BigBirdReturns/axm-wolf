import test from 'node:test';
import assert from 'node:assert/strict';
import genericPack from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { validatePack, WolfValidationError, cadenceIntervalDays } from '../../src/engine/index.js';

const cadences = ['once', 'weekly', 'biweekly', 'monthly', 'campaign'] as const;

test('validates and round-trips each valid recommendedCadence value', () => {
  for (const cadence of cadences) {
    const withCadence = { ...genericPack, recommendedCadence: cadence };
    const pack = validatePack(withCadence);
    assert.equal(pack.recommendedCadence, cadence);
  }
});

test('rejects an invalid recommendedCadence value', () => {
  const malformed = { ...genericPack, recommendedCadence: 'daily' };
  assert.throws(() => validatePack(malformed), WolfValidationError);
});

test('a pack without recommendedCadence still validates, leaving it undefined', () => {
  assert.equal('recommendedCadence' in genericPack, false);
  const pack = validatePack(genericPack);
  assert.equal(pack.recommendedCadence, undefined);
});

test('cadenceIntervalDays maps cadences to recurring intervals in days', () => {
  assert.equal(cadenceIntervalDays('weekly'), 7);
  assert.equal(cadenceIntervalDays('biweekly'), 14);
  assert.equal(cadenceIntervalDays('monthly'), 30);
  assert.equal(cadenceIntervalDays('campaign'), 3);
  assert.equal(cadenceIntervalDays('once'), null);
});
