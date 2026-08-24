const EARTH_RADIUS_KM = 6371.0088;

function radians(value: number) { return value * Math.PI / 180; }

export function approximateDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const deltaLatitude = radians(to.latitude - from.latitude);
  const deltaLongitude = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
