"""Locally run live collector for the approved USGS public monthly CSV download.

This process is intentionally not an earthquake-data API client. It downloads one
documented public CSV feed at a conservative interval, validates and deduplicates
Japan-area rows locally, then synchronizes attributed rows to Google Sheets.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import logging
import math
import sqlite3
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

import requests

try:
    from .google_sheets_sink import append_system_log, create_or_prepare_spreadsheet, upsert_raw_records
except ImportError:
    from google_sheets_sink import append_system_log, create_or_prepare_spreadsheet, upsert_raw_records

USGS_CSV_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv"
USGS_TERMS_URL = "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits"
JAPAN_BOUNDS = {"min_latitude": 20.0, "max_latitude": 50.0, "min_longitude": 120.0, "max_longitude": 155.0}
MINIMUM_INTERVAL_SECONDS = 3600
USER_AGENT = "JapanSeismicMonitor/1.0 (+local-compliance-gated-collector)"


@dataclass(frozen=True)
class LiveRecord:
    event_id: str
    source: str
    source_url: str
    origin_time_utc: str
    local_time_japan: str
    latitude: float
    longitude: float
    depth_km: float | None
    magnitude: float | None
    magnitude_type: str
    region: str
    prefecture: str
    nearest_city: str
    event_type: str
    collection_time: str
    data_quality: str
    duplicate_status: str
    raw_value: dict[str, Any]
    normalized_value: dict[str, Any]
    updated_epoch_ms: int


def require_number(value: str | None, name: str, lower: float, upper: float) -> float:
    try:
        number = float(value or "")
    except ValueError as error:
        raise ValueError(f"INVALID_{name.upper()}") from error
    if not math.isfinite(number) or number < lower or number > upper:
        raise ValueError(f"INVALID_{name.upper()}")
    return number


def classify_region(latitude: float, longitude: float) -> str:
    boxes = [
        ("Hokkaido", 41, 46, 139, 146), ("Tohoku", 37, 41.5, 139, 143.5),
        ("Kanto", 34.5, 37.5, 138.5, 142.5), ("Chubu", 34.5, 38.5, 136, 139.5),
        ("Kansai", 33, 35.5, 134, 136.5), ("Chugoku", 33, 36.5, 130.5, 134.5),
        ("Shikoku", 32.5, 34.8, 132.5, 135.5), ("Kyushu", 30, 34.5, 128, 132.5),
        ("Okinawa", 23, 28.5, 122, 131.5),
    ]
    for name, min_lat, max_lat, min_lon, max_lon in boxes:
        if min_lat <= latitude <= max_lat and min_lon <= longitude <= max_lon:
            return name
    return "Outside configured regions"


def is_japan_monitoring_area(latitude: float, longitude: float) -> bool:
    return JAPAN_BOUNDS["min_latitude"] <= latitude <= JAPAN_BOUNDS["max_latitude"] and JAPAN_BOUNDS["min_longitude"] <= longitude <= JAPAN_BOUNDS["max_longitude"]


def parse_usgs_timestamp(value: str | None, field_name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"INVALID_{field_name.upper()}_TIMESTAMP") from error
    if parsed.tzinfo is None:
        raise ValueError(f"INVALID_{field_name.upper()}_TIMESTAMP")
    return parsed.astimezone(timezone.utc)


def normalize_usgs_row(row: dict[str, str], collected_at: datetime) -> LiveRecord:
    latitude = require_number(row.get("latitude"), "latitude", -90, 90)
    longitude = require_number(row.get("longitude"), "longitude", -180, 180)
    if not is_japan_monitoring_area(latitude, longitude):
        raise ValueError("OUTSIDE_JAPAN_MONITORING_ENVELOPE")
    origin = parse_usgs_timestamp(row.get("time"), "origin")
    magnitude = None if not row.get("mag") else require_number(row.get("mag"), "magnitude", -2, 10)
    # USGS may report a small negative depth when the solved hypocenter is above
    # the reference datum; preserve this source-valid value rather than rejecting
    # every otherwise valid Japan-envelope event.
    depth = require_number(row.get("depth"), "depth", -20, 750)
    updated_at = parse_usgs_timestamp(row.get("updated"), "updated")
    event_id = row.get("id") or hashlib.sha256(json.dumps(row, sort_keys=True).encode("utf-8")).hexdigest()[:24]
    collection_time = collected_at.isoformat()
    local_time = origin.astimezone(ZoneInfo("Asia/Tokyo")).isoformat()
    normalized = {"origin_time_utc": origin.astimezone(timezone.utc).isoformat(), "latitude": latitude, "longitude": longitude, "depth_km": depth, "magnitude": magnitude}
    return LiveRecord(
        event_id=event_id, source="U.S. Geological Survey (USGS), ANSS ComCat", source_url=row.get("url") or USGS_CSV_URL,
        origin_time_utc=normalized["origin_time_utc"], local_time_japan=local_time, latitude=latitude, longitude=longitude,
        depth_km=depth, magnitude=magnitude, magnitude_type=row.get("magType") or "", region=classify_region(latitude, longitude),
        prefecture="", nearest_city=row.get("place") or "", event_type=row.get("type") or "earthquake", collection_time=collection_time,
        data_quality="validated", duplicate_status="accepted", raw_value=row, normalized_value=normalized,
        updated_epoch_ms=int(updated_at.timestamp() * 1000),
    )


class StateStore:
    def __init__(self, path: Path):
        self.connection = sqlite3.connect(path)
        self.connection.execute("CREATE TABLE IF NOT EXISTS seen_events (event_id TEXT PRIMARY KEY, updated_epoch_ms INTEGER NOT NULL)")
        self.connection.execute("CREATE TABLE IF NOT EXISTS collection_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        self.connection.commit()

    def may_collect(self, interval_seconds: int) -> bool:
        row = self.connection.execute("SELECT value FROM collection_state WHERE key = 'last_fetch_epoch'").fetchone()
        return not row or time.time() - float(row[0]) >= interval_seconds

    def mark_fetch(self) -> None:
        self.connection.execute("INSERT INTO collection_state(key, value) VALUES ('last_fetch_epoch', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(time.time()),))
        self.connection.commit()

    def accept_or_update(self, record: LiveRecord) -> str:
        row = self.connection.execute("SELECT updated_epoch_ms FROM seen_events WHERE event_id = ?", (record.event_id,)).fetchone()
        if row and row[0] >= record.updated_epoch_ms:
            return "duplicate"
        self.connection.execute("INSERT INTO seen_events(event_id, updated_epoch_ms) VALUES (?, ?) ON CONFLICT(event_id) DO UPDATE SET updated_epoch_ms=excluded.updated_epoch_ms", (record.event_id, record.updated_epoch_ms))
        self.connection.commit()
        return "updated" if row else "accepted"


def download_csv(timeout_seconds: int = 20) -> str:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = requests.get(USGS_CSV_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/csv"}, timeout=timeout_seconds)
            response.raise_for_status()
            return response.text
        except requests.RequestException as error:
            last_error = error
            time.sleep(min(2**attempt, 4))
    raise RuntimeError(f"USGS CSV download failed after bounded retries: {last_error}")


def process_once(state: StateStore, spreadsheet_id: str | None, share_email: str | None, force: bool = False) -> dict[str, Any]:
    if not force and not state.may_collect(MINIMUM_INTERVAL_SECONDS):
        return {"status": "skipped", "reason": "conservative interval has not elapsed"}
    spreadsheet_id = create_or_prepare_spreadsheet("Japan Seismic Monitor — Live Dataset", spreadsheet_id, share_email)
    collected_at = datetime.now(timezone.utc)
    raw_csv = download_csv()
    state.mark_fetch()
    accepted: list[dict[str, Any]] = []
    invalid = duplicates = total = 0
    for row in csv.DictReader(io.StringIO(raw_csv)):
        total += 1
        try:
            record = normalize_usgs_row(row, collected_at)
        except ValueError as error:
            if str(error) != "OUTSIDE_JAPAN_MONITORING_ENVELOPE":
                invalid += 1
            continue
        status = state.accept_or_update(record)
        if status == "duplicate":
            duplicates += 1
            continue
        item = asdict(record)
        item["duplicate_status"] = "accepted" if status == "accepted" else "updated"
        item["raw_value"] = json.dumps(item["raw_value"], ensure_ascii=False)
        item["normalized_value"] = json.dumps(item["normalized_value"], ensure_ascii=False)
        accepted.append(item)
    sheet_result = upsert_raw_records(spreadsheet_id, accepted)
    result = {"status": "succeeded", "source": "USGS ComCat public CSV", "source_url": USGS_CSV_URL, "spreadsheet_id": spreadsheet_id, "records_in_feed": total, "records_accepted_or_updated": len(accepted), "duplicates_rejected": duplicates, "invalid_rejected": invalid, **sheet_result, "completed_at": datetime.now(timezone.utc).isoformat()}
    append_system_log(spreadsheet_id, "collection", "info", "USGS public CSV collection succeeded", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the compliant local USGS public CSV collector.")
    parser.add_argument("--state-db", type=Path, default=Path("live_collector_state.sqlite3"))
    parser.add_argument("--spreadsheet-id", default=None)
    parser.add_argument("--share-email", default=None)
    parser.add_argument("--force", action="store_true", help="Bypass only the local one-hour interval; use for initial setup or manual recovery.")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    result = process_once(StateStore(args.state_db), args.spreadsheet_id, args.share_email, args.force)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
