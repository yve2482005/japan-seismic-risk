import { describe, expect, it } from "vitest";
import { buildChronologicalFeatures, buildLabeledTargets } from "./featurePipeline";
import { calibrationSummary, decideModelPromotion, evaluateBinaryProbabilities } from "./evaluation";
import { DEMO_EVENTS } from "@shared/seismic";

describe("complete reporting regression suite", () => {
  it("produces every required time, magnitude, depth, spatial, trend, and historical feature without reading the future", () => {
    const rows = buildChronologicalFeatures(DEMO_EVENTS, { magnitudeThreshold: 4, horizonHours: 24, regionScoped: false });
    const first = rows[0]!;
    const second = rows[1]!;
    expect(first).toMatchObject({ eventsLast1h: 0, eventsLast6h: 0, eventsLast24h: 0, eventsLast3d: 0, eventsLast7d: 0, eventsLast30d: 0, historicalM4Plus: 0, historicalM5Plus: 0, historicalM6Plus: 0 });
    expect(second).toHaveProperty("magnitudeMedian24h");
    expect(second).toHaveProperty("magnitudeStdDev24h");
    expect(second).toHaveProperty("depthMin24h");
    expect(second).toHaveProperty("depthMax24h");
    expect(second).toHaveProperty("distanceFromPreviousKm");
    expect(second).toHaveProperty("localEventDensity24h");
    expect(second).toHaveProperty("activityChangeRate");
    expect(second.targetOccurred).toBe(false);
    expect(first.historicalM4Plus).toBe(0);
  });

  it("keeps four standard forecast targets separate and chronological", () => {
    const labels = buildLabeledTargets(DEMO_EVENTS, [
      { magnitudeThreshold: 4, horizonHours: 24, regionScoped: false },
      { magnitudeThreshold: 5, horizonHours: 24, regionScoped: false },
      { magnitudeThreshold: 5, horizonHours: 24 * 7, regionScoped: false },
      { magnitudeThreshold: 6, horizonHours: 24 * 7, regionScoped: false },
    ]);
    expect(new Set(labels.map(row => row.targetName))).toEqual(new Set(["M4.0_NEXT_24H", "M5.0_NEXT_24H", "M5.0_NEXT_168H", "M6.0_NEXT_168H"]));
    expect(labels).toHaveLength(DEMO_EVENTS.length * 4);
  });

  it("reports calibration bins and blocks a candidate that is worse than production", () => {
    const candidateMetrics = evaluateBinaryProbabilities([{ probability: 0.8, observed: true }, { probability: 0.7, observed: false }, { probability: 0.2, observed: true }, { probability: 0.1, observed: false }]);
    const productionMetrics = evaluateBinaryProbabilities([{ probability: 0.9, observed: true }, { probability: 0.2, observed: false }, { probability: 0.8, observed: true }, { probability: 0.1, observed: false }]);
    expect(calibrationSummary([{ probability: 0.8, observed: true }, { probability: 0.1, observed: false }]).bins).toHaveLength(10);
    const decision = decideModelPromotion(
      { id: 2, modelVersion: "v1.1.0", status: "candidate", metrics: candidateMetrics },
      { id: 1, modelVersion: "v1.0.0", status: "production", metrics: productionMetrics },
      { minimumRecall: 0.4, maximumFalsePositiveRate: 0.8, maximumBrierScore: 0.8 },
    );
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining(["Candidate calibration is poorer than the current production model."]));
  });
});
