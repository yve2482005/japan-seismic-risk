import type { JapanRegion, SeismicEvent } from "@shared/seismic";

export type ForecastTarget = {
  magnitudeThreshold: number;
  horizonHours: number;
  regionScoped: boolean;
};

export type FeatureRow = {
  anchorEventId: string;
  anchorTimeUtc: string;
  region: JapanRegion;
  eventsLast1h: number;
  eventsLast6h: number;
  eventsLast24h: number;
  eventsLast3d: number;
  eventsLast7d: number;
  eventsLast30d: number;
  magnitudeMin24h: number | null;
  magnitudeMax24h: number | null;
  magnitudeMean24h: number | null;
  magnitudeMedian24h: number | null;
  magnitudeStdDev24h: number | null;
  depthMin24h: number | null;
  depthMean24h: number | null;
  depthMax24h: number | null;
  hoursSincePrevious: number | null;
  hoursSinceM3Plus: number | null;
  hoursSinceM4Plus: number | null;
  hoursSinceM5Plus: number | null;
  distanceFromPreviousKm: number | null;
  localEventDensity24h: number;
  regionalEventDensity7d: number;
  activityChangeRate: number | null;
  magnitudeTrend: number | null;
  shortToLongActivityRatio: number | null;
  historicalM4Plus: number;
  historicalM5Plus: number;
  historicalM6Plus: number;
  targetOccurred: boolean;
};

export type LabeledTargetRow = FeatureRow & { targetName: string; magnitudeThreshold: number; horizonHours: number };

const HOUR = 60 * 60 * 1000;

function isRelevant(candidate: SeismicEvent, anchor: SeismicEvent, regionScoped: boolean) {
  return !regionScoped || candidate.region === anchor.region;
}

function statistics(values: number[]) {
  if (!values.length) return { min: null, max: null, mean: null, median: null, standardDeviation: null };
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[midpoint]! : ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2;
  const standardDeviation = Math.sqrt(values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / values.length);
  return { min: Math.min(...values), max: Math.max(...values), mean, median, standardDeviation };
}

function haversineKilometres(left: SeismicEvent, right: SeismicEvent) {
  const radians = Math.PI / 180;
  const dLat = (right.latitude - left.latitude) * radians;
  const dLon = (right.longitude - left.longitude) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(left.latitude * radians) * Math.cos(right.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hoursSince(previous: SeismicEvent[], anchorTime: number, magnitudeAtLeast?: number) {
  const candidate = magnitudeAtLeast === undefined ? previous.at(-1) : [...previous].reverse().find(event => event.magnitude >= magnitudeAtLeast);
  return candidate ? (anchorTime - Date.parse(candidate.originTimeUtc)) / HOUR : null;
}

/**
 * Builds features from strictly earlier records, then labels from a later window.
 * The separation prevents future observations from entering a training feature.
 */
export function buildChronologicalFeatures(events: SeismicEvent[], target: ForecastTarget): FeatureRow[] {
  const ordered = [...events].sort((a, b) => Date.parse(a.originTimeUtc) - Date.parse(b.originTimeUtc));
  return ordered.map((anchor, index) => {
    const anchorTime = Date.parse(anchor.originTimeUtc);
    const previous = ordered.slice(0, index).filter(event => isRelevant(event, anchor, target.regionScoped));
    const inWindow = (hours: number) => previous.filter(event => anchorTime - Date.parse(event.originTimeUtc) <= hours * HOUR);
    const inRange = (fromHours: number, toHours: number) => previous.filter(event => {
      const age = anchorTime - Date.parse(event.originTimeUtc);
      return age > fromHours * HOUR && age <= toHours * HOUR;
    });
    const last24 = inWindow(24);
    const previous24 = inRange(24, 48);
    const last30 = inWindow(24 * 30);
    const magnitudes = last24.map(event => event.magnitude);
    const depths = last24.flatMap(event => event.depthKm === null ? [] : [event.depthKm]);
    const magStats = statistics(magnitudes);
    const depthStats = statistics(depths);
    const previousEvent = previous.at(-1);
    const localEventDensity24h = last24.filter(event => haversineKilometres(event, anchor) <= 100).length;
    const activityChangeRate = previous24.length ? (last24.length - previous24.length) / previous24.length : last24.length ? null : 0;
    const previousMagnitudeMean = statistics(previous24.map(event => event.magnitude)).mean;
    const targetLimit = anchorTime + target.horizonHours * HOUR;
    const targetOccurred = ordered.slice(index + 1).some(event => {
      const eventTime = Date.parse(event.originTimeUtc);
      return eventTime > anchorTime && eventTime <= targetLimit && isRelevant(event, anchor, target.regionScoped) && event.magnitude >= target.magnitudeThreshold;
    });

    return {
      anchorEventId: anchor.eventId,
      anchorTimeUtc: anchor.originTimeUtc,
      region: anchor.region,
      eventsLast1h: inWindow(1).length,
      eventsLast6h: inWindow(6).length,
      eventsLast24h: last24.length,
      eventsLast3d: inWindow(24 * 3).length,
      eventsLast7d: inWindow(24 * 7).length,
      eventsLast30d: last30.length,
      magnitudeMin24h: magStats.min,
      magnitudeMax24h: magStats.max,
      magnitudeMean24h: magStats.mean,
      magnitudeMedian24h: magStats.median,
      magnitudeStdDev24h: magStats.standardDeviation,
      depthMin24h: depthStats.min,
      depthMean24h: depthStats.mean,
      depthMax24h: depthStats.max,
      hoursSincePrevious: hoursSince(previous, anchorTime),
      hoursSinceM3Plus: hoursSince(previous, anchorTime, 3),
      hoursSinceM4Plus: hoursSince(previous, anchorTime, 4),
      hoursSinceM5Plus: hoursSince(previous, anchorTime, 5),
      distanceFromPreviousKm: previousEvent ? haversineKilometres(previousEvent, anchor) : null,
      localEventDensity24h,
      regionalEventDensity7d: inWindow(24 * 7).length,
      activityChangeRate,
      magnitudeTrend: magStats.mean !== null && previousMagnitudeMean !== null ? magStats.mean - previousMagnitudeMean : null,
      shortToLongActivityRatio: last30.length ? (last24.length / 1) / (last30.length / 30) : null,
      historicalM4Plus: previous.filter(event => event.magnitude >= 4).length,
      historicalM5Plus: previous.filter(event => event.magnitude >= 5).length,
      historicalM6Plus: previous.filter(event => event.magnitude >= 6).length,
      targetOccurred,
    };
  });
}

export function buildLabeledTargets(events: SeismicEvent[], targets: ForecastTarget[]): LabeledTargetRow[] {
  return targets.flatMap(target => buildChronologicalFeatures(events, target).map(row => ({
    ...row,
    targetName: `M${target.magnitudeThreshold.toFixed(1)}_NEXT_${target.horizonHours}H`,
    magnitudeThreshold: target.magnitudeThreshold,
    horizonHours: target.horizonHours,
  })));
}

export function chronologicalSplit<T>(rows: T[], trainingShare = 0.7, validationShare = 0.15) {
  const trainingEnd = Math.floor(rows.length * trainingShare);
  const validationEnd = Math.floor(rows.length * (trainingShare + validationShare));
  return {
    training: rows.slice(0, trainingEnd),
    validation: rows.slice(trainingEnd, validationEnd),
    test: rows.slice(validationEnd),
  };
}
