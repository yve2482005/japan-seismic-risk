import { describe, expect, it } from "vitest";
import { classifyJapanRegion, deduplicateEvents, sheetHeaders, validateAndNormalize } from "./processing";
import { classifyRisk } from "@shared/seismic";

describe("seismic processing", () => {
  const valid = {
    source: "Test catalog",
    sourceUrl: "https://catalog.example/events/1",
    originTime: "2025-01-02T03:04:05Z",
    latitude: 38.4,
    longitude: 142.1,
    magnitude: 4.2,
    depthKm: 41,
    locality: "Off Miyagi",
  };

  it("normalizes a valid record and preserves its raw payload", () => {
    const record = validateAndNormalize(valid);
    expect(record.region).toBe("Tohoku");
    expect(record.localTimeJapan).toContain("12:04");
    expect(record.raw).toEqual(valid);
  });

  it("rejects malformed timestamps and impossible coordinates", () => {
    expect(() => validateAndNormalize({ ...valid, originTime: "not-a-date" })).toThrow("INVALID_TIMESTAMP");
    expect(() => validateAndNormalize({ ...valid, latitude: 92 })).toThrow("INVALID_LATITUDE");
  });

  it("uses a coordinate-based region classification", () => {
    expect(classifyJapanRegion(32.2, 132.0)).toBe("Kyushu");
    expect(classifyJapanRegion(0, 0)).toBeNull();
  });

  it("rejects duplicate records deterministically", () => {
    const event = validateAndNormalize(valid);
    const result = deduplicateEvents([event, { ...event, eventId: "another-id" }]);
    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it("defines the required provenance-aware Sheets headers", () => {
    expect(sheetHeaders()).toEqual(expect.arrayContaining(["event_id", "source_url", "collection_time", "duplicate_status"]));
  });

  it("maps configured probability bands to transparent display risk levels", () => {
    expect(classifyRisk(0)).toBe("LOW");
    expect(classifyRisk(5)).toBe("MODERATE");
    expect(classifyRisk(15)).toBe("ELEVATED");
    expect(classifyRisk(30)).toBe("HIGH");
  });
});
