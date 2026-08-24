import { describe, expect, it } from "vitest";
import { VISUAL_ALERT_DURATION_MS, visualAlertMessage } from "./visualAlert";

describe("visual alert message", () => {
  it("uses a bounded transient duration and identifies the detected magnitude", () => {
    expect(VISUAL_ALERT_DURATION_MS).toBeGreaterThan(0);
    expect(VISUAL_ALERT_DURATION_MS).toBeLessThanOrEqual(2_000);
    expect(visualAlertMessage(5.4)).toContain("M5.4");
  });
});
