export type QuietHours = { enabled: boolean; start: string; end: string };

export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, start: "22:00", end: "07:00" };

export function isTimeInput(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function minutesSinceMidnight(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isQuietHoursActive(quietHours: QuietHours, now = new Date()) {
  if (!quietHours.enabled) return false;
  const start = minutesSinceMidnight(quietHours.start);
  const end = minutesSinceMidnight(quietHours.end);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function foregroundSoundIsMuted(visualOnly: boolean, quietHours: QuietHours, now = new Date()) {
  return visualOnly || isQuietHoursActive(quietHours, now);
}
