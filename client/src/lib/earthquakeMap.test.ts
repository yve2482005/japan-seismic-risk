import { describe, expect, it } from "vitest";
import { mapCoordinate, mapMarkerStyle } from "./earthquakeMap";

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
});
