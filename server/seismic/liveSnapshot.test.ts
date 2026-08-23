import { describe, expect, it } from "vitest";
import { buildLiveSnapshot } from "./liveSnapshot";

describe("live Sheets snapshot", () => {
  it("uses only validated source rows and never substitutes a probability before a model is available", () => {
    const snapshot = buildLiveSnapshot([{ event_id: "us-test", source: "USGS", source_url: "https://example.test/event", origin_time_utc: "2026-08-23T00:00:00Z", local_time_japan: "2026-08-23T09:00:00+09:00", latitude: "32.2", longitude: "132.0", depth_km: "20", magnitude: "4.1", region: "Kyushu", nearest_city: "Hyuga-nada", collection_time: "2026-08-23T01:00:00Z" }], new Date("2026-08-23T12:00:00Z"));
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]?.provenance).toBe("verified");
    const kyushu = snapshot.regions.find(region => region.region === "Kyushu");
    expect(kyushu).toMatchObject({ events24h: 1, probabilityM4_24h: null, probabilityM5_7d: null, risk: "UNAVAILABLE" });
  });
});
