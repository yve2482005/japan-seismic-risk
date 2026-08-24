import { describe, expect, it } from "vitest";
import { explorerDataState, filterLiveEvents, magnitudeBins } from "./eventExplorer";

const events = [
  { eventId: "a", region: "Kyushu", locality: "A", latitude: 32, longitude: 130, magnitude: 2.6, depthKm: 10, originTimeUtc: "2026-08-24T11:00:00Z", source: "USGS", sourceUrl: "https://example.test", provenance: "verified" as const },
  { eventId: "b", region: "Hokkaido", locality: "B", latitude: 42, longitude: 142, magnitude: 4.3, depthKm: 10, originTimeUtc: "2026-08-20T11:00:00Z", source: "USGS", sourceUrl: "https://example.test", provenance: "verified" as const },
  { eventId: "c", region: "Hokkaido", locality: "C", latitude: 42, longitude: 142, magnitude: 5.4, depthKm: 10, originTimeUtc: "2026-07-20T11:00:00Z", source: "USGS", sourceUrl: "https://example.test", provenance: "verified" as const },
];

describe("live event explorer", () => {
  it("keeps unavailable snapshot states distinct from a genuine empty event result", () => {
    expect(explorerDataState({ isLoading: true, isError: false, hasData: false })).toBe("loading");
    expect(explorerDataState({ isLoading: false, isError: true, hasData: false })).toBe("error");
    expect(explorerDataState({ isLoading: false, isError: false, hasData: true })).toBe("ready");
  });

  it("filters only verified events within the requested live-history period", () => {
    expect(filterLiveEvents(events, { period: "7d", minimumMagnitude: 4, region: "Hokkaido", query: "" }, new Date("2026-08-24T12:00:00Z")).map(event => event.eventId)).toEqual(["b"]);
  });

  it("keeps magnitude distribution calculated from the visible real-event set", () => {
    expect(magnitudeBins(events)).toEqual([{ label: "M2–2.9", count: 1 }, { label: "M3–3.9", count: 0 }, { label: "M4–4.9", count: 1 }, { label: "M5+", count: 1 }]);
  });
});
