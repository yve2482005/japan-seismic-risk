import { describe, expect, it } from "vitest";
import { isCloseEpicenterDistance, isWithinJapanMapBounds, mapCoordinate, mapDistanceSegment, mapMarkerStyle, mapReferenceRing } from "./earthquakeMap";

describe("earthquake map helpers", () => {
  it("maps Japan-envelope coordinates into a safely visible plotting area", () => {
    expect(mapCoordinate(35, 140)).toEqual({ left: 57.14285714285714, top: 50 });
    expect(mapCoordinate(90, 300)).toEqual({ left: 96, top: 4 });
  });

  it("uses clearer marker severity styles at the documented magnitude tiers", () => {
    expect(mapMarkerStyle(4.9).label).toBe("Below M5");
    expect(mapMarkerStyle(5).label).toBe("M5+");
    expect(mapMarkerStyle(6).label).toBe("M6+");
  });

  it("does not misplace a user marker when the device is outside the Japan map envelope", () => {
    expect(isWithinJapanMapBounds(35.7, 139.7)).toBe(true);
    expect(isWithinJapanMapBounds(16.8, 96.2)).toBe(false);
  });

  it("positions an approximate distance line between two visible map points", () => {
    expect(mapDistanceSegment({ left: 10, top: 20 }, { left: 40, top: 20 })).toMatchObject({ left: 10, top: 20, length: 30, angle: 0, labelLeft: 25, labelTop: 20 });
  });

  it("marks only distances at or below 100 km as close", () => {
    expect(isCloseEpicenterDistance(100)).toBe(true);
    expect(isCloseEpicenterDistance(101)).toBe(false);
    expect(isCloseEpicenterDistance(null)).toBe(false);
  });

  it("creates a bounded 100 km reference ring that reflects the approximate map scale", () => {
    const ring = mapReferenceRing(35);
    expect(ring.width).toBeGreaterThan(0);
    expect(ring.height).toBeGreaterThan(0);
    expect(ring.width).toBeLessThanOrEqual(30);
    expect(ring.height).toBeLessThanOrEqual(30);
  });
});
