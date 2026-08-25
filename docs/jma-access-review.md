# JMA archive access review

## Review date
2026-08-25.

## Verified official archive page
The Japan Meteorological Agency (JMA) Seismological Bulletin of Japan page is https://www.data.jma.go.jp/eqev/data/bulletin/index_e.html. The page states that data are compressed in ZIP format and exposes historical monthly selections, including 2023/09 through 2023/12, plus older periods. The page provides data categories including hypocenter, arrival time, nodal-plane solution, CMT solution, seismic intensity, and tsunami data. The approved backfill must use the official static historical ZIP archive only; it must not use a current/restricted endpoint.

## Verified legal notice
JMA’s legal notice is https://www.jma.go.jp/jma/en/copyright.html. It states that JMA website content may be used under the Public Data License (Version 1.0), unless a specific rights notice applies. It requires source citation and says edited content must also be identified as edited, without presenting it in a way that could be misconstrued as created by the Government of Japan. The notice also warns that some content may involve third-party rights and that use may be restricted by the Meteorological Service Act and related ordinances, including provisions concerning licensed forecasting services and warnings. The monitor therefore must present JMA-derived results as historical/research data, not official warnings or exact predictions, and must retain source URLs and edited-data attribution.

## Pending before download
The archive file URLs and robots.txt status still need to be checked directly. Before automated download, the implementation must record the exact archive URL(s), request only the required static ZIP artifacts, use a conservative rate, avoid CAPTCHA/authentication/rate-limit bypass, validate checksums or downloaded content, and retain archive-period provenance for every imported record.

## robots.txt check
The checked URL https://www.data.jma.go.jp/robots.txt returned the official JMA 404 page rather than a robots file. This means no robots directives were available at that exact host/path. It is not permission to scrape broadly: access remains limited to the explicitly published static archive, subject to the JMA legal notice, conservative request rate, and all technical restrictions. The exact ZIP URL still must be resolved from the bulletin page before download.

## Exact archive URL verification
The bulletin page’s official JavaScript constructs historical hypocenter archive URLs as `https://www.data.jma.go.jp/eqev/data/bulletin/catalog/table2/hYYYYMMt.zip` for the relevant monthly catalog. Conservative HEAD checks with a descriptive User-Agent returned HTTP 200 for:

| Archive period | Verified URL | Result |
|---|---|---|
| 2023-09 | https://www.data.jma.go.jp/eqev/data/bulletin/catalog/table2/h202309t.zip | HTTP 200; 423,354 bytes |
| 2023-10 | https://www.data.jma.go.jp/eqev/data/bulletin/catalog/table2/h202310t.zip | HTTP 200; 369,882 bytes |
| 2023-11 | https://www.data.jma.go.jp/eqev/data/bulletin/catalog/table2/h202311t.zip | HTTP 200; 330,054 bytes |
| 2023-12 | https://www.data.jma.go.jp/eqev/data/bulletin/catalog/table2/h202312t.zip | HTTP 200; 322,644 bytes |

The newer `data/hypo/hYYYYMM.zip` path shown by a separate page script returned 404 for these months and will not be used. The existing parser’s `catalog/table2/hYYYYMMt.zip` path is the verified path.
