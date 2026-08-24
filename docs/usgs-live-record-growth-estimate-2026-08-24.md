# USGS Live Record Growth Estimate — 24 August 2026

This note estimates when the **USGS-only live dataset** may reach the 500-record threshold that is one of several prerequisites for the production-model workflow. It is an operational planning estimate, not a seismic forecast and not a guarantee of model promotion.

## Observed live-data baseline

The latest USGS-only quality-gated workflow completed on 24 August 2026 with **120 validated training records** across **28.97 days** of source-record history. The gate reported 72 positive labels, already above the 12-label minimum; its remaining blockers were the 500-record and 90-day-history requirements.

| Quantity | Value |
|---|---:|
| Validated USGS live records | 120 |
| Required validated USGS live records | 500 |
| Remaining records | 380 |
| Observed event density | 4.14 records/day |
| Remaining history required for 90 days | 61.03 days |

At the observed event density, 380 additional records require approximately **91.73 days**. Counting from the latest quality-gate timestamp, the midpoint planning date is approximately **23 November 2026 UTC**.

## Uncertainty and limits

Earthquake occurrence is variable, so this is not a commitment. A simple event-count uncertainty calculation over the 120-record, 28.97-day observation window gives an indicative rate interval of approximately **3.40–4.88 records/day**, corresponding to about **78–112 days** for the remaining 380 records. The associated illustrative date range is **10 November to 14 December 2026 UTC**.

The system must still defer even after reaching 500 records unless the data retain at least 90 days of coverage and the chronological candidate satisfies every held-out quality, calibration, and production-comparison safeguard. Neither this estimate nor the JMA historical archive may be used to accelerate the USGS-only production threshold.

## Evidence

The figures above come from the repository’s successful USGS quality-gated training run and apply only to the dedicated `USGS_LIVE_EARTHQUAKES` source-separated tab. The live collection source remains the public [USGS `all_month.csv` feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv), collected hourly at UTC minute 17.
