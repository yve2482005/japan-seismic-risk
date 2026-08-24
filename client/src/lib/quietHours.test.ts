import { describe, expect, it } from "vitest";
import { DEFAULT_QUIET_HOURS, foregroundSoundIsMuted, isQuietHoursActive, isTimeInput } from "./quietHours";

describe("quiet-hours sound muting", () => {
  it("handles local time windows that cross midnight", () => {
    const quietHours = { ...DEFAULT_QUIET_HOURS, enabled: true, start: "22:00", end: "07:00" };
    expect(isQuietHoursActive(quietHours, new Date(2026, 7, 24, 23, 30))).toBe(true);
    expect(isQuietHoursActive(quietHours, new Date(2026, 7, 25, 6, 59))).toBe(true);
    expect(isQuietHoursActive(quietHours, new Date(2026, 7, 25, 12, 0))).toBe(false);
  });

  it("mutes for visual-only mode or valid enabled quiet hours", () => {
    const daytimeQuietHours = { ...DEFAULT_QUIET_HOURS, enabled: true, start: "09:00", end: "17:00" };
    expect(foregroundSoundIsMuted(true, DEFAULT_QUIET_HOURS, new Date(2026, 7, 24, 12, 0))).toBe(true);
    expect(foregroundSoundIsMuted(false, daytimeQuietHours, new Date(2026, 7, 24, 12, 0))).toBe(true);
    expect(isTimeInput("22:00")).toBe(true);
    expect(isTimeInput("25:00")).toBe(false);
  });
});
