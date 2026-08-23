# Collection-Rate Review

## Current Live Constraint

The approved live source is the USGS `all_month.csv` public feed. Its official CSV documentation lists `all_hour`, `all_day`, `all_week`, and `all_month` products. Because the active collector already uses the largest of these (`all_month`) and retains previously accepted IDs in Google Sheets, polling more frequently cannot create additional distinct events; it only reduces ingestion latency.

## JMA Historical Backfill Candidate

The JMA Seismological Bulletin publishes compressed ZIP data with a visible archive from 1997 through December 2023. JMA's legal notice permits use under Public Data License 1.0 unless a specific rights notice applies, requires source attribution, requires care with third-party rights, and warns of legal restrictions around warnings and meteorological services.

The JMA current earthquake page was inspected on 2026-08-23. Its rendered table lacked a documented downloadable full-record artifact. Passive resource inspection showed that the page loads `https://www.jma.go.jp/bosai/quake/data/list.json`; that is a data endpoint rather than an approved downloadable catalog artifact for this project. It must not be added to the collector because the project prohibits earthquake-data APIs.

The official JMA bulletin earthquake-data page confirms separate monthly and annual archive links for its earthquake-data section and displays coverage from October 1997 through December 2023. This makes it a potential one-time historical archive, not a replacement for the 2026 live feed.

## Provisional Decision

Do not alter the approved live USGS collection cadence or broaden the Japan envelope. A separate, one-time JMA historical backfill may be considered only after an explicit compliance review of the exact ZIP artifact, schema mapping, source attribution, license caveats, deduplication boundary, and a decision to keep it distinct from live USGS observations. It must not be activated automatically or used to claim that live collection became faster.

## Recommended Priority

1. Keep the live USGS `all_month.csv` workflow at one request per hour. It is already more frequent than the feed's documented minute-level updates while preserving the owner-approved conservative access pattern.
2. Do not add `all_hour`, `all_day`, or `all_week` as additional sources. They are smaller overlapping windows of the already-collected `all_month` product and can improve freshness checks only, not the count of unique events.
3. Do not broaden the Japan envelope, accept non-earthquake event types, weaken validation, or count source revisions as new events. These would inflate the record count without increasing scientifically valid training evidence.
4. If the owner approves after a specific artifact-level compliance review, design a one-time, separately attributed JMA historical-backfill workflow for model-development history. It must preserve source-specific records, use time-aware source-aware evaluation, and keep the live USGS feed as the sole dashboard activity source unless later approved otherwise.

## Additional-Source Screening

| Candidate | Finding | Decision |
| --- | --- | --- |
| USGS hour/day/week feeds | Smaller rolling windows that overlap the existing `all_month.csv` source. | Reject for unique-record growth. |
| NIED Hi-net / JUICE | Downloadable historical material exists, but NIED states that redistribution of seismic data is prohibited. | Reject. |
| EMSC / SeismicPortal | The official data-query page describes web services including FDSN and real-time WebSocket access. Its terms reserve rights except for stated limited or dataset-specific use. | Reject: the project prohibits earthquake-data APIs and lacks a specific approved downloadable Japan catalog license. |
| ISC-GEM | Static CSV is available under CC-BY-SA 3.0, but its coverage is historical (through 2021) and focuses on large events, generally M5.5+ with limited lower-magnitude continental coverage. | Do not use for live-rate acceleration; potentially useful only as a separately evaluated long-term calibration reference. |
| JMA bulletin ZIP archive | Official static monthly archive, 1997-10 to 2023-12, with JMA attribution terms. | The only viable candidate for a separately sourced one-time historical backfill, pending artifact-level compliance review and owner approval. |

A research-only inspection of the official December 2023 JMA earthquake-parameter ZIP returned HTTP 200 as a static 316 KB ZIP containing one 1.52 MB fixed-width text file. The file has 16,763 lines including three header lines, indicating approximately 16,760 candidate event lines for that month before parsing, validation, and source-specific quality checks. These records were not imported into the project.

## Sources

- https://earthquake.usgs.gov/earthquakes/feed/v1.0/csv.php
- https://earthquake.usgs.gov/earthquakes/search/
- https://www.data.jma.go.jp/eqev/data/bulletin/index_e.html
- https://www.jma.go.jp/jma/en/copyright.html
- https://www.data.jma.go.jp/multi/quake/
