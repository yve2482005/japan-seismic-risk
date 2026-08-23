import { readRawEarthquakeRows, readSheetRows } from "../googleSheets";
import { classifyRisk, JAPAN_REGIONS, type JapanRegion, type RegionActivity, type SeismicEvent } from "@shared/seismic";

const mapPositions: Record<JapanRegion, [number, number]> = {
  Hokkaido: [304, 72], Tohoku: [296, 150], Kanto: [269, 212], Chubu: [222, 218], Kansai: [178, 246], Chugoku: [126, 251], Shikoku: [170, 289], Kyushu: [85, 303], Okinawa: [34, 360],
};

type LiveRow = Record<string, string>;

function dateOrNull(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function numberOrNull(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedProbability(value: string) {
  const probability = numberOrNull(value);
  if (probability === null || probability < 0 || probability > 1) return null;
  return Number((probability * 100).toFixed(2));
}

function isRegion(value: string): value is JapanRegion {
  return JAPAN_REGIONS.includes(value as JapanRegion);
}

function asEvent(row: LiveRow): SeismicEvent | null {
  const origin = dateOrNull(row.origin_time_utc);
  const latitude = numberOrNull(row.latitude);
  const longitude = numberOrNull(row.longitude);
  const magnitude = numberOrNull(row.magnitude);
  if (!row.event_id || !origin || latitude === null || longitude === null || magnitude === null || !isRegion(row.region)) return null;
  return { eventId: row.event_id, region: row.region, locality: row.nearest_city || "Source locality not supplied", latitude, longitude, magnitude, depthKm: numberOrNull(row.depth_km), originTimeUtc: origin.toISOString(), source: row.source, sourceUrl: row.source_url, provenance: "verified" };
}

export function buildLiveSnapshot(rows: LiveRow[], now = new Date(), predictionRows: LiveRow[] = [], productionModelVersion: string | null = null) {
  const events = rows.map(asEvent).filter((event): event is SeismicEvent => event !== null).sort((a, b) => Date.parse(b.originTimeUtc) - Date.parse(a.originTimeUtc));
  const nowMs = now.getTime();
  const day = 24 * 60 * 60 * 1000;
  const productionPredictions = productionModelVersion ? predictionRows.filter(row => row.model_version === productionModelVersion && isRegion(row.region) && normalizedProbability(row.probability) !== null) : [];
  const predictionFor = (region: JapanRegion, targetPrefix: string) => {
    const matching = productionPredictions.filter(row => row.region === region && row.target_definition.startsWith(targetPrefix)).sort((left, right) => Date.parse(right.generated_at ?? "") - Date.parse(left.generated_at ?? ""));
    return matching.length ? normalizedProbability(matching[0]!.probability) : null;
  };
  const regions: RegionActivity[] = JAPAN_REGIONS.map(region => {
    const regional = events.filter(event => event.region === region);
    const last24 = regional.filter(event => nowMs - Date.parse(event.originTimeUtc) <= day);
    const prior24 = regional.filter(event => { const age = nowMs - Date.parse(event.originTimeUtc); return age > day && age <= 2 * day; });
    const last7d = regional.filter(event => nowMs - Date.parse(event.originTimeUtc) <= 7 * day);
    const depthValues = last7d.map(event => event.depthKm).filter((value): value is number => value !== null);
    const [svgX, svgY] = mapPositions[region];
    const probabilityM4_24h = predictionFor(region, "M4+");
    const probabilityM5_7d = predictionFor(region, "M5+");
    const riskProbability = Math.max(probabilityM4_24h ?? -1, probabilityM5_7d ?? -1);
    return { region, probabilityM4_24h, probabilityM5_7d, risk: riskProbability >= 0 ? classifyRisk(riskProbability) : "UNAVAILABLE", events24h: last24.length, events7d: last7d.length, maxMagnitude7d: last7d.length ? Math.max(...last7d.map(event => event.magnitude)) : null, meanDepthKm: depthValues.length ? Number((depthValues.reduce((sum, value) => sum + value, 0) / depthValues.length).toFixed(1)) : null, trend: last24.length > prior24.length ? "up" : last24.length < prior24.length ? "down" : "steady", svgX, svgY };
  });
  return { events, regions, latestCollection: rows.map(row => dateOrNull(row.collection_time)).filter((value): value is Date => value !== null).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null };
}

export async function getLiveSnapshot() {
  const [dataset, metricDataset, predictionDataset] = await Promise.all([readRawEarthquakeRows(), readSheetRows("MODEL_METRICS"), readSheetRows("PREDICTIONS")]);
  const latestMetric = [...metricDataset.rows].sort((left, right) => Date.parse(right.trained_at ?? "") - Date.parse(left.trained_at ?? ""))[0];
  const productionMetric = [...metricDataset.rows].filter(row => row.status === "production").sort((left, right) => Date.parse(right.trained_at ?? "") - Date.parse(left.trained_at ?? ""))[0];
  const snapshot = buildLiveSnapshot(dataset.rows, new Date(), predictionDataset.rows, productionMetric?.model_version ?? null);
  let metricReport: Record<string, unknown> | null = null;
  try { metricReport = latestMetric?.metrics_json ? JSON.parse(latestMetric.metrics_json) as Record<string, unknown> : null; } catch { metricReport = null; }
  const numberMetric = (key: string) => typeof metricReport?.[key] === "number" ? metricReport[key] as number : null;
  return {
    mode: "live" as const,
    generatedAt: new Date().toISOString(),
    collection: { status: snapshot.events.length ? "active" as const : "awaiting_first_scheduled_collection" as const, source: "U.S. Geological Survey (USGS), ANSS ComCat public CSV", sourceUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv", spreadsheetId: dataset.spreadsheetId, lastSuccess: snapshot.latestCollection, nextRun: "Public GitHub Actions workflow at minute 17 of each hour (UTC)", recordsAccepted: snapshot.events.length, duplicatesRejected: null, invalidRejected: null },
    model: latestMetric ? { status: latestMetric.status || "candidate", version: latestMetric.model_version || null, target: latestMetric.target_definition || "M4+ in the next 24 hours", accuracy: numberMetric("accuracy"), precision: numberMetric("precision"), recall: numberMetric("recall"), prAuc: numberMetric("pr_auc"), brierScore: numberMetric("brier_score"), calibration: productionMetric ? "Real chronological test metrics are sourced from the latest Google Sheets model report. Regional probabilities use only rows generated by a promoted production model." : "Real chronological test metrics are sourced from the latest Google Sheets model report. Probabilities remain unavailable until a promoted model is present." } : { status: "awaiting_validated_history" as const, version: null, target: "M4+ in the next 24 hours", accuracy: null, precision: null, recall: null, prAuc: null, brierScore: null, calibration: "Probabilities remain unavailable until a candidate model is trained and passes chronological evaluation." },
    events: snapshot.events,
    regions: snapshot.regions,
  };
}
