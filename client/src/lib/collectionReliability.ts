export const COLLECTION_SUCCESS_RATE_WARNING_THRESHOLD = 80;

export type CollectionReliability = {
  windowRuns: number;
  successes: number;
  failures: number;
  successRatePercent: number;
  retryAttempts: number;
  latestStatus: "success" | "failure";
  latestReportedAt: string;
};

export function hasLowCollectionSuccessRate(reliability: CollectionReliability | null | undefined) {
  return reliability !== null && reliability !== undefined && reliability.windowRuns > 0 && Number.isFinite(reliability.successRatePercent) && reliability.successRatePercent < COLLECTION_SUCCESS_RATE_WARNING_THRESHOLD;
}
