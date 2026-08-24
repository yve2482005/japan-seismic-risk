import { describe, expect, it } from "vitest";
import { informationBoundary, safetySteps } from "./safetyCopy";

describe("safety guide copy", () => {
  it("keeps concise before-during-after actions available", () => {
    expect(safetySteps.map(step => step.title)).toEqual(["Before shaking", "During shaking", "After shaking"]);
    expect(safetySteps[1]?.body).toContain("Drop, Cover and Hold On");
  });

  it("does not portray app detections or forecasts as official warnings", () => {
    expect(informationBoundary.tsunami).toContain("does not verify");
    expect(informationBoundary.alerts).toContain("not official warnings");
    expect(informationBoundary.forecast).toContain("never an exact earthquake prediction");
  });
});
