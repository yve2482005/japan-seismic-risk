import { describe, expect, it } from "vitest";
import { magnitudeSoundLabel, soundPatternForMagnitude } from "./notificationSounds";

describe("magnitude notification sounds", () => {
  it("uses increasingly distinctive non-musical patterns by magnitude", () => {
    expect(soundPatternForMagnitude(4.2)).toHaveLength(1);
    expect(soundPatternForMagnitude(5.2)).toHaveLength(2);
    expect(soundPatternForMagnitude(6.2)).toHaveLength(3);
    expect(soundPatternForMagnitude(6.2).at(-1)?.frequency).toBeGreaterThan(soundPatternForMagnitude(4.2)[0]!.frequency);
  });

  it("labels the sound tiers without presenting them as official warning levels", () => {
    expect(magnitudeSoundLabel(4)).toContain("M4.0+");
    expect(magnitudeSoundLabel(5)).toContain("M5.0+");
    expect(magnitudeSoundLabel(6)).toContain("M6.0+");
  });
});
