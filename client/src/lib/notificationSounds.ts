export type SoundPulse = { frequency: number; delayMs: number; durationMs: number };

/** Returns a non-musical, short alert pattern. Browser audio is created only after user interaction or a live in-app alert. */
export function soundPatternForMagnitude(magnitude: number): SoundPulse[] {
  if (magnitude >= 6) return [{ frequency: 880, delayMs: 0, durationMs: 170 }, { frequency: 1047, delayMs: 240, durationMs: 170 }, { frequency: 1319, delayMs: 480, durationMs: 260 }];
  if (magnitude >= 5) return [{ frequency: 659, delayMs: 0, durationMs: 150 }, { frequency: 880, delayMs: 230, durationMs: 210 }];
  return [{ frequency: 523, delayMs: 0, durationMs: 150 }];
}

export function magnitudeSoundLabel(magnitude: number) {
  if (magnitude >= 6) return "M6.0+ — urgent three-tone";
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
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(pulse.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
    window.setTimeout(() => { void context.close(); }, Math.max(...soundPatternForMagnitude(magnitude).map(pulse => pulse.delayMs + pulse.durationMs)) + 200);
    return true;
  } catch { return false; }
}
