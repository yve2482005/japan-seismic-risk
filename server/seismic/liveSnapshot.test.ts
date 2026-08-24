import { describe, expect, it } from "vitest";
import { buildLiveSnapshot, buildSystemHealth, closedProductionForecastSummary, liveUsgsRows, sourceAwareAlerts, visibleUsgsModelHistory } from "./liveSnapshot";

describe("live Sheets snapshot", () => {
  it("uses only validated source rows and never substitutes a probability before a model is available", () => {
    const snapshot = buildLiveSnapshot([{ event_id: "us-test", source: "USGS", source_url: "https://example.test/event", origin_time_utc: "2026-08-23T00:00:00Z", local_time_japan: "2026-08-23T09:00:00+09:00", latitude: "32.2", longitude: "132.0", depth_km: "20", magnitude: "4.1", region: "Kyushu", nearest_city: "Hyuga-nada", collection_time: "2026-08-23T01:00:00Z" }], new Date("2026-08-23T12:00:00Z"));
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]?.provenance).toBe("verified");
    const kyushu = snapshot.regions.find(region => region.region === "Kyushu");
    expect(kyushu).toMatchObject({ events24h: 1, probabilityM4_24h: null, probabilityM5_7d: null, risk: "UNAVAILABLE" });
  });

  it("uses only rows tied to the current production version and converts probability values to percentages", () => {
    const source = [{ event_id: "us-test", source: "USGS", source_url: "https://example.test/event", origin_time_utc: "2026-08-23T00:00:00Z", latitude: "32.2", longitude: "132.0", depth_km: "20", magnitude: "4.1", region: "Kyushu", collection_time: "2026-08-23T01:00:00Z" }];
    const predictions = [
      { model_version: "candidate-v1", region: "Kyushu", target_definition: "M4+ in the next 24 hours", probability: "0.98", generated_at: "2026-08-23T11:00:00Z" },
      { model_version: "production-v1", region: "Kyushu", target_definition: "M4+ in the next 24 hours", probability: "0.12", generated_at: "2026-08-23T12:00:00Z" },
      { model_version: "production-v1", region: "Kyushu", target_definition: "M5+ in the next 7 days", probability: "0.03", generated_at: "2026-08-23T12:00:00Z" },
    ];
    const snapshot = buildLiveSnapshot(source, new Date("2026-08-23T12:00:00Z"), predictions, "production-v1");
    expect(snapshot.regions.find(region => region.region === "Kyushu")).toMatchObject({ probabilityM4_24h: 12, probabilityM5_7d: 3, risk: "MODERATE" });
  });

  it("keeps source-separated JMA historical rows out of the live USGS activity feed", () => {
    const rows = [
      { event_id: "us-live", source: "U.S. Geological Survey (USGS), ANSS ComCat", origin_time_utc: "2026-08-23T00:00:00Z" },
      { event_id: "jma-history", source: "Japan Meteorological Agency (JMA) Seismological Bulletin", origin_time_utc: "2023-12-01T00:00:00Z" },
    ];
    expect(liveUsgsRows(rows).map(row => row.event_id)).toEqual(["us-live"]);
  });

  it("shows only deduplicated USGS detection alerts and never converts forecasts or JMA history into alerts", () => {
    const rows = [
      { alert_id: "usgs-alert", alert_type: "earthquake_detection_not_prediction", severity: "high", threshold_magnitude: "5", event_magnitude: "5.2", region: "Hokkaido", locality: "Hokkaido", origin_time_utc: "2026-08-24T00:00:00Z", detected_at: "2026-08-24T00:05:00Z", source: "U.S. Geological Survey (USGS), ANSS ComCat", source_url: "https://example.test", reason: "threshold", delivery_status: "in_app_history_created" },
      { alert_id: "usgs-alert", alert_type: "earthquake_detection_not_prediction", severity: "high", threshold_magnitude: "5", event_magnitude: "5.2", region: "Hokkaido", origin_time_utc: "2026-08-24T00:00:00Z", detected_at: "2026-08-24T00:05:00Z", source: "U.S. Geological Survey (USGS), ANSS ComCat" },
      { alert_id: "jma-alert", alert_type: "earthquake_detection_not_prediction", severity: "critical", threshold_magnitude: "6", event_magnitude: "6.2", region: "Hokkaido", origin_time_utc: "2023-12-24T00:00:00Z", detected_at: "2023-12-24T00:05:00Z", source: "Japan Meteorological Agency (JMA)" },
      { alert_id: "forecast", alert_type: "forecast", severity: "high", threshold_magnitude: "5", event_magnitude: "5.2", region: "Hokkaido", origin_time_utc: "2026-08-24T00:00:00Z", detected_at: "2026-08-24T00:05:00Z", source: "U.S. Geological Survey (USGS), ANSS ComCat" },
    ];
    expect(sourceAwareAlerts(rows)).toHaveLength(1);
    expect(sourceAwareAlerts(rows)[0]).toMatchObject({ alertId: "usgs-alert", severity: "high" });
  });

  it("reports stale and missing collector health honestly rather than treating it as a live source", () => {
    const snapshot = buildLiveSnapshot([{ event_id: "us-test", source: "USGS", source_url: "https://example.test", origin_time_utc: "2026-08-24T00:00:00Z", latitude: "32.2", longitude: "132.0", magnitude: "4", region: "Kyushu", collection_time: "2026-08-24T00:10:00Z" }]);
    const health = buildSystemHealth(snapshot, [{ component: "collector", timestamp_utc: "2026-08-24T00:10:00Z", message: "completed", context_json: JSON.stringify({ invalid_rejected: 2, outside_envelope: 100 }) }], [], new Date("2026-08-24T04:00:00Z"));
    expect(health.source.status).toBe("stale");
    expect(health.quality).toMatchObject({ invalidRejected: 2, outsideEnvelope: 100 });
  });

  it("keeps JMA model rows out of the USGS forecast history and retains only parseable held-out metrics", () => {
    const rows = [
      { model_version: "jma-only", dataset_version: "jma-historical-bulletin-v1", trained_at: "2026-08-24T00:00:00Z", metrics_json: "{}" },
      { model_version: "usgs-candidate", dataset_version: "usgs-live-sheet-v1", status: "candidate", target_definition: "M4+", trained_at: "2026-08-24T01:00:00Z", metrics_json: JSON.stringify({ pr_auc: 0.3, recall: 0.4, brier_score: 0.2, calibration: { expected_calibration_error: 0.1 } }) },
    ];
    expect(visibleUsgsModelHistory(rows)).toEqual([expect.objectContaining({ modelVersion: "usgs-candidate", metrics: { prAuc: 0.3, recall: 0.4, brierScore: 0.2, expectedCalibrationError: 0.1 } })]);
  });

  it("reports closed forecast outcomes only for genuine USGS production versions and never for JMA or candidates", () => {
    const metrics = [{ model_version: "usgs-production", dataset_version: "usgs-live-sheet-v1", status: "production" }];
    const outcomes = [
      { model_version: "usgs-production", dataset_version: "usgs-live-sheet-v1", outcome_status: "closed", prediction_probability: "0.2", actual_label: "1", closed_at: "2026-08-25T00:00:00Z" },
      { model_version: "candidate", dataset_version: "usgs-live-sheet-v1", outcome_status: "closed", prediction_probability: "0.8", actual_label: "1" },
      { model_version: "jma-production-like", dataset_version: "jma-historical-bulletin-v1", outcome_status: "closed", prediction_probability: "0.9", actual_label: "1" },
    ];
    expect(closedProductionForecastSummary(outcomes, metrics)).toMatchObject({ status: "available", closedCount: 1, positives: 1, meanProbability: 0.2, brierScore: 0.64 });
    expect(closedProductionForecastSummary([], metrics).status).toBe("unavailable");
  });

  it("keeps forecast-versus-actual unavailable when outcome rows exist but no genuine USGS production version exists", () => {
    const outcomes = [{ model_version: "candidate", dataset_version: "usgs-live-sheet-v1", outcome_status: "closed", prediction_probability: "0.8", actual_label: "1" }];
    expect(closedProductionForecastSummary(outcomes, [{ model_version: "candidate", dataset_version: "usgs-live-sheet-v1", status: "candidate" }]).status).toBe("unavailable");
    expect(closedProductionForecastSummary([{ ...outcomes[0], model_version: "jma", dataset_version: "jma-historical-bulletin-v1" }], [{ model_version: "jma", dataset_version: "jma-historical-bulletin-v1", status: "production" }]).status).toBe("unavailable");
  });
});
