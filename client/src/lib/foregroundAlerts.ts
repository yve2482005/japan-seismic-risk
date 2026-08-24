export type ForegroundAlertThreshold = 4 | 5 | 6;

export function isForegroundAlertThreshold(value: unknown): value is ForegroundAlertThreshold {
  return value === 4 || value === 5 || value === 6;
}

export function shouldTriggerForegroundAlert(enabled: boolean, minimumMagnitude: ForegroundAlertThreshold, eventMagnitude: number) {
  return enabled && Number.isFinite(eventMagnitude) && eventMagnitude >= minimumMagnitude;
}

export function shouldPlayForegroundSound(soundEnabled: boolean, visualOnly: boolean) {
  return soundEnabled && !visualOnly;
}

export type TestAlertMode = "sound_and_visual" | "visual_only" | "disabled";

export function testAlertMode(soundEnabled: boolean, visualOnly: boolean): TestAlertMode {
  if (visualOnly) return "visual_only";
  return soundEnabled ? "sound_and_visual" : "disabled";
}
