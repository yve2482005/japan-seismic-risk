export const JAPAN_MAP_BOUNDS = { west: 120, east: 155, south: 20, north: 50 };

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
