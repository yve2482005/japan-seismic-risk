"""Authorized Google Sheets synchronization for approved, deduplicated records.

No credential is embedded here. An operator must supply a Google service-account
credential path through GOOGLE_APPLICATION_CREDENTIALS and grant that account
access to the selected spreadsheet. This integration is unrelated to earthquake
data acquisition and never calls an earthquake-data API.
"""

from __future__ import annotations

import os
from typing import Any, Iterable

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

REQUIRED_TABS = ("RAW_EARTHQUAKES", "FEATURES", "TRAINING_DATA", "PREDICTIONS", "MODEL_METRICS", "SYSTEM_LOG")
RAW_HEADERS = ("event_id", "source", "source_url", "origin_time_utc", "local_time_japan", "latitude", "longitude", "depth_km", "magnitude", "magnitude_type", "region", "prefecture", "nearest_city", "event_type", "collection_time", "data_quality", "duplicate_status")
SCOPES = ("https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file")


def sheet_service() -> Any:
    credential_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not credential_path:
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS is required before Sheets synchronization can be enabled.")
    credentials = Credentials.from_service_account_file(credential_path, scopes=SCOPES)
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def create_or_prepare_spreadsheet(title: str, spreadsheet_id: str | None = None) -> str:
    service = sheet_service()
    if not spreadsheet_id:
        spreadsheet_id = service.spreadsheets().create(body={"properties": {"title": title}}).execute()["spreadsheetId"]
    metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    existing = {sheet["properties"]["title"] for sheet in metadata["sheets"]}
    requests = [{"addSheet": {"properties": {"title": tab}}} for tab in REQUIRED_TABS if tab not in existing]
    if requests:
        service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute()
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range="RAW_EARTHQUAKES!A1:Q1",
        valueInputOption="RAW",
        body={"values": [list(RAW_HEADERS)]},
    ).execute()
    return spreadsheet_id


def upsert_raw_records(spreadsheet_id: str, records: Iterable[dict[str, Any]]) -> dict[str, int]:
    service = sheet_service()
    current = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="RAW_EARTHQUAKES!A2:A").execute().get("values", [])
    index = {row[0]: position + 2 for position, row in enumerate(current) if row}
    appended = updated = 0
    for record in records:
        values = [[record.get(header, "") for header in RAW_HEADERS]]
        event_id = str(record["event_id"])
        if event_id in index:
            service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range=f"RAW_EARTHQUAKES!A{index[event_id]}:Q{index[event_id]}", valueInputOption="RAW", body={"values": values}).execute()
            updated += 1
        else:
            service.spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="RAW_EARTHQUAKES!A:Q", valueInputOption="RAW", insertDataOption="INSERT_ROWS", body={"values": values}).execute()
            appended += 1
    return {"appended": appended, "updated": updated}
