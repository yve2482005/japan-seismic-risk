export type SoundPulse = { frequency: number; endFrequency?: number; delayMs: number; durationMs: number; gain?: number; waveform?: OscillatorType };

/** Returns a non-musical, short alert pattern. Browser audio is created only after user interaction or a live in-app alert. */
export function soundPatternForMagnitude(magnitude: number): SoundPulse[] {
  if (magnitude >= 6) return [
    { frequency: 720, endFrequency: 1480, delayMs: 0, durationMs: 420, gain: 0.48, waveform: "sawtooth" },
    { frequency: 1480, endFrequency: 720, delayMs: 450, durationMs: 420, gain: 0.48, waveform: "sawtooth" },
    { frequency: 720, endFrequency: 1480, delayMs: 900, durationMs: 460, gain: 0.48, waveform: "sawtooth" },
  ];
  if (magnitude >= 5) return [{ frequency: 659, delayMs: 0, durationMs: 150 }, { frequency: 880, delayMs: 230, durationMs: 210 }];
  return [{ frequency: 523, delayMs: 0, durationMs: 150 }];
}

export function magnitudeSoundLabel(magnitude: number) {
  if (magnitude >= 6) return "M6.0+ — loud siren preview";
  if (magnitude >= 5) return "M5.0+ — elevated two-tone";
  return "M4.0+ — standard single-tone";
}

export function playMagnitudeSound(magnitude: number): boolean {
  const AudioContextConstructor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return false;
  try {
    const context = new AudioContextConstructor();
    const now = context.currentTime;
    for (const pulse of soundPatternForMagnitude(magnitude)) {
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
    window.setTimeout(() => { void context.close(); }, Math.max(...soundPatternForMagnitude(magnitude).map(pulse => pulse.delayMs + pulse.durationMs)) + 200);
    return true;
  } catch { return false; }
}
