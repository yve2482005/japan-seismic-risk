"""Authorized Google Sheets synchronization for approved, deduplicated records.

No credential is embedded here. An operator must supply a Google service-account
credential path through GOOGLE_APPLICATION_CREDENTIALS and grant that account
access to the selected spreadsheet. This integration is unrelated to earthquake
data acquisition and never calls an earthquake-data API.
"""

from __future__ import annotations

import json
import os
import time
from base64 import b64decode
from typing import Any, Iterable

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

REQUIRED_TABS = ("RAW_EARTHQUAKES", "USGS_LIVE_EARTHQUAKES", "ALERTS", "FEATURES", "TRAINING_DATA", "PREDICTIONS", "FORECAST_OUTCOMES", "MODEL_METRICS", "SYSTEM_LOG")
RAW_HEADERS = ("event_id", "source", "source_url", "origin_time_utc", "local_time_japan", "latitude", "longitude", "depth_km", "magnitude", "magnitude_type", "region", "prefecture", "nearest_city", "event_type", "collection_time", "data_quality", "duplicate_status", "training_eligible", "cross_source_duplicate_status", "raw_value", "normalized_value", "source_updated_epoch_ms")
TAB_HEADERS = {
    "RAW_EARTHQUAKES": RAW_HEADERS,
    "USGS_LIVE_EARTHQUAKES": RAW_HEADERS,
    "ALERTS": ("alert_id", "event_id", "alert_type", "severity", "threshold_magnitude", "event_magnitude", "region", "locality", "latitude", "longitude", "depth_km", "origin_time_utc", "source", "source_url", "reason", "detected_at", "delivery_status"),
    "FEATURES": ("event_id", "feature_as_of_utc", "region", "target_name", "features_json", "created_at"),
    "TRAINING_DATA": ("event_id", "target_name", "label", "feature_version", "dataset_version", "created_at"),
    "PREDICTIONS": ("prediction_id", "model_version", "region", "target_definition", "probability", "risk_level", "generated_at"),
    "FORECAST_OUTCOMES": ("outcome_id", "prediction_id", "model_version", "dataset_version", "region", "target_definition", "prediction_probability", "generated_at", "window_ends_at", "outcome_status", "actual_label", "matched_event_id", "closed_at"),
    "MODEL_METRICS": ("model_version", "algorithm", "target_definition", "dataset_version", "metrics_json", "calibration_json", "status", "trained_at"),
    "SYSTEM_LOG": ("timestamp_utc", "component", "severity", "message", "context_json"),
}
SCOPES = ("https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file")
RAW_APPEND_BATCH_SIZE = 400
SHEETS_MAX_ATTEMPTS = 4
SHEETS_RETRY_BASE_SECONDS = 1.0
TRANSIENT_SHEETS_STATUS_CODES = frozenset((429, 500, 502, 503, 504))


def _is_transient_sheets_error(error: HttpError) -> bool:
    return getattr(error.resp, "status", None) in TRANSIENT_SHEETS_STATUS_CODES


def execute_sheets_request(request: Any) -> Any:
    """Execute an idempotent Sheets request with bounded exponential backoff.

    This helper is intentionally restricted to idempotent reads and updates. Appends
    use reconciliation below because a 503 response can be returned after the server
    already committed an append.
    """
    for attempt in range(SHEETS_MAX_ATTEMPTS):
        try:
            return request.execute()
        except HttpError as error:
            if not _is_transient_sheets_error(error) or attempt == SHEETS_MAX_ATTEMPTS - 1:
                raise
            time.sleep(SHEETS_RETRY_BASE_SECONDS * (2 ** attempt))
    raise AssertionError("unreachable")


def append_rows_idempotently(service: Any, spreadsheet_id: str, tab: str, append_range: str, rows: list[list[Any]]) -> None:
    """Append rows once even when a transient error makes the first outcome unknown."""
    pending = list(rows)
    for attempt in range(SHEETS_MAX_ATTEMPTS):
        try:
            service.spreadsheets().values().append(
                spreadsheetId=spreadsheet_id,
                range=append_range,
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body={"values": pending},
            ).execute()
            return
        except HttpError as error:
            if not _is_transient_sheets_error(error) or attempt == SHEETS_MAX_ATTEMPTS - 1:
                raise
            current = execute_sheets_request(service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=f"{tab}!A2:A",
            )).get("values", [])
            existing_ids = {str(row[0]) for row in current if row and row[0]}
            pending = [row for row in pending if row and str(row[0]) not in existing_ids]
            if not pending:
                return
            time.sleep(SHEETS_RETRY_BASE_SECONDS * (2 ** attempt))


