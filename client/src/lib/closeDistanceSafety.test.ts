import { describe, expect, it } from "vitest";
import { CLOSE_DISTANCE_SAFETY } from "./closeDistanceSafety";

describe("close-distance safety contract", () => {
  it("retains the verified emergency contact numbers and direct dial links", () => {
    expect(CLOSE_DISTANCE_SAFETY.contacts).toEqual([
      { number: "119", label: "Ambulance / Fire", href: "tel:119" },
      { number: "110", label: "Police", href: "tel:110" },
    ]);
  });

  it("links to the verified official-facing emergency and safety guidance", () => {
    expect(CLOSE_DISTANCE_SAFETY.resources.safetyTips).toContain("jnto.go.jp");
    expect(CLOSE_DISTANCE_SAFETY.resources.emergencyContacts).toContain("usembassy.gov");
  });
});
