import type { JapanRegion, SeismicEvent } from "@shared/seismic";

export type EventFilters = { period: "24h" | "7d" | "30d"; minimumMagnitude: number; region: JapanRegion | "All"; query: string };

export function explorerDataState({ isLoading, isError, hasData }: { isLoading: boolean; isError: boolean; hasData: boolean }) {
  if (isLoading) return "loading" as const;
  if (isError || !hasData) return "error" as const;
  return "ready" as const;
}

export function filterLiveEvents(events: SeismicEvent[], filters: EventFilters, now: Date) {
  const hours = filters.period === "24h" ? 24 : filters.period === "7d" ? 24 * 7 : 24 * 30;
  const earliest = now.getTime() - hours * 60 * 60 * 1000;
  const needle = filters.query.trim().toLowerCase();
  return events.filter(event => Date.parse(event.originTimeUtc) >= earliest && event.magnitude >= filters.minimumMagnitude && (filters.region === "All" || event.region === filters.region) && (!needle || `${event.locality} ${event.region}`.toLowerCase().includes(needle)));
}

export function magnitudeBins(events: SeismicEvent[]) {
  const labels = ["M2–2.9", "M3–3.9", "M4–4.9", "M5+"];
  const counts = [0, 0, 0, 0];
  for (const event of events) {
    if (event.magnitude < 3) counts[0] += 1;
    else if (event.magnitude < 4) counts[1] += 1;
    else if (event.magnitude < 5) counts[2] += 1;
    else counts[3] += 1;
  }
  return labels.map((label, index) => ({ label, count: counts[index] }));
}
