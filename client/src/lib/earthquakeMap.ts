export const JAPAN_MAP_BOUNDS = { west: 120, east: 155, south: 20, north: 50 };
export const CLOSE_DISTANCE_KM = 100;

export function isCloseEpicenterDistance(distanceKm: number | null) {
  return distanceKm !== null && Number.isFinite(distanceKm) && distanceKm <= CLOSE_DISTANCE_KM;
}

export function isWithinJapanMapBounds(latitude: number, longitude: number) {
  return latitude >= JAPAN_MAP_BOUNDS.south && latitude <= JAPAN_MAP_BOUNDS.north && longitude >= JAPAN_MAP_BOUNDS.west && longitude <= JAPAN_MAP_BOUNDS.east;
}

export function mapCoordinate(latitude: number, longitude: number) {
  const left = ((longitude - JAPAN_MAP_BOUNDS.west) / (JAPAN_MAP_BOUNDS.east - JAPAN_MAP_BOUNDS.west)) * 100;
  const top = 100 - ((latitude - JAPAN_MAP_BOUNDS.south) / (JAPAN_MAP_BOUNDS.north - JAPAN_MAP_BOUNDS.south)) * 100;
  return { left: Math.max(4, Math.min(96, left)), top: Math.max(4, Math.min(96, top)) };
}

export function mapMarkerStyle(magnitude: number) {
  if (magnitude >= 6) return { label: "M6+", color: "#d92d20", size: Math.min(52, 18 + magnitude * 5) };
  if (magnitude >= 5) return { label: "M5+", color: "#f79009", size: Math.min(46, 18 + magnitude * 5) };
  return { label: "Below M5", color: "#2782b5", size: Math.min(40, 18 + magnitude * 5) };
}

export function mapDistanceSegment(from: { left: number; top: number }, to: { left: number; top: number }) {
  const deltaLeft = to.left - from.left;
  const deltaTop = to.top - from.top;
  return {
    left: from.left,
    top: from.top,
    length: Math.hypot(deltaLeft, deltaTop),
    angle: Math.atan2(deltaTop, deltaLeft) * 180 / Math.PI,
    labelLeft: (from.left + to.left) / 2,
    labelTop: (from.top + to.top) / 2,
  };
}

export function mapReferenceRing(latitude: number, radiusKm = CLOSE_DISTANCE_KM) {
  const latitudeRadians = latitude * Math.PI / 180;
  const kmPerLongitudeDegree = Math.max(1, 111.32 * Math.cos(latitudeRadians));
  const horizontalRadiusPercent = (radiusKm / kmPerLongitudeDegree) * 100 / (JAPAN_MAP_BOUNDS.east - JAPAN_MAP_BOUNDS.west);
  const verticalRadiusPercent = (radiusKm / 110.574) * 100 / (JAPAN_MAP_BOUNDS.north - JAPAN_MAP_BOUNDS.south);
  return {
    width: Math.min(30, horizontalRadiusPercent * 2),
    height: Math.min(30, verticalRadiusPercent * 2),
  };
}
