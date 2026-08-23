# Local Live Collection Service

`live_usgs_pipeline.py` is the approved live collector. It downloads the documented USGS monthly CSV file—not the ComCat/FDSN earthquake API—at most once per hour, filters the configured Japan monitoring envelope, validates source fields, preserves raw and normalized values, deduplicates in a local SQLite state file, and upserts attributed records to Google Sheets. It uses the owner-approved exception for the absent `robots.txt` directive; the full terms, source URL, interval, and attribution decision are recorded in `docs/source-research.md`.

## One-time local setup

Install the dependencies with `python -m pip install -r requirements.txt`. Set `GOOGLE_SERVICE_ACCOUNT_JSON` in your computer’s protected environment/secret manager to the same service-account JSON already supplied to this project. Do not save the JSON in this repository. Then run:

```bash
python live_usgs_pipeline.py --share-email <your-approved-Google-email> --force
```

The first run automatically creates and shares **Japan Seismic Monitor — Live Dataset**, initializes all six required tabs and headers, then imports the latest permitted USGS CSV records in the configured Japan envelope. Later runs use `live_collector_state.sqlite3` to avoid reprocessing unchanged events.

## GitHub Actions execution

The production zero-cost execution path is the public GitHub Actions workflow under `.github/workflows/`. It uses encrypted repository secrets and GitHub-hosted short-lived Python runners; it does not require a personal computer. Read `docs/GITHUB_ACTIONS_DEPLOYMENT.md` before activation.

`google_sheets_sink.py` creates the six required tabs, writes the raw-record header row, and upserts by `event_id`; it remains unavailable until the operator supplies `GOOGLE_APPLICATION_CREDENTIALS`. `train_models.py` builds complete chronological feature/label rows and evaluates Logistic Regression, Random Forest, and gradient boosting. Its standard run keeps M4+/24h, M5+/24h, M5+/7d, and M6+/7d targets separate. It reports held-out metrics and calibration bins, and refuses insufficient, class-diverse data rather than manufacturing an apparent score.
