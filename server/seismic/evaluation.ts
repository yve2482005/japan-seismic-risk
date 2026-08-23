export type ScoredObservation = { observed: boolean; probability: number };

export type EvaluationMetrics = {
  accuracy: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  brierScore: number;
  calibration: { expectedCalibrationError: number; bins: CalibrationBin[] };
  confusion: { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number };
};

export type CalibrationBin = {
  lowerBound: number;
  upperBound: number;
  count: number;
  meanPredictedProbability: number | null;
  observedRate: number | null;
};

export type PromotionGate = {
  minimumRecall: number;
  maximumFalsePositiveRate: number;
  maximumBrierScore: number;
};

export function evaluateBinaryProbabilities(observations: ScoredObservation[], decisionThreshold = 0.5): EvaluationMetrics {
  if (!observations.length) throw new Error("At least one scored observation is required.");
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  let brierTotal = 0;

  for (const observation of observations) {
    if (!Number.isFinite(observation.probability) || observation.probability < 0 || observation.probability > 1) throw new Error("Probabilities must be within [0, 1].");
    const predicted = observation.probability >= decisionThreshold;
    if (predicted && observation.observed) truePositive += 1;
    if (predicted && !observation.observed) falsePositive += 1;
    if (!predicted && !observation.observed) trueNegative += 1;
    if (!predicted && observation.observed) falseNegative += 1;
    brierTotal += Math.pow(observation.probability - (observation.observed ? 1 : 0), 2);
  }

  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null;
  return {
    accuracy: (truePositive + trueNegative) / observations.length,
    precision,
    recall,
    f1: precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null,
    falsePositiveRate: falsePositive + trueNegative ? falsePositive / (falsePositive + trueNegative) : null,
    falseNegativeRate: falseNegative + truePositive ? falseNegative / (falseNegative + truePositive) : null,
    brierScore: brierTotal / observations.length,
    calibration: calibrationSummary(observations),
    confusion: { truePositive, falsePositive, trueNegative, falseNegative },
  };
}

export function calibrationSummary(observations: ScoredObservation[], bins = 10) {
  const buckets = Array.from({ length: bins }, (_, index) => ({ lowerBound: index / bins, upperBound: (index + 1) / bins, values: [] as ScoredObservation[] }));
  for (const observation of observations) buckets[Math.min(Math.floor(observation.probability * bins), bins - 1)]?.values.push(observation);
  const rows: CalibrationBin[] = buckets.map(bucket => {
    if (!bucket.values.length) return { lowerBound: bucket.lowerBound, upperBound: bucket.upperBound, count: 0, meanPredictedProbability: null, observedRate: null };
    const meanPredictedProbability = bucket.values.reduce((sum, item) => sum + item.probability, 0) / bucket.values.length;
    const observedRate = bucket.values.filter(item => item.observed).length / bucket.values.length;
    return { lowerBound: bucket.lowerBound, upperBound: bucket.upperBound, count: bucket.values.length, meanPredictedProbability, observedRate };
  });
  const expectedCalibrationError = rows.reduce((sum, row) => sum + (row.count / observations.length) * Math.abs((row.meanPredictedProbability ?? 0) - (row.observedRate ?? 0)), 0);
  return { expectedCalibrationError, bins: rows };
}

export function canPromoteCandidate(metrics: EvaluationMetrics, gate: PromotionGate) {
  const reasons: string[] = [];
  if (metrics.recall === null || metrics.recall < gate.minimumRecall) reasons.push("Recall does not meet the configured minimum.");
  if (metrics.falsePositiveRate === null || metrics.falsePositiveRate > gate.maximumFalsePositiveRate) reasons.push("False-positive rate exceeds the configured maximum.");
  if (metrics.brierScore > gate.maximumBrierScore) reasons.push("Brier score exceeds the configured maximum.");
  return { eligible: reasons.length === 0, reasons };
}

export type VersionedModel = {
  id: number;
  modelVersion: string;
  status: "candidate" | "production" | "retired" | "failed" | "demo";
  metrics: EvaluationMetrics;
};

export function decideModelPromotion(candidate: VersionedModel, production: VersionedModel | null, gate: PromotionGate) {
  const gateResult = canPromoteCandidate(candidate.metrics, gate);
  const reasons = [...gateResult.reasons];
  if (production && candidate.metrics.brierScore > production.metrics.brierScore) reasons.push("Candidate calibration is poorer than the current production model.");
  if (production && (candidate.metrics.recall ?? 0) < (production.metrics.recall ?? 0)) reasons.push("Candidate recall is lower than the current production model.");
  return {
    eligible: reasons.length === 0,
    reasons,
    nextCandidateStatus: reasons.length ? "candidate" as const : "production" as const,
    nextProductionStatus: reasons.length || !production ? null : "retired" as const,
  };
}
