export type SoundPulse = { frequency: number; endFrequency?: number; delayMs: number; durationMs: number; gain?: number; waveform?: OscillatorType };
export type MidMagnitudeSoundOption = "rapid_pulse" | "two_tone_alert";
export type HighMagnitudeSoundOption = "five_second_siren" | "triple_urgent_sweep";
export type MagnitudeSoundOptions = { midMagnitude: MidMagnitudeSoundOption; highMagnitude: HighMagnitudeSoundOption };

export const DEFAULT_MAGNITUDE_SOUND_OPTIONS: MagnitudeSoundOptions = {
  midMagnitude: "rapid_pulse",
  highMagnitude: "five_second_siren",
};

export function isMidMagnitudeSoundOption(value: unknown): value is MidMagnitudeSoundOption {
  return value === "rapid_pulse" || value === "two_tone_alert";
}

export function isHighMagnitudeSoundOption(value: unknown): value is HighMagnitudeSoundOption {
  return value === "five_second_siren" || value === "triple_urgent_sweep";
}

export function soundOptionLabel(option: MidMagnitudeSoundOption | HighMagnitudeSoundOption) {
  if (option === "rapid_pulse") return "rapid alert pulse";
  if (option === "two_tone_alert") return "two-tone alert";
  if (option === "five_second_siren") return "5-second loud siren";
  return "triple urgent sweep";
}

/** Returns a non-musical, short alert pattern. Browser audio is created only after user interaction or a live in-app alert. */
export function soundPatternForMagnitude(magnitude: number, options: MagnitudeSoundOptions = DEFAULT_MAGNITUDE_SOUND_OPTIONS): SoundPulse[] {
  if (magnitude >= 6) {
    if (options.highMagnitude === "triple_urgent_sweep") return [
      { frequency: 760, endFrequency: 1500, delayMs: 0, durationMs: 420, gain: 0.48, waveform: "sawtooth" },
      { frequency: 1500, endFrequency: 760, delayMs: 450, durationMs: 420, gain: 0.48, waveform: "sawtooth" },
      { frequency: 760, endFrequency: 1500, delayMs: 900, durationMs: 460, gain: 0.48, waveform: "sawtooth" },
    ];
    return Array.from({ length: 10 }, (_, index) => ({
      frequency: index % 2 === 0 ? 720 : 1480,
      endFrequency: index % 2 === 0 ? 1480 : 720,
      delayMs: index * 500,
      durationMs: 500,
      gain: 0.5,
      waveform: "sawtooth" as OscillatorType,
    }));
  }
  if (magnitude >= 4 && options.midMagnitude === "two_tone_alert") return [
    { frequency: 640, delayMs: 0, durationMs: 190, gain: 0.32, waveform: "triangle" },
    { frequency: 880, delayMs: 230, durationMs: 220, gain: 0.32, waveform: "triangle" },
  ];
  if (magnitude >= 4) return [
    { frequency: 610, delayMs: 0, durationMs: 130, gain: 0.26, waveform: "triangle" },
    { frequency: 760, delayMs: 170, durationMs: 130, gain: 0.26, waveform: "triangle" },
    { frequency: 610, delayMs: 340, durationMs: 150, gain: 0.26, waveform: "triangle" },
  ];
  return [{ frequency: 523, delayMs: 0, durationMs: 150 }];
}

export function magnitudeSoundLabel(magnitude: number, options: MagnitudeSoundOptions = DEFAULT_MAGNITUDE_SOUND_OPTIONS) {
  if (magnitude >= 6) return `M6.0+ — ${soundOptionLabel(options.highMagnitude)} preview`;
  if (magnitude >= 4) return `M4.0–M5.9 — ${soundOptionLabel(options.midMagnitude)}`;
  return "Below M4.0 — standard single-tone";
}

export function playMagnitudeSound(magnitude: number, options: MagnitudeSoundOptions = DEFAULT_MAGNITUDE_SOUND_OPTIONS): boolean {
  const AudioContextConstructor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return false;
  try {
    const context = new AudioContextConstructor();
    const now = context.currentTime;
    const pattern = soundPatternForMagnitude(magnitude, options);
    for (const pulse of pattern) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + pulse.delayMs / 1000;
      const end = start + pulse.durationMs / 1000;
      oscillator.type = pulse.waveform ?? "sine";
      oscillator.frequency.setValueAtTime(pulse.frequency, start);
      if (pulse.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(pulse.endFrequency, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(pulse.gain ?? 0.18, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
    window.setTimeout(() => { void context.close(); }, Math.max(...pattern.map(pulse => pulse.delayMs + pulse.durationMs)) + 200);
    return true;
  } catch { return false; }
}
