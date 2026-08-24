import { describe, expect, it } from "vitest";
import { isForegroundAlertThreshold, shouldPlayForegroundSound, shouldTriggerForegroundAlert, testAlertMode } from "./foregroundAlerts";

describe("foreground alert threshold", () => {
  it("accepts only the available magnitude thresholds", () => {
    expect(isForegroundAlertThreshold(4)).toBe(true);
    expect(isForegroundAlertThreshold(5)).toBe(true);
    expect(isForegroundAlertThreshold(6)).toBe(true);
    expect(isForegroundAlertThreshold(4.5)).toBe(false);
  });

  it("uses the user-selected threshold independently from the sound enablement flag", () => {
    expect(shouldTriggerForegroundAlert(true, 5, 5)).toBe(true);
    expect(shouldTriggerForegroundAlert(true, 5, 4.9)).toBe(false);
    expect(shouldTriggerForegroundAlert(false, 4, 6)).toBe(false);
  });

  it("suppresses sound in visual-only mode without changing the chosen threshold", () => {
    expect(shouldPlayForegroundSound(true, false)).toBe(true);
    expect(shouldPlayForegroundSound(true, true)).toBe(false);
    expect(shouldPlayForegroundSound(false, false)).toBe(false);
  });

  it("uses the same effective mode for the one-tap test as it does for foreground alerts", () => {
    expect(testAlertMode(true, false)).toBe("sound_and_visual");
    expect(testAlertMode(true, true)).toBe("visual_only");
    expect(testAlertMode(false, false)).toBe("disabled");
  });
});
