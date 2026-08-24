import { describe, expect, it } from "vitest";
import { magnitudeSoundLabel, soundPatternForMagnitude } from "./notificationSounds";

describe("magnitude notification sounds", () => {
  it("uses increasingly distinctive non-musical patterns by magnitude", () => {
    expect(soundPatternForMagnitude(4.2)).toHaveLength(3);
    expect(soundPatternForMagnitude(5.2)).toEqual(soundPatternForMagnitude(4.2));
    expect(soundPatternForMagnitude(6.2)).toHaveLength(10);
    expect(soundPatternForMagnitude(4.2)[0]).toMatchObject({ frequency: 610, gain: 0.26, waveform: "triangle" });
    expect(soundPatternForMagnitude(6.2)[0]).toMatchObject({ frequency: 720, endFrequency: 1480, delayMs: 0, durationMs: 500, gain: 0.5, waveform: "sawtooth" });
    expect(soundPatternForMagnitude(6.2)[1]).toMatchObject({ frequency: 1480, endFrequency: 720, delayMs: 500, durationMs: 500, gain: 0.5, waveform: "sawtooth" });
    expect(soundPatternForMagnitude(6.2).at(-1)).toMatchObject({ delayMs: 4500, durationMs: 500 });
  });

  it("labels the sound tiers without presenting them as official warning levels", () => {
    expect(magnitudeSoundLabel(4)).toContain("M4.0–M5.9");
    expect(magnitudeSoundLabel(5)).toContain("M4.0–M5.9");
    expect(magnitudeSoundLabel(6)).toContain("M6.0+");
    expect(magnitudeSoundLabel(6)).toContain("5-second");
    expect(magnitudeSoundLabel(6)).toContain("siren");
  });
});
