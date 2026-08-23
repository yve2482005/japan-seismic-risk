# Public Source Review

## Japan Meteorological Agency

The Japan Meteorological Agency (JMA) states that it operationally monitors seismic activity throughout Japan and issues information on hypocenter, magnitude, and seismic intensity. Its English public earthquake-monitoring page also states that timing, location, and scale of Nankai Trough earthquakes are difficult to predict accurately. This supports the dashboard’s explicit framing of model-derived probabilities rather than deterministic predictions.

JMA’s English Seismological Bulletin page exposes a public download path and year/month links for earthquake material from 1997 through 2023. The initial collection adapter will be designed for documented, downloadable catalog artifacts rather than an earthquake-data API. JMA’s published English terms state that they are based on Public Data License 1.0 and compatible with CC BY 4.0, while requiring source citation and preserving relevant rights restrictions. Before any production collection run, the service design requires a documented robots.txt and terms review, plus source-specific rate limits, a descriptive user agent, timeouts, retries, and a stored source URL for every record.

| Item | URL | Design implication |
| --- | --- | --- |
| JMA earthquake monitoring overview | https://www.jma.go.jp/jma/en/Activities/earthquake.html | Use for source attribution and scientifically responsible limitation language. |
| JMA Seismological Bulletin earthquake page | https://www.data.jma.go.jp/eqev/data/bulletin/eqdoc_e.html | Candidate catalog adapter; only downloadable public artifacts are eligible. |
| JMA Website Terms of Use | https://www.jma.go.jp/jma/en/copyright.html | Requires attribution and retains applicable rights restrictions; operational use must respect the published terms. |
| Data-host robots endpoint | https://www.data.jma.go.jp/robots.txt | Returned a 404 page on 23 August 2026; do not infer permission from its absence. Require an explicit compliance review before enabling this adapter. |

The application must treat a source as disabled by default until a source-compliance review records the applicable robots.txt/terms URL, access decision, fetch interval, and review timestamp. It must not infer permission from a missing robots file. It must not circumvent access restrictions, login walls, CAPTCHAs, or other controls.
