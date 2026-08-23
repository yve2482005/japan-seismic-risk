export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";

export type JapanRegion =
  | "Hokkaido"
  | "Tohoku"
  | "Kanto"
  | "Chubu"
  | "Kansai"
  | "Chugoku"
  | "Shikoku"
  | "Kyushu"
  | "Okinawa";

export type SeismicEvent = {
  eventId: string;
  region: JapanRegion;
  locality: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depthKm: number | null;
  originTimeUtc: string;
  source: string;
  sourceUrl: string;
  provenance: "demo" | "verified";
};

export type RegionActivity = {
  region: JapanRegion;
  probabilityM4_24h: number | null;
  probabilityM5_7d: number | null;
  risk: RiskLevel | "UNAVAILABLE";
  events24h: number;
  events7d: number;
  maxMagnitude7d: number | null;
  meanDepthKm: number | null;
  trend: "up" | "steady" | "down";
  svgX: number;
  svgY: number;
};

export const JAPAN_REGIONS: JapanRegion[] = [
  "Hokkaido",
  "Tohoku",
  "Kanto",
  "Chubu",
  "Kansai",
  "Chugoku",
  "Shikoku",
  "Kyushu",
  "Okinawa",
];

/**
 * Synthetic fixtures used only to exercise the no-cost demo pipeline. They are
 * intentionally labelled throughout the interface and must not be treated as
 * live, official, or historical earthquake records.
 */
export const DEMO_EVENTS: SeismicEvent[] = [
  { eventId: "DEMO-0001", region: "Hokkaido", locality: "East of Hidaka", latitude: 42.1, longitude: 143.2, magnitude: 3.8, depthKm: 48, originTimeUtc: "2026-08-20T02:11:00Z", source: "Demo fixture", sourceUrl: "https://example.invalid/demo-fixture", provenance: "demo" },
  { eventId: "DEMO-0002", region: "Tohoku", locality: "Off Miyagi", latitude: 38.4, longitude: 142.1, magnitude: 4.2, depthKm: 41, originTimeUtc: "2026-08-20T06:44:00Z", source: "Demo fixture", sourceUrl: "https://example.invalid/demo-fixture", provenance: "demo" },
  { eventId: "DEMO-0003", region: "Kanto", locality: "Ibaraki offshore", latitude: 36.2, longitude: 141.1, magnitude: 3.1, depthKm: 32, originTimeUtc: "2026-08-21T04:08:00Z", source: "Demo fixture", sourceUrl: "https://example.invalid/demo-fixture", provenance: "demo" },
  { eventId: "DEMO-0004", region: "Chubu", locality: "Noto Peninsula", latitude: 37.3, longitude: 137.2, magnitude: 2.9, depthKm: 14, originTimeUtc: "2026-08-21T15:31:00Z", source: "Demo fixture", sourceUrl: "https://example.invalid/demo-fixture", provenance: "demo" },
  { eventId: "DEMO-0005", region: "Kansai", locality: "Wakayama Channel", latitude: 34.1, longitude: 135.0, magnitude: 3.4, depthKm: 18, originTimeUtc: "2026-08-22T02:09:00Z", source: "Demo fixture", sourceUrl: "https://example.invalid/demo-fixture", provenance: "demo" },
  { eventId: "DEMO-0006", region: "Kyushu", locality: "Hyuga-nada", latitude: 32.2, longitude: 132.0, magnitude: 4.6, depthKm: 29, originTimeUtc: "2026-08-22T19:26:00Z", source: "Demo fixture", sourceUrl: "https://example.invalid/demo-fixture", provenance: "demo" },
];

export const DEMO_REGIONS: RegionActivity[] = [
  { region: "Hokkaido", probabilityM4_24h: 5.2, probabilityM5_7d: 2.1, risk: "MODERATE", events24h: 1, events7d: 5, maxMagnitude7d: 3.8, meanDepthKm: 47, trend: "steady", svgX: 304, svgY: 72 },
  { region: "Tohoku", probabilityM4_24h: 8.7, probabilityM5_7d: 3.4, risk: "MODERATE", events24h: 2, events7d: 9, maxMagnitude7d: 4.2, meanDepthKm: 38, trend: "up", svgX: 296, svgY: 150 },
  { region: "Kanto", probabilityM4_24h: 6.3, probabilityM5_7d: 2.2, risk: "MODERATE", events24h: 1, events7d: 7, maxMagnitude7d: 3.1, meanDepthKm: 31, trend: "steady", svgX: 269, svgY: 212 },
  { region: "Chubu", probabilityM4_24h: 3.5, probabilityM5_7d: 1.2, risk: "LOW", events24h: 1, events7d: 4, maxMagnitude7d: 2.9, meanDepthKm: 16, trend: "down", svgX: 222, svgY: 218 },
  { region: "Kansai", probabilityM4_24h: 4.8, probabilityM5_7d: 1.8, risk: "LOW", events24h: 1, events7d: 4, maxMagnitude7d: 3.4, meanDepthKm: 21, trend: "steady", svgX: 178, svgY: 246 },
  { region: "Chugoku", probabilityM4_24h: 2.7, probabilityM5_7d: 0.9, risk: "LOW", events24h: 0, events7d: 2, maxMagnitude7d: 2.5, meanDepthKm: 19, trend: "down", svgX: 126, svgY: 251 },
  { region: "Shikoku", probabilityM4_24h: 4.1, probabilityM5_7d: 1.5, risk: "LOW", events24h: 0, events7d: 3, maxMagnitude7d: 2.8, meanDepthKm: 26, trend: "steady", svgX: 170, svgY: 289 },
  { region: "Kyushu", probabilityM4_24h: 13.4, probabilityM5_7d: 5.8, risk: "MODERATE", events24h: 3, events7d: 11, maxMagnitude7d: 4.6, meanDepthKm: 28, trend: "up", svgX: 85, svgY: 303 },
  { region: "Okinawa", probabilityM4_24h: 3.1, probabilityM5_7d: 1.1, risk: "LOW", events24h: 0, events7d: 1, maxMagnitude7d: 2.7, meanDepthKm: 36, trend: "down", svgX: 34, svgY: 360 },
];

export function classifyRisk(probability: number): RiskLevel {
  if (probability >= 30) return "HIGH";
  if (probability >= 15) return "ELEVATED";
  if (probability >= 5) return "MODERATE";
  return "LOW";
}
