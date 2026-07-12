import { WolfOpsError } from './errors.js';
import type {
  DecisionCase,
  DecisionEvaluation,
  DecisionMetrics,
  DecisionOption,
  DecisionPreferenceWeights,
  EvaluatedDecisionOption,
} from './types.js';

export const DEFAULT_DECISION_WEIGHTS: DecisionPreferenceWeights = {
  fiveYearCost: 1,
  ownerAttentionHours: 1.25,
  recurrenceRisk: 1.5,
  disruption: 0.75,
  complianceRisk: 2,
  reversibility: 0.5,
  evidenceConfidence: 1,
};

type MetricName = keyof DecisionPreferenceWeights;

const MINIMIZE_METRICS: MetricName[] = [
  'fiveYearCost',
  'ownerAttentionHours',
  'recurrenceRisk',
  'disruption',
  'complianceRisk',
];

const MAXIMIZE_METRICS: MetricName[] = ['reversibility', 'evidenceConfidence'];

function metricValue(metrics: DecisionMetrics, metric: MetricName): number {
  if (metric === 'fiveYearCost') return metrics.fiveYearCost.high;
  return metrics[metric];
}

function assertMetrics(option: DecisionOption): void {
  const { metrics } = option;
  if (metrics.initialCost.low < 0 || metrics.initialCost.high < metrics.initialCost.low) {
    throw new WolfOpsError(`invalid initial cost range for option ${option.optionId}`);
  }
  if (metrics.fiveYearCost.low < 0 || metrics.fiveYearCost.high < metrics.fiveYearCost.low) {
    throw new WolfOpsError(`invalid five-year cost range for option ${option.optionId}`);
  }

  for (const metric of ['recurrenceRisk', 'disruption', 'complianceRisk', 'reversibility', 'evidenceConfidence'] as const) {
    const value = metrics[metric];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new WolfOpsError(`${metric} for option ${option.optionId} must be between 0 and 1`);
    }
  }
  if (!Number.isFinite(metrics.ownerAttentionHours) || metrics.ownerAttentionHours < 0) {
    throw new WolfOpsError(`ownerAttentionHours for option ${option.optionId} must be non-negative`);
  }
}

function dominates(left: DecisionOption, right: DecisionOption): boolean {
  let strictlyBetter = false;

  for (const metric of MINIMIZE_METRICS) {
    const leftValue = metricValue(left.metrics, metric);
    const rightValue = metricValue(right.metrics, metric);
    if (leftValue > rightValue) return false;
    if (leftValue < rightValue) strictlyBetter = true;
  }

  for (const metric of MAXIMIZE_METRICS) {
    const leftValue = metricValue(left.metrics, metric);
    const rightValue = metricValue(right.metrics, metric);
    if (leftValue < rightValue) return false;
    if (leftValue > rightValue) strictlyBetter = true;
  }

  return strictlyBetter;
}

export function getParetoFrontier(options: DecisionOption[]): DecisionOption[] {
  const candidates = options.filter((option) => option.availability !== 'blocked');
  candidates.forEach(assertMetrics);

  return candidates.filter(
    (candidate) => !candidates.some((other) => other.optionId !== candidate.optionId && dominates(other, candidate)),
  );
}

function normalize(values: number[], value: number, maximize: boolean): number {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (maximum === minimum) return 1;
  const increasing = (value - minimum) / (maximum - minimum);
  return maximize ? increasing : 1 - increasing;
}

function weightedScore(
  option: DecisionOption,
  options: DecisionOption[],
  weights: DecisionPreferenceWeights,
): number {
  const metrics: MetricName[] = [...MINIMIZE_METRICS, ...MAXIMIZE_METRICS];
  let score = 0;
  let totalWeight = 0;

  for (const metric of metrics) {
    const weight = weights[metric];
    if (!Number.isFinite(weight) || weight < 0) {
      throw new WolfOpsError(`weight ${metric} must be a non-negative finite number`);
    }
    if (weight === 0) continue;

    const values = options.map((candidate) => metricValue(candidate.metrics, metric));
    const metricScore = normalize(values, metricValue(option.metrics, metric), MAXIMIZE_METRICS.includes(metric));
    score += metricScore * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) throw new WolfOpsError('at least one decision weight must be greater than zero');
  const availabilityPenalty = option.availability === 'conditional' ? 0.03 : 0;
  return Math.max(0, score / totalWeight - availabilityPenalty);
}

export function evaluateDecisionCase(
  decisionCase: DecisionCase,
  weights: DecisionPreferenceWeights = DEFAULT_DECISION_WEIGHTS,
): DecisionEvaluation {
  const candidates = decisionCase.options.filter((option) => option.availability !== 'blocked');
  const blocked = decisionCase.options.filter((option) => option.availability === 'blocked');
  candidates.forEach(assertMetrics);

  const frontierIds = new Set(getParetoFrontier(candidates).map((option) => option.optionId));
  const ranked: EvaluatedDecisionOption[] = candidates
    .map((option) => ({
      ...option,
      weightedScore: weightedScore(option, candidates, weights),
      paretoEfficient: frontierIds.has(option.optionId),
    }))
    .sort((left, right) => {
      if (right.weightedScore !== left.weightedScore) return right.weightedScore - left.weightedScore;
      return left.optionId.localeCompare(right.optionId);
    });

  return {
    frontier: ranked.filter((option) => option.paretoEfficient),
    ranked,
    blocked,
  };
}
