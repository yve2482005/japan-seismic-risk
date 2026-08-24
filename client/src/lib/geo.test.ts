import { describe, expect, it } from "vitest";
import { approximateDistanceKm } from "./geo";

describe("approximateDistanceKm", () => {
  it("returns zero for the same point", () => {
    expect(approximateDistanceKm({ latitude: 35.68, longitude: 139.76 }, { latitude: 35.68, longitude: 139.76 })).toBe(0);
  });

  it("uses a geodesic approximation rather than storing or relying on route data", () => {
    expect(approximateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBe(111);
  });
});
