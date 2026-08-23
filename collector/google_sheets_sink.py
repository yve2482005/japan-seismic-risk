"""Authorized Google Sheets synchronization for approved, deduplicated records.

No credential is embedded here. An operator must supply a Google service-account
credential path through GOOGLE_APPLICATION_CREDENTIALS and grant that account
access to the selected spreadsheet. This integration is unrelated to earthquake
data acquisition and never calls an earthquake-data API.
"""

from __future__ import annotations

import json
import os
from typing import Any, Iterable

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

REQUIRED_TABS = ("RAW_EARTHQUAKES", "FEATURES", "TRAINING_DATA", "PREDICTIONS", "MODEL_METRICS", "SYSTEM_LOG")
RAW_HEADERS = ("event_id", "source", "source_url", "origin_time_utc", "local_time_japan", "latitude", "longitude", "depth_km", "magnitude", "magnitude_type", "region", "prefecture", "nearest_city", "event_type", "collection_time", "data_quality", "duplicate_status", "raw_value", "normalized_value", "source_updated_epoch_ms")
TAB_HEADERS = {
    "RAW_EARTHQUAKES": RAW_HEADERS,
    "FEATURES": ("event_id", "feature_as_of_utc", "region", "target_name", "features_json", "created_at"),
    "TRAINING_DATA": ("event_id", "target_name", "label", "feature_version", "dataset_version", "created_at"),
    "PREDICTIONS": ("prediction_id", "model_version", "region", "target_definition", "probability", "risk_level", "generated_at"),
    "MODEL_METRICS": ("model_version", "algorithm", "target_definition", "dataset_version", "metrics_json", "calibration_json", "status", "trained_at"),
    "SYSTEM_LOG": ("timestamp_utc", "component", "severity", "message", "context_json"),
}
SCOPES = ("https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file")


def sheet_service() -> Any:
    credential_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    credential_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if credential_json:
        credentials = Credentials.from_service_account_info(json.loads(credential_json), scopes=SCOPES)
    elif credential_path:
        credentials = Credentials.from_service_account_file(credential_path, scopes=SCOPES)
    else:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS is required before Sheets synchronization can be enabled.")
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def drive_service() -> Any:
    credential_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    credential_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    credentials = Credentials.from_service_account_info(json.loads(credential_json), scopes=SCOPES) if credential_json else Credentials.from_service_account_file(credential_path, scopes=SCOPES)
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def create_or_prepare_spreadsheet(title: str, spreadsheet_id: str | None = None, share_email: str | None = None) -> str:
    service = sheet_service()
    if not spreadsheet_id:
        spreadsheet_id = service.spreadsheets().create(body={"properties": {"title": title}}).execute()["spreadsheetId"]
        if share_email:
            drive_service().permissions().create(fileId=spreadsheet_id, sendNotificationEmail=True, body={"type": "user", "role": "writer", "emailAddress": share_email}).execute()
    metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    existing = {sheet["properties"]["title"] for sheet in metadata["sheets"]}
    requests = [{"addSheet": {"properties": {"title": tab}}} for tab in REQUIRED_TABS if tab not in existing]
    if requests:
        service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute()
    for tab, headers in TAB_HEADERS.items():
        service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range=f"{tab}!A1", valueInputOption="RAW", body={"values": [list(headers)]}).execute()
    return spreadsheet_id


def upsert_raw_records(spreadsheet_id: str, records: Iterable[dict[str, Any]]) -> dict[str, int]:
    service = sheet_service()
    current = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="RAW_EARTHQUAKES!A2:T").execute().get("values", [])
    index = {row[0]: (position + 2, int(float(row[19])) if len(row) > 19 and row[19] else -1) for position, row in enumerate(current) if row}
    appended = updated = unchanged = 0
    for record in records:
        values = [[record.get(header, "") for header in RAW_HEADERS]]
        event_id = str(record["event_id"])
        incoming_updated = int(float(record.get("source_updated_epoch_ms") or 0))
        if event_id in index and index[event_id][1] >= incoming_updated:
            unchanged += 1
        elif event_id in index:
            row_number = index[event_id][0]
            service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range=f"RAW_EARTHQUAKES!A{row_number}:T{row_number}", valueInputOption="RAW", body={"values": values}).execute()
            updated += 1
        else:
            service.spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="RAW_EARTHQUAKES!A:T", valueInputOption="RAW", insertDataOption="INSERT_ROWS", body={"values": values}).execute()
            appended += 1
    return {"appended": appended, "updated": updated, "unchanged": unchanged}


def read_tab_records(spreadsheet_id: str, tab: str) -> list[dict[str, str]]:
    values = sheet_service().spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=f"{tab}!A:Z").execute().get("values", [])
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
    service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range=f"{tab}!A2:Z").execute()
    if rows:
        service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range=f"{tab}!A2", valueInputOption="RAW", body={"values": rows}).execute()
    return len(rows)


def append_system_log(spreadsheet_id: str, component: str, severity: str, message: str, context: dict[str, Any]) -> None:
    sheet_service().spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="SYSTEM_LOG!A:E", valueInputOption="RAW", insertDataOption="INSERT_ROWS", body={"values": [[__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), component, severity, message, json.dumps(context, ensure_ascii=False)]]}).execute()
