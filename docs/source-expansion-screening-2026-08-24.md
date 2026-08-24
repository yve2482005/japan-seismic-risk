# Source-Expansion Screening — 24 August 2026

## Scope and non-negotiable safeguards

This screening evaluates possible additional earthquake-data sources for a Japan monitor. It does not activate any source. The existing hourly USGS public CSV collection remains the only live dashboard and live-production-model dataset. No earthquake-data API, restricted current endpoint, CAPTCHA bypass, credentialed source, or search-result scraping is permitted.

## Official-source findings

| Candidate | Official access finding | Overlap / scientific implication | Screening outcome |
|---|---|---|---|
| JMA Seismological Bulletin static archive | The official bulletin provides earthquake data as compressed ZIP files, and JMA’s legal notice permits use under the Public Data License unless specifically indicated otherwise; source citation is required. | Historical, not live. The project already uses a four-month 2023 archive as a source-separated dataset. More archive months can support JMA-only historical evaluation but cannot satisfy or accelerate the USGS-live production gate. | Potentially eligible for a separately approved, bounded historical expansion only. |
| Alternate USGS summary CSV feeds | The USGS CSV page lists hour/day/week/month variants of the same summary-feed family. | They are alternate time windows or magnitude filters, not an independent catalog. Adding them would duplicate records rather than provide independent accumulation. | Reject as an additional source. Retain `all_month.csv` only. |
| EMSC website and data queries | EMSC presents current earthquake data and dedicated data-query functionality. | A live integration would be an additional earthquake-data service/API or page-derived feed, contrary to the project’s no-earthquake-data-API rule. It also introduces cross-catalog event matching and provenance uncertainty. | Reject under the current constraints. |
| NIED Hi-net | Previously excluded by the owner. | Not reconsidered. | Reject. |

## Evidence and required treatment

1. [JMA Seismological Bulletin](https://www.data.jma.go.jp/eqev/data/bulletin/index_e.html) states that its data are compressed in ZIP format and presents monthly archive selections.
2. [JMA Legal Notice](https://www.jma.go.jp/jma/en/copyright.html) requires source citation and prohibits presenting edited content in a way that could be misconstrued as created by the Government of Japan.
3. [USGS CSV feed documentation](https://earthquake.usgs.gov/earthquakes/feed/v1.0/csv.php) lists the hour/day/week/month CSV feed windows, demonstrating that the candidate variants are not independent data sources.
4. [EMSC](https://www.emsc-csem.org/) presents both current earthquake information and a data-query service; this is incompatible with the project’s no-earthquake-data-API rule.

## Recommendation pending owner approval

Only a further **bounded JMA static-archive backfill** is worth considering. It must use official ZIP files only; preserve archive period, URL, source member, source line, attribution, local/UTC time, JMA identifier, and source-local duplicate status; keep rows outside `USGS_LIVE_EARTHQUAKES`; and remain in JMA-only chronological evaluation. It must never generate live dashboard observations, satisfy the USGS 500-record/90-day gate, or create USGS live probabilities.
