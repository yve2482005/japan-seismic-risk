import { describe, expect, it } from "vitest";
import { hasLowCollectionSuccessRate } from "./collectionReliability";

describe("collection reliability warning threshold", () => {
  const base = { windowRuns: 5, successes: 4, failures: 1, successRatePercent: 80, retryAttempts: 0, latestStatus: "success" as const, latestReportedAt: "2026-08-25T00:00:00.000Z" };

  it("warns only when a real non-empty telemetry window is below 80 percent", () => {
    expect(hasLowCollectionSuccessRate(null)).toBe(false);
    expect(hasLowCollectionSuccessRate({ ...base, windowRuns: 0, successRatePercent: 0 })).toBe(false);
    expect(hasLowCollectionSuccessRate(base)).toBe(false);
    expect(hasLowCollectionSuccessRate({ ...base, successRatePercent: 79.9 })).toBe(true);
  });
});
