import { approximateDistanceKm } from "./geo";

export type NearbyRadiusKm = 100 | 250 | 500;

export function isNearbyRadiusKm(value: unknown): value is NearbyRadiusKm {
  return value === 100 || value === 250 || value === 500;
}

export function isEventWithinNearbyRadius(
  location: { latitude: number; longitude: number } | null,
  event: { latitude: number | null; longitude: number | null },
  radiusKm: NearbyRadiusKm,
) {
  if (!location || event.latitude === null || event.longitude === null) return false;
  return approximateDistanceKm(location, { latitude: event.latitude, longitude: event.longitude }) <= radiusKm;
}