def service_account_info() -> dict[str, Any]:
    """Read a service-account secret without ever returning or logging its raw value.

    GitHub repository secrets can store either the raw JSON document or a base64
    encoding of that document. Supporting both avoids fragile copy/paste quoting
    while keeping the secret out of source control and workflow output.
    """
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is required before Sheets synchronization can be enabled.")
    candidates = [raw]
    try:
        candidates.append(b64decode(raw, validate=True).decode("utf-8"))
    except Exception:
        pass
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, str):
                parsed = json.loads(parsed)
            if isinstance(parsed, dict) and parsed.get("type") == "service_account" and parsed.get("client_email") and parsed.get("private_key"):
                return parsed
        except (json.JSONDecodeError, TypeError):
            continue
    raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON must contain raw service-account JSON or base64-encoded service-account JSON.")


def sheet_service() -> Any:
    credential_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON"):
        credentials = Credentials.from_service_account_info(service_account_info(), scopes=SCOPES)
    elif credential_path:
        credentials = Credentials.from_service_account_file(credential_path, scopes=SCOPES)
    else:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS is required before Sheets synchronization can be enabled.")
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def drive_service() -> Any:
    credential_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    credentials = Credentials.from_service_account_info(service_account_info(), scopes=SCOPES) if os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") else Credentials.from_service_account_file(credential_path, scopes=SCOPES)
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def create_or_prepare_spreadsheet(title: str, spreadsheet_id: str | None = None, share_email: str | None = None) -> str:
    service = sheet_service()
    if not spreadsheet_id:
        spreadsheet_id = service.spreadsheets().create(body={"properties": {"title": title}}).execute()["spreadsheetId"]
        if share_email:
            drive_service().permissions().create(fileId=spreadsheet_id, sendNotificationEmail=True, body={"type": "user", "role": "writer", "emailAddress": share_email}).execute()
    metadata = execute_sheets_request(service.spreadsheets().get(spreadsheetId=spreadsheet_id))
    existing = {sheet["properties"]["title"] for sheet in metadata["sheets"]}
    requests = [{"addSheet": {"properties": {"title": tab}}} for tab in REQUIRED_TABS if tab not in existing]
    if requests:
        execute_sheets_request(service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}))
    for tab, headers in TAB_HEADERS.items():
        execute_sheets_request(service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range=f"{tab}!A1", valueInputOption="RAW", body={"values": [list(headers)]}))
    return spreadsheet_id


def upsert_raw_records(spreadsheet_id: str, records: Iterable[dict[str, Any]], tab: str = "RAW_EARTHQUAKES") -> dict[str, int]:
    if tab not in {"RAW_EARTHQUAKES", "USGS_LIVE_EARTHQUAKES"}:
        raise ValueError(f"Unsupported raw-record tab: {tab}")
    service = sheet_service()
    current = execute_sheets_request(service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=f"{tab}!A2:V")).get("values", [])
    updated_index = RAW_HEADERS.index("source_updated_epoch_ms")
    index = {row[0]: (position + 2, int(float(row[updated_index])) if len(row) > updated_index and row[updated_index] else -1) for position, row in enumerate(current) if row}
    appended = updated = unchanged = 0
    append_rows: list[list[Any]] = []
    update_data: list[dict[str, Any]] = []
    for record in records:
        values = [record.get(header, "") for header in RAW_HEADERS]
        event_id = str(record["event_id"])
        incoming_updated = int(float(record.get("source_updated_epoch_ms") or 0))
        if event_id in index and index[event_id][1] >= incoming_updated:
            unchanged += 1
        elif event_id in index:
            row_number = index[event_id][0]
            update_data.append({"range": f"{tab}!A{row_number}:V{row_number}", "values": [values]})
            updated += 1
        else:
            append_rows.append(values)
            appended += 1
    if update_data:
        execute_sheets_request(service.spreadsheets().values().batchUpdate(spreadsheetId=spreadsheet_id, body={"valueInputOption": "RAW", "data": update_data}))
    for offset in range(0, len(append_rows), RAW_APPEND_BATCH_SIZE):
        batch = append_rows[offset:offset + RAW_APPEND_BATCH_SIZE]
        append_rows_idempotently(service, spreadsheet_id, tab, f"{tab}!A:V", batch)
        if offset + RAW_APPEND_BATCH_SIZE < len(append_rows):
            time.sleep(1.05)
    return {"appended": appended, "updated": updated, "unchanged": unchanged}


