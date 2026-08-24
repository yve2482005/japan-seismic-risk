# JMA–USGS Hybrid Model Feasibility Assessment — 24 August 2026

## Decision summary

A direct, row-level mixture of JMA and USGS records into one live earthquake-risk training table is **not scientifically defensible at this stage**. It would conflate two catalog-generation processes, risk double-counting the same events, and misstate the meaning of magnitude- and time-based labels.

There is a potentially defensible **research-only hybrid design**, but only after a dedicated catalog-harmonization study and a true held-out chronological evaluation. It must not alter the USGS-only live production gate, dashboard activity feed, or probability outputs unless it independently earns promotion under separately defined safeguards.

## Evidence of catalog non-equivalence

The official JMA bulletin is a regional catalogue built from JMA processing and cooperative seismic-wave data. It states that its catalogue uses Japan Standard Time notation, Japanese Geodetic Datum 2000, and contains the JMA event catalogue. [1]

USGS explains that reporting agencies can differ because of methodology, data availability, processing, Earth models, monitoring scope, and inherent uncertainty. It notes that differences of 0.2–0.3 magnitude units are common, can be larger across magnitude types, and that its global process differs from a regionally focused network. [2]

A 2025 peer-reviewed catalog-integration study illustrates the required work: it used multiple-window duplicate detection, conversion of multiple reported magnitude scales to a common scale, declustering, and completeness analysis before treating a multi-source catalog as suitable for seismicity or hazard analysis. [3]

Therefore, a shared `magnitude >= 4` label is not automatically the same target across the two sources. Likewise, a proximity-and-time match should identify a cross-catalog *candidate link*, not silently delete or treat either original record as ground truth.

## Designs considered

| Design | Feasibility | Required safeguards | Live-production status |
|---|---|---|---|
| Directly append JMA rows to USGS live training data | Reject | Would require unjustified magnitude/location/time equivalence and can double-count events. | Never use. |
| Deduplicate then train one pooled model | Not yet defensible | A pre-registered linkage rule; matched-event analysis; region/depth/magnitude-type harmonization fitted only on historical train folds; source indicators; chronology-preserving splits; calibration and uncertainty checks by source. | Research-only until independently validated. |
| Source-aware ensemble | Potential research candidate | Train JMA and USGS models separately; calibrate each on its own chronology; a meta-layer may use only out-of-fold historical predictions and must preserve source labels. | Research-only; cannot generate live USGS probabilities initially. |
| Parallel models and descriptive comparison | Safest current option | Keep datasets physically and logically separate; compare coverage, matching rates, and source-specific held-out metrics without pooled training. | Allowed descriptive research only. |

## Minimum evidence required before any experimental pooled model

1. A reproducible cross-catalog linkage analysis with no destructive deletion and a reviewable `possible_match` status.
2. Explicit treatment of unmatched events, magnitude type, time-zone conversion, coordinate datum, depth, revision/version, and completeness threshold.
3. **Nested chronological evaluation**: every harmonization parameter, match threshold, and calibration transform must be learned only from the training period, then applied to later validation/test periods.
4. Evaluation against source-separated baselines on the same future periods using PR-AUC, recall, false-positive rate, Brier score, expected calibration error, coverage, and uncertainty intervals.
5. A separate model registry/dataset version and a clear dashboard statement that any output is experimental—not an official warning or exact earthquake prediction.

## Current project constraint

The JMA archive currently covers only 2023-09 through 2023-12, while the USGS live feed is a recent rolling live window. There is no meaningful overlapping, contemporaneous training history in the current project state for a fair hybrid evaluation. No hybrid metrics, probabilities, or model artifacts will be created from the present data.

### Read-only source-coverage check

On 24 August 2026, a read-only aggregate check of the approved Sheet found **60,867 validated JMA records** spanning `2023-08-31T15:01:22Z` to `2023-12-31T14:58:23Z`, and **122 validated USGS live records** spanning `2026-07-24T18:43:04Z` to `2026-08-23T13:44:53Z`. The time ranges do not overlap. Every current JMA row is marked `no_usgs_match_checked`, which is expected because the USGS live window is years later.

It would therefore be invalid to claim `60,867 + 122` pooled unique events, or to use JMA records to satisfy the USGS live production threshold. The check did not write to Google Sheets and did not change the USGS production dataset.

## References

[1] [JMA, Notes for the Seismological Bulletin of Japan](https://www.data.jma.go.jp/eqev/data/bulletin/readme_e.html)

[2] [USGS, Why do earthquake magnitudes differ between agencies?](https://www.usgs.gov/faqs/why-do-usgs-earthquake-magnitudes-differ-those-published-other-agencies)

[3] Maiti, S. K. and Kim, B. (2025), [An updated, homogeneous, and declustered earthquake catalog for South Korea and neighboring regions](https://nhess.copernicus.org/articles/25/4021/2025/), *Natural Hazards and Earth System Sciences*, 25, 4021–4041. https://doi.org/10.5194/nhess-25-4021-2025
