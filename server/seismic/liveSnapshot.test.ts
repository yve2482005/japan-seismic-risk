import { describe, expect, it } from "vitest";
import { buildLiveSnapshot, liveUsgsRows } from "./liveSnapshot";

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
});
