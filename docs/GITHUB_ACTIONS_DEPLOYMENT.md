# Zero-Cost Public GitHub Actions Deployment

The scheduled service is designed for a **public GitHub repository**. GitHub states that Actions execution is free for public repositories, while scheduled jobs can be delayed or dropped during load and are disabled after 60 days without repository activity. The workflow therefore runs at minute 17 of every hour, not at the top of the hour, and uses a daily training run at 03:43 UTC. [1](https://github.com/pricing) [2](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## Required Repository Secrets

Add the following under **Repository → Settings → Secrets and variables → Actions**. Do not place either value in a source file, workflow log, issue, or chat message.

| Secret name | Value to add | Purpose |
| --- | --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The existing Google service-account JSON document | Authenticates the scheduled Python process to the approved Google Sheet. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | `1zqrin-UJtinVQzODbTfX1VbkKm8PcLkqcQaaR-WDWTM` | Selects the approved live dataset spreadsheet. |

The service account must retain **Editor** access to the spreadsheet. The workflows never print either secret and request no Google password.

## Workflow Behavior

`live-usgs-collection.yml` downloads only the approved USGS monthly CSV file once per hour, with a 12-minute workflow timeout. It does not call an earthquake API, scrape search-result pages, or attempt to bypass access controls. It normalizes timestamps, validates coordinates/magnitude/depth, filters the configured Japan monitoring envelope, preserves source URL plus raw/normalized values, and upserts source rows by event ID and source-update timestamp.

`quality-gated-model-training.yml` runs daily. It builds chronological features and labels from validated sheet rows, then trains only after the dataset has at least 500 validated records, 90 days of event history, and 12 positive M4+/24-hour regional labels. Before the quality gate passes, it records an explicit deferral status and produces no score, probability, or prediction. A target that lacks chronological class diversity is also deferred instead of being forced into a metric report. This protects against fabricated metrics and premature risk claims.

`scheduler-heartbeat.yml` commits a timestamp-only heartbeat every Monday. It contains no source rows, credentials, or private data. Its purpose is to maintain repository activity so the public repository’s scheduled workflows do not become disabled after GitHub’s documented 60-day inactivity period.

## First Activation

After exporting this project to a public repository and adding the two secrets, open **Actions → Live USGS public CSV collection → Run workflow** once. The hourly schedule then continues independently of your phone. Open the daily training workflow manually only for testing; it will safely defer until real history meets the gate.

## References

1. [GitHub Pricing](https://github.com/pricing)
2. [GitHub Actions schedule event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
