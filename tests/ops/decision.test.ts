import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateDecisionCase, getParetoFrontier } from '../../src/ops/decision.js';
import type { DecisionCase, DecisionOption } from '../../src/ops/types.js';

function option(
  optionId: string,
  overrides: Partial<DecisionOption['metrics']> = {},
): DecisionOption {
  return {
    optionId,
    title: optionId,
    description: optionId,
    availability: 'live',
    condition: null,
    assumptions: [],
    advantages: [],
    tradeoffs: [],
    requiredEvidenceIds: [],
    requiresProfessional: false,
    metrics: {
      initialCost: { currency: 'USD', low: 100, high: 100 },
      fiveYearCost: { currency: 'USD', low: 500, high: 500 },
      ownerAttentionHours: 2,
      recurrenceRisk: 0.4,
      disruption: 0.4,
      complianceRisk: 0.2,
      reversibility: 0.5,
      evidenceConfidence: 0.7,
      ...overrides,
    },
  };
}

test('Pareto evaluation preserves materially different non-dominated options', () => {
  const lowCash = option('low-cash', {
    fiveYearCost: { currency: 'USD', low: 400, high: 600 },
    recurrenceRisk: 0.75,
    reversibility: 0.95,
  });
  const durable = option('durable', {
    fiveYearCost: { currency: 'USD', low: 900, high: 1_000 },
    recurrenceRisk: 0.1,
    reversibility: 0.25,
  });

  const frontier = getParetoFrontier([lowCash, durable]);
  assert.deepEqual(
    frontier.map((candidate) => candidate.optionId).sort(),
    ['durable', 'low-cash'],
  );
});

test('Pareto evaluation removes an option that is worse on every decision metric', () => {
  const baseline = option('baseline');
  const dominated = option('dominated', {
    fiveYearCost: { currency: 'USD', low: 800, high: 900 },
    ownerAttentionHours: 4,
    recurrenceRisk: 0.7,
    disruption: 0.7,
    complianceRisk: 0.4,
    reversibility: 0.3,
    evidenceConfidence: 0.5,
  });

  assert.deepEqual(getParetoFrontier([baseline, dominated]).map((candidate) => candidate.optionId), ['baseline']);
});

test('weighted ranking does not erase the Pareto frontier or conditional options', () => {
  const decisionCase: DecisionCase = {
    caseId: 'case-1',
    title: 'Decision range',
    assetIds: ['asset-1'],
    hypotheses: [],
    evidenceIds: [],
    reopeningTriggers: [],
    options: [
      option('cash-preserving', {
        fiveYearCost: { currency: 'USD', low: 300, high: 600 },
        recurrenceRisk: 0.8,
        reversibility: 1,
      }),
      {
        ...option('conditional-standardization', {
          fiveYearCost: { currency: 'USD', low: 900, high: 950 },
          recurrenceRisk: 0.08,
          reversibility: 0.2,
        }),
        availability: 'conditional',
        condition: 'Use when recurrence crosses the threshold.',
      },
    ],
  };

  const evaluation = evaluateDecisionCase(decisionCase);
  assert.equal(evaluation.ranked.length, 2);
  assert.equal(evaluation.frontier.length, 2);
  assert.ok(evaluation.ranked.every((candidate) => Number.isFinite(candidate.weightedScore)));
});
