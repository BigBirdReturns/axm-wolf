import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateDecisionCase,
  optionDominates,
  recessedLightingDecisionCase,
  reweightDecisionCase,
  type DecisionCase,
} from '../../src/ops/index.js';

const simpleCase: DecisionCase = {
  decisionCaseId: 'simple',
  title: 'Simple comparison',
  context: 'Test fixture',
  metrics: [
    {
      metricId: 'cost',
      label: 'Cost',
      description: 'Lower is better',
      direction: 'minimize',
      weight: 0.5,
    },
    {
      metricId: 'durability',
      label: 'Durability',
      description: 'Higher is better',
      direction: 'maximize',
      weight: 0.5,
    },
  ],
  options: [
    {
      optionId: 'strong',
      label: 'Strong',
      summary: 'Lower cost and higher durability',
      metricValues: { cost: 2, durability: 5 },
      evidenceConfidence: 1,
      benefits: [],
      burdens: [],
      assumptions: [],
      reopeningTriggers: [],
    },
    {
      optionId: 'weak',
      label: 'Weak',
      summary: 'Higher cost and lower durability',
      metricValues: { cost: 4, durability: 2 },
      evidenceConfidence: 1,
      benefits: [],
      burdens: [],
      assumptions: [],
      reopeningTriggers: [],
    },
  ],
};

test('optionDominates requires no-worse performance on every metric and one strict improvement', () => {
  assert.equal(optionDominates(simpleCase.options[0]!, simpleCase.options[1]!, simpleCase.metrics), true);
  assert.equal(optionDominates(simpleCase.options[1]!, simpleCase.options[0]!, simpleCase.metrics), false);
});

test('evaluateDecisionCase preserves the non-dominated option set', () => {
  const evaluation = evaluateDecisionCase(simpleCase);
  assert.deepEqual(evaluation.frontierOptionIds, ['strong']);
  assert.deepEqual(evaluation.options.find((option) => option.optionId === 'weak')?.dominatedByOptionIds, ['strong']);
});

test('missing evidence cannot silently eliminate an option', () => {
  const incomplete: DecisionCase = {
    ...simpleCase,
    options: [
      simpleCase.options[0]!,
      {
        ...simpleCase.options[1]!,
        optionId: 'unknown-durability',
        metricValues: { cost: 1, durability: null },
      },
    ],
  };
  const evaluation = evaluateDecisionCase(incomplete);
  const unknown = evaluation.options.find((option) => option.optionId === 'unknown-durability');

  assert.equal(unknown?.onParetoFrontier, true);
  assert.deepEqual(unknown?.missingMetricIds, ['durability']);
});

test('recessed-lighting case exposes a range rather than manufacturing one answer', () => {
  const evaluation = evaluateDecisionCase(recessedLightingDecisionCase);
  assert.ok(evaluation.frontierOptionIds.length > 1);
  assert.ok(evaluation.frontierOptionIds.includes('diagnose-shared-path'));
  assert.ok(evaluation.frontierOptionIds.includes('standardize-room'));
});

test('reweightDecisionCase changes weights without mutating the original case', () => {
  const reweighted = reweightDecisionCase(simpleCase, { cost: 0.9, durability: 0.1 });
  assert.equal(reweighted.metrics[0]?.weight, 0.9);
  assert.equal(reweighted.metrics[1]?.weight, 0.1);
  assert.equal(simpleCase.metrics[0]?.weight, 0.5);
});
