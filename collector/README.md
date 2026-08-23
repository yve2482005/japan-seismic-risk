# Python Collection Service Scaffold

This directory contains a no-cost, operator-run Python collector scaffold. It does **not** call an earthquake-data API. Its only permitted source pattern is a downloadable public catalog or a webpage that has passed a documented source review.

The script refuses to collect until `compliance_status` is set to `approved` by an operator. A valid review must capture the page/catalog URL, robots URL, terms URL, reviewer, review time, fetch interval, parser version, and a decision explaining why the collection method is permitted. Do not change the status merely because a `robots.txt` request returns 404.

The dashboard has the matching database, provenance, validation, deduplication, and Google Sheets tab design. Live Sheets writes require intentionally supplied Google credentials and remain disabled in the no-cost demonstration deployment.

`google_sheets_sink.py` creates the six required tabs, writes the raw-record header row, and upserts by `event_id`; it remains unavailable until the operator supplies `GOOGLE_APPLICATION_CREDENTIALS`. `train_models.py` builds complete chronological feature/label rows and evaluates Logistic Regression, Random Forest, and gradient boosting. Its standard run keeps M4+/24h, M5+/24h, M5+/7d, and M6+/7d targets separate. It reports held-out metrics and calibration bins, and refuses insufficient, class-diverse data rather than manufacturing an apparent score.
