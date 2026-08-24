import { describe, expect, it } from "vitest";
import { isEventWithinNearbyRadius, isNearbyRadiusKm } from "./nearbyAlerts";

describe("nearby foreground alert filter", () => {
  it("accepts only supported radius choices", () => {
    expect(isNearbyRadiusKm(100)).toBe(true);
    expect(isNearbyRadiusKm(250)).toBe(true);
    expect(isNearbyRadiusKm(500)).toBe(true);
    expect(isNearbyRadiusKm(200)).toBe(false);
  });

  it("requires a local location and known event coordinates before including an event", () => {
    const location = { latitude: 35.6762, longitude: 139.6503 };
    expect(isEventWithinNearbyRadius(location, { latitude: 35.7, longitude: 139.7 }, 100)).toBe(true);
    expect(isEventWithinNearbyRadius(null, { latitude: 35.7, longitude: 139.7 }, 100)).toBe(false);
    expect(isEventWithinNearbyRadius(location, { latitude: null, longitude: 139.7 }, 100)).toBe(false);
  });
});
