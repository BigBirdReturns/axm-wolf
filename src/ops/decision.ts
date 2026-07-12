import type {
  DecisionCase,
  DecisionEvaluation,
  DecisionMetricDefinition,
  DecisionOption,
  EvaluatedDecisionOption,
} from './types.js';

function finiteMetricValue(option: DecisionOption, metricId: string): number | null {
  const value = option.metricValues[metricId];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeMetric(
  option: DecisionOption,
  metric: DecisionMetricDefinition,
  options: DecisionOption[],
): number | null {
  const value = finiteMetricValue(option, metric.metricId);
  if (value === null) return null;

  const values = options
    .map((candidate) => finiteMetricValue(candidate, metric.metricId))
    .filter((candidate): candidate is number => candidate !== null);
  if (values.length === 0) return null;

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (maximum === minimum) return 1;

  const ascending = (value - minimum) / (maximum - minimum);
  return metric.direction === 'maximize' ? ascending : 1 - ascending;
}

export function optionDominates(
  left: DecisionOption,
  right: DecisionOption,
  metrics: DecisionMetricDefinition[],
): boolean {
  let strictlyBetter = false;

  for (const metric of metrics) {
    const leftValue = finiteMetricValue(left, metric.metricId);
    const rightValue = finiteMetricValue(right, metric.metricId);

    // Incomplete evidence stays visible. An option with a missing metric cannot
    // eliminate another option from the frontier, and cannot itself be
    // eliminated on the basis of an unknown comparison.
    if (leftValue === null || rightValue === null) return false;

    if (metric.direction === 'minimize') {
      if (leftValue > rightValue) return false;
      if (leftValue < rightValue) strictlyBetter = true;
    } else {
      if (leftValue < rightValue) return false;
      if (leftValue > rightValue) strictlyBetter = true;
    }
  }

  return strictlyBetter;
}

function evaluateOption(decisionCase: DecisionCase, option: DecisionOption): EvaluatedDecisionOption {
  const normalizedValues: Record<string, number | null> = {};
  const missingMetricIds: string[] = [];
  let weightedTotal = 0;
  let availableWeight = 0;

  for (const metric of decisionCase.metrics) {
    if (!Number.isFinite(metric.weight) || metric.weight < 0) {
      throw new Error(`Decision metric ${metric.metricId} has an invalid weight`);
    }
    const normalized = normalizeMetric(option, metric, decisionCase.options);
    normalizedValues[metric.metricId] = normalized;
    if (normalized === null) {
      missingMetricIds.push(metric.metricId);
      continue;
    }
    weightedTotal += normalized * metric.weight;
    availableWeight += metric.weight;
  }

  const confidence = Math.max(0, Math.min(1, option.evidenceConfidence));
  const weightedScore = availableWeight === 0 ? null : (weightedTotal / availableWeight) * confidence;
  const dominatedByOptionIds = decisionCase.options
    .filter((candidate) => candidate.optionId !== option.optionId)
    .filter((candidate) => optionDominates(candidate, option, decisionCase.metrics))
    .map((candidate) => candidate.optionId);

  return {
    ...option,
    normalizedValues,
    weightedScore,
    missingMetricIds,
    dominatedByOptionIds,
    onParetoFrontier: dominatedByOptionIds.length === 0,
  };
}

export function evaluateDecisionCase(decisionCase: DecisionCase): DecisionEvaluation {
  const metricIds = new Set<string>();
  for (const metric of decisionCase.metrics) {
    if (metricIds.has(metric.metricId)) throw new Error(`Duplicate decision metric ${metric.metricId}`);
    metricIds.add(metric.metricId);
  }

  const optionIds = new Set<string>();
  for (const option of decisionCase.options) {
    if (optionIds.has(option.optionId)) throw new Error(`Duplicate decision option ${option.optionId}`);
    optionIds.add(option.optionId);
  }

  const options = decisionCase.options.map((option) => evaluateOption(decisionCase, option));
  return {
    decisionCaseId: decisionCase.decisionCaseId,
    frontierOptionIds: options.filter((option) => option.onParetoFrontier).map((option) => option.optionId),
    options,
  };
}

export function reweightDecisionCase(
  decisionCase: DecisionCase,
  weights: Record<string, number>,
): DecisionCase {
  return {
    ...decisionCase,
    metrics: decisionCase.metrics.map((metric) => ({
      ...metric,
      weight: weights[metric.metricId] ?? metric.weight,
    })),
  };
}
