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

## NIED Hi-net JUICE Review

NIED’s JUICE page exposes a publicly downloadable catalog covering 2001–2012, but it is not an appropriate live source because it is historical only. Its English policies page reserves copyright unless otherwise specified and expressly states that redistribution of seismic data is prohibited. The site is therefore ineligible for automatic collection into a redistributable live dashboard unless NIED provides explicit permission for that precise use. It must remain disabled.

| Item | URL | Decision |
| --- | --- | --- |
| JUICE catalog page | https://www.hinet.bosai.go.jp/topics/JUICE/ | Public historical download only; unsuitable for live monitoring. |
| Hi-net policies | https://www.hinet.bosai.go.jp/policies/?LANG=en | Do not activate: published policy prohibits redistribution of seismic data. |

## USGS ComCat Review

USGS ComCat publishes a global earthquake catalog and documents publicly downloadable real-time feeds in CSV, GeoJSON, KML, QuakeML, and related formats. Its documentation also separates those feeds from the web-service API. The live pipeline must not use the API; a source adapter could only use a documented downloadable catalog/feed artifact after the project records its source URL, collection interval, and access-policy review.

USGS search results link to a general USGS policy that USGS-authored or produced information is generally public domain, while warning that some materials may include third-party rights. The official terms page did not render in the browser session on 23 August 2026, so its exact page content could not yet be preserved from this check. A source-compliance review remains pending until a successful policy retrieval and robots review are recorded.

| Item | URL | Current decision |
| --- | --- | --- |
| ComCat documentation | https://earthquake.usgs.gov/data/comcat/ | Candidate fallback only; use downloadable feed/catalog artifacts, never the earthquake API. |
| USGS copyrights and credits | https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits | General public-domain policy is indicated by search; exact page retrieval must be repeated before activation. |

## EMSC Review

EMSC’s host publishes a `robots.txt` file. It disallows a finite set of image and document directories only; its public earthquake-information path is not listed among those restrictions. The public catalog page provides worldwide latest-earthquake search and displays event time, location, depth, magnitude, and region fields, including worldwide events relevant to Japan. However, the only policy link visible on that page is a privacy page; no accessible data-reuse or automated-access terms were identified during this review. The source must remain pending rather than activated until EMSC provides an explicit policy authorizing the required automated collection and redistribution.

| Item | URL | Decision |
| --- | --- | --- |
| EMSC robots directives | https://www.emsc-csem.org/robots.txt | Catalog path is not disallowed, but robots permission alone is insufficient. |
| EMSC public earthquake catalog | https://www.emsc-csem.org/Earthquake_information/ | Candidate only; do not activate until explicit data-use/automated-access terms are confirmed. |

## Live-Source Decision: USGS Public CSV Feed

The JMA English current-earthquake page exposes a current table of observed time, epicenter name, magnitude, maximum intensity, and issuance time. Its public event-detail URLs can be reached without authentication, but the detail page observed in this review was client-rendered and did not expose reliably extractable latitude, longitude, or depth in its accessible page text. The JMA Bulletin is historical and does not provide current records. JMA is therefore retained as an attributed reference and potential future adapter, but is not the initial full-record source.

The approved live source is the USGS ComCat public monthly CSV download:

`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv`

USGS ComCat documentation explicitly identifies downloadable real-time feeds including CSV/Spreadsheet; USGS states that USGS-authored or produced data and information are generally public domain and asks that users give credit. The owner expressly approved a narrow exception to the previously enforced missing-robots-file rule for a documented public downloadable feed. This adapter will not call the ComCat/FDSN web-service API. It will make one conditional CSV download per hour with a descriptive user agent, timeout, bounded retries, and no attempt to bypass technical restrictions. It will filter downloaded records to the documented Japan monitoring envelope (latitude 20–50°N, longitude 120–155°E), retain the feed URL and event URL, and label all records as USGS-provided.

| Decision item | Value |
| --- | --- |
| Source | USGS ANSS Comprehensive Earthquake Catalog (ComCat) public CSV feed |
| Download URL | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv |
| Access method | One public CSV download every 60 minutes; no earthquake API use |
| Terms/data-use basis | USGS public-domain policy with source credit; review third-party-rights caveat for non-USGS material |
| Robots status | Host returned 404; owner-approved exception documented 23 August 2026 |
| Attribution | `Source: U.S. Geological Survey (USGS), ANSS ComCat`; retain feed and per-event URL |
| Exclusions | Do not use NIED; do not scrape search results; do not use CAPTCHA/authenticated/restricted paths |
