import { describe, expect, it } from "vitest";
import { DEMO_EVENTS } from "@shared/seismic";
import { buildChronologicalFeatures, buildLabeledTargets, chronologicalSplit } from "./featurePipeline";
import { canPromoteCandidate, decideModelPromotion, evaluateBinaryProbabilities } from "./evaluation";

describe("leakage-safe seismic modeling helpers", () => {
  it("uses earlier events for features and a later window only for labels", () => {
    const rows = buildChronologicalFeatures(DEMO_EVENTS, { magnitudeThreshold: 4, horizonHours: 24 * 7, regionScoped: false });
    expect(rows[0]?.eventsLast7d).toBe(0);
    expect(rows[0]?.targetOccurred).toBe(true);
    expect(rows[1]?.eventsLast24h).toBe(1);
    expect(rows[1]?.eventsLast3d).toBe(1);
    expect(rows[1]?.historicalM4Plus).toBe(0);
    expect(rows[1]?.hoursSinceM3Plus).toBe(4.55);
  });

  it("creates separate chronological labels for every configured target", () => {
    const labels = buildLabeledTargets(DEMO_EVENTS, [{ magnitudeThreshold: 4, horizonHours: 24, regionScoped: false }, { magnitudeThreshold: 5, horizonHours: 24 * 7, regionScoped: false }]);
    expect(labels).toHaveLength(DEMO_EVENTS.length * 2);
    expect(labels.map(row => row.targetName)).toContain("M4.0_NEXT_24H");
    expect(labels.map(row => row.targetName)).toContain("M5.0_NEXT_168H");
  });

  it("splits ordered examples into past training, later validation, and final test segments", () => {
    const split = chronologicalSplit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(split.training).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(split.validation).toEqual([8]);
    expect(split.test).toEqual([9, 10]);
  });

  it("calculates transparent probability metrics and blocks weak candidates", () => {
    const metrics = evaluateBinaryProbabilities([
      { probability: 0.9, observed: true },
      { probability: 0.8, observed: false },
      { probability: 0.1, observed: false },
      { probability: 0.2, observed: true },
    ]);
    expect(metrics.confusion).toEqual({ truePositive: 1, falsePositive: 1, trueNegative: 1, falseNegative: 1 });
    expect(metrics.recall).toBe(0.5);
    expect(canPromoteCandidate(metrics, { minimumRecall: 0.7, maximumFalsePositiveRate: 0.4, maximumBrierScore: 0.3 }).eligible).toBe(false);
    expect(metrics.calibration.expectedCalibrationError).toBeGreaterThan(0);
    const decision = decideModelPromotion({ id: 2, modelVersion: "v1.1.0", status: "candidate", metrics }, null, { minimumRecall: 0.7, maximumFalsePositiveRate: 0.4, maximumBrierScore: 0.3 });
    expect(decision.nextCandidateStatus).toBe("candidate");
  });
});
