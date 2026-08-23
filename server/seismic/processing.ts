import { JAPAN_REGIONS, type JapanRegion, type SeismicEvent } from "@shared/seismic";

export type RawEarthquake = {
  source: string;
  sourceUrl: string;
  originalEventId?: string;
  originTime: string;
  latitude: number | string | null;
  longitude: number | string | null;
  magnitude: number | string | null;
  depthKm: number | string | null;
  locality?: string;
};

export type ValidatedEarthquake = SeismicEvent & {
  localTimeJapan: string;
  raw: RawEarthquake;
  dataQuality: "validated";
};

const regionBoxes: Array<{ region: JapanRegion; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { region: "Hokkaido", minLat: 41, maxLat: 46, minLng: 139, maxLng: 146 },
  { region: "Tohoku", minLat: 37, maxLat: 41.5, minLng: 139, maxLng: 143.5 },
  { region: "Kanto", minLat: 34.5, maxLat: 37.5, minLng: 138.5, maxLng: 142.5 },
  { region: "Chubu", minLat: 34.5, maxLat: 38.5, minLng: 136, maxLng: 139.5 },
  { region: "Kansai", minLat: 33, maxLat: 35.5, minLng: 134, maxLng: 136.5 },
  { region: "Chugoku", minLat: 33, maxLat: 36.5, minLng: 130.5, maxLng: 134.5 },
  { region: "Shikoku", minLat: 32.5, maxLat: 34.8, minLng: 132.5, maxLng: 135.5 },
  { region: "Kyushu", minLat: 30, maxLat: 34.5, minLng: 128, maxLng: 132.5 },
  { region: "Okinawa", minLat: 23, maxLat: 28.5, minLng: 122, maxLng: 131.5 },
];

export function classifyJapanRegion(latitude: number, longitude: number): JapanRegion | null {
  return regionBoxes.find(box => latitude >= box.minLat && latitude <= box.maxLat && longitude >= box.minLng && longitude <= box.maxLng)?.region ?? null;
}

export function validateAndNormalize(raw: RawEarthquake): ValidatedEarthquake {
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  const magnitude = Number(raw.magnitude);
  const depthKm = raw.depthKm === null ? null : Number(raw.depthKm);
  const origin = new Date(raw.originTime);

  if (!Number.isFinite(origin.getTime())) throw new Error("INVALID_TIMESTAMP");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("INVALID_LATITUDE");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("INVALID_LONGITUDE");
  if (!Number.isFinite(magnitude) || magnitude < -2 || magnitude > 10) throw new Error("INVALID_MAGNITUDE");
  if (depthKm !== null && (!Number.isFinite(depthKm) || depthKm < 0 || depthKm > 750)) throw new Error("INVALID_DEPTH");

  const region = classifyJapanRegion(latitude, longitude);
  const eventId = raw.originalEventId || `${raw.source}:${origin.toISOString()}:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${magnitude.toFixed(1)}`;
  return {
    eventId,
    region: region ?? "Okinawa",
    locality: raw.locality || "Unspecified locality",
    latitude,
    longitude,
    magnitude,
    depthKm,
    originTimeUtc: origin.toISOString(),
    localTimeJapan: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short", hour12: false }).format(origin),
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    provenance: "verified",
    raw,
    dataQuality: "validated",
  };
}

export function deduplicateEvents(records: ValidatedEarthquake[]): { accepted: ValidatedEarthquake[]; duplicates: ValidatedEarthquake[] } {
  const seen = new Set<string>();
  const accepted: ValidatedEarthquake[] = [];
  const duplicates: ValidatedEarthquake[] = [];
  for (const record of records) {
    const key = `${record.originTimeUtc}|${record.latitude.toFixed(3)}|${record.longitude.toFixed(3)}|${record.magnitude.toFixed(1)}`;
    if (seen.has(key)) duplicates.push(record);
    else {
      seen.add(key);
      accepted.push(record);
    }
  }
  return { accepted, duplicates };
}

export function sheetHeaders() {
  return [
    "event_id", "source", "source_url", "origin_time_utc", "local_time_japan", "latitude", "longitude", "depth_km", "magnitude", "magnitude_type", "region", "prefecture", "nearest_city", "event_type", "collection_time", "data_quality", "duplicate_status",
  ];
}

export const REQUIRED_SHEETS = ["RAW_EARTHQUAKES", "FEATURES", "TRAINING_DATA", "PREDICTIONS", "MODEL_METRICS", "SYSTEM_LOG"] as const;

export function isKnownRegion(value: string): value is JapanRegion {
  return JAPAN_REGIONS.includes(value as JapanRegion);
}
