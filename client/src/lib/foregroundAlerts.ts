export type ForegroundAlertThreshold = 4 | 5 | 6;

export function isForegroundAlertThreshold(value: unknown): value is ForegroundAlertThreshold {
  return value === 4 || value === 5 || value === 6;
}

export function shouldTriggerForegroundAlert(enabled: boolean, minimumMagnitude: ForegroundAlertThreshold, eventMagnitude: number) {
  return enabled && Number.isFinite(eventMagnitude) && eventMagnitude >= minimumMagnitude;
}