def read_tab_records(spreadsheet_id: str, tab: str) -> list[dict[str, str]]:
    values = execute_sheets_request(sheet_service().spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=f"{tab}!A:Z")).get("values", [])
    if not values:
        return []
    headers, rows = values[0], values[1:]
    return [{header: row[index] if index < len(row) else "" for index, header in enumerate(headers)} for row in rows if row and row[0]]


def replace_derived_tab(spreadsheet_id: str, tab: str, records: Iterable[dict[str, Any]]) -> int:
    if tab not in TAB_HEADERS:
        raise ValueError(f"Unsupported worksheet: {tab}")
    headers = TAB_HEADERS[tab]
    rows = [[record.get(header, "") for header in headers] for record in records]
    service = sheet_service()
    execute_sheets_request(service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range=f"{tab}!A2:Z"))
    if rows:
        execute_sheets_request(service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range=f"{tab}!A2", valueInputOption="RAW", body={"values": rows}))
    return len(rows)


def append_derived_records(spreadsheet_id: str, tab: str, records: Iterable[dict[str, Any]]) -> int:
    if tab not in TAB_HEADERS:
        raise ValueError(f"Unsupported worksheet: {tab}")
    headers = TAB_HEADERS[tab]
    rows = [[record.get(header, "") for header in headers] for record in records]
    if rows:
        append_rows_idempotently(sheet_service(), spreadsheet_id, tab, f"{tab}!A:Z", rows)
    return len(rows)


def append_unique_alert_records(spreadsheet_id: str, records: Iterable[dict[str, Any]]) -> dict[str, int]:
    """Append alert history once per deterministic alert ID without altering prior alert rows."""
    headers = TAB_HEADERS["ALERTS"]
    service = sheet_service()
    current = execute_sheets_request(service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="ALERTS!A:Z")).get("values", [])
    existing_ids = {row[0] for row in current[1:] if row and row[0]}
    rows = []
    skipped = 0
    for record in records:
        alert_id = str(record.get("alert_id") or "")
        if not alert_id or alert_id in existing_ids:
            skipped += 1
            continue
        existing_ids.add(alert_id)
        rows.append([record.get(header, "") for header in headers])
    for offset in range(0, len(rows), RAW_APPEND_BATCH_SIZE):
        batch = rows[offset:offset + RAW_APPEND_BATCH_SIZE]
        append_rows_idempotently(service, spreadsheet_id, "ALERTS", "ALERTS!A:Q", batch)
        if offset + RAW_APPEND_BATCH_SIZE < len(rows):
            time.sleep(1.05)
    return {"created": len(rows), "duplicates_skipped": skipped}


def append_unique_forecast_outcomes(spreadsheet_id: str, records: Iterable[dict[str, Any]]) -> dict[str, int]:
    """Append each closed production forecast outcome once, keyed by deterministic outcome_id."""
    headers = TAB_HEADERS["FORECAST_OUTCOMES"]
    service = sheet_service()
    current = execute_sheets_request(service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="FORECAST_OUTCOMES!A:Z")).get("values", [])
    existing_ids = {row[0] for row in current[1:] if row and row[0]}
    rows = []
    skipped = 0
    for record in records:
        outcome_id = str(record.get("outcome_id") or "")
        if not outcome_id or outcome_id in existing_ids:
            skipped += 1
            continue
        existing_ids.add(outcome_id)
        rows.append([record.get(header, "") for header in headers])
    for offset in range(0, len(rows), RAW_APPEND_BATCH_SIZE):
        batch = rows[offset:offset + RAW_APPEND_BATCH_SIZE]
        append_rows_idempotently(service, spreadsheet_id, "FORECAST_OUTCOMES", "FORECAST_OUTCOMES!A:M", batch)
        if offset + RAW_APPEND_BATCH_SIZE < len(rows):
            time.sleep(1.05)
    return {"created": len(rows), "duplicates_skipped": skipped}


def append_system_log(spreadsheet_id: str, component: str, severity: str, message: str, context: dict[str, Any]) -> None:
    sheet_service().spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="SYSTEM_LOG!A:E", valueInputOption="RAW", insertDataOption="INSERT_ROWS", body={"values": [[__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), component, severity, message, json.dumps(context, ensure_ascii=False)]]}).execute()
