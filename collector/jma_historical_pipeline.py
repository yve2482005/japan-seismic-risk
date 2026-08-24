"""Parser for the approved static JMA Seismological Bulletin ZIP archive.

This adapter is deliberately limited to the documented historical ZIP artifacts.
It never requests the current JMA list JSON endpoint or any earthquake API.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import re
import time
import zipfile
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import requests

try:
    from .live_usgs_pipeline import USER_AGENT, classify_region, is_japan_monitoring_area
except ImportError:
    from live_usgs_pipeline import USER_AGENT, classify_region, is_japan_monitoring_area

JMA_BULLETIN_PAGE_URL = "https://www.data.jma.go.jp/eqev/data/bulletin/eqdoc_e.html"
JMA_ARCHIVE_URL_TEMPLATE = "https://www.data.jma.go.jp/eqev/data/bulletin/catalog/table2/h{year}{month:02d}t.zip"
JMA_SOURCE = "Japan Meteorological Agency (JMA) Seismological Bulletin"
JMA_ATTRIBUTION = "Source: Japan Meteorological Agency, The Seismological Bulletin of Japan"
JMA_MODEL_MAGNITUDE_MINIMUM = 2.5
JMA_BACKFILL_MONTHS = ((2023, 9), (2023, 10), (2023, 11), (2023, 12))
_MAGNITUDE = re.compile(r"^(-?\d+(?:\.\d+)?)")


def archive_url(year: int, month: int) -> str:
    return JMA_ARCHIVE_URL_TEMPLATE.format(year=year, month=month)


def download_archive(year: int, month: int, timeout_seconds: int = 30) -> bytes:
    url = archive_url(year, month)
    error: Exception | None = None
    for attempt in range(3):
        try:
            response = requests.get(url, headers={"User-Agent": USER_AGENT, "Accept": "application/zip"}, timeout=timeout_seconds)
            response.raise_for_status()
            if not response.content.startswith(b"PK"):
                raise ValueError("JMA archive was not a ZIP artifact")
            return response.content
        except (requests.RequestException, ValueError) as caught:
            error = caught
            time.sleep(min(2**attempt, 4))
    raise RuntimeError(f"JMA historical ZIP download failed after bounded retries: {error}")


def _as_number(value: str, name: str, lower: float, upper: float) -> float:
    try:
        parsed = float(value)
    except ValueError as error:
        raise ValueError(f"INVALID_JMA_{name}") from error
    if not math.isfinite(parsed) or not lower <= parsed <= upper:
        raise ValueError(f"INVALID_JMA_{name}")
    return parsed


def _magnitude(value: str) -> float:
    match = _MAGNITUDE.match(value)
    if not match:
        raise ValueError("INVALID_JMA_MAGNITUDE")
    return _as_number(match.group(1), "MAGNITUDE", -2, 10)


def parse_archive(year: int, month: int, payload: bytes, collected_at: datetime) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Normalize a static JMA monthly bulletin while retaining every original line."""
    source_url = archive_url(year, month)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        members = [member for member in archive.infolist() if member.filename.lower().endswith(".txt") and not member.is_dir()]
        if len(members) != 1 or members[0].file_size > 10_000_000:
            raise ValueError("Unexpected JMA archive member layout")
        text = archive.read(members[0]).decode("utf-8", errors="strict")
    records: list[dict[str, Any]] = []
    failures = {"header_lines": 0, "invalid_rows": 0, "outside_envelope": 0, "within_source_duplicates": 0}
    current_day: int | None = None
    source_local_ids: set[str] = set()
    for line_number, line in enumerate(text.splitlines(), start=1):
        if line_number <= 3:
            failures["header_lines"] += 1
            continue
        day_field = line[:4].strip()
        if day_field:
            try:
                current_day = int(day_field)
            except ValueError:
                failures["invalid_rows"] += 1
                continue
        if current_day is None:
            failures["invalid_rows"] += 1
            continue
        values = line[4:].split()
        if len(values) < 13:
            failures["invalid_rows"] += 1
            continue
        try:
            hour, minute = int(values[0]), int(values[1])
            second = _as_number(values[2], "SECOND", 0, 59.999)
            latitude = _as_number(values[4], "LAT_DEG", -90, 90) + _as_number(values[5], "LAT_MIN", 0, 59.999) / 60
            longitude = _as_number(values[7], "LON_DEG", -180, 180) + _as_number(values[8], "LON_MIN", 0, 59.999) / 60
            depth = _as_number(values[10], "DEPTH", 0, 750)
            magnitude = _magnitude(values[12])
            if not is_japan_monitoring_area(latitude, longitude):
                failures["outside_envelope"] += 1
                continue
            origin_jst = datetime(year, month, current_day, hour, minute, int(second), int((second % 1) * 1_000_000), tzinfo=ZoneInfo("Asia/Tokyo"))
        except (ValueError, OverflowError):
            failures["invalid_rows"] += 1
            continue
        line_hash = hashlib.sha256(f"{year:04d}-{month:02d}-{current_day:02d}|{line}".encode("utf-8")).hexdigest()[:24]
        event_id = f"jma-bulletin-{year:04d}{month:02d}-{line_hash}"
        if event_id in source_local_ids:
            failures["within_source_duplicates"] += 1
            continue
        source_local_ids.add(event_id)
        origin_utc = origin_jst.astimezone(timezone.utc)
        raw = {"archive_period": f"{year:04d}-{month:02d}", "archive_url": source_url, "archive_member": f"h{year:04d}{month:02d}.txt", "line_number": line_number, "line": line, "attribution": JMA_ATTRIBUTION}
        normalized = {"origin_time_utc": origin_utc.isoformat(), "latitude": latitude, "longitude": longitude, "depth_km": depth, "magnitude": magnitude, "source_archive_period": raw["archive_period"]}
        records.append({"event_id": event_id, "source": JMA_SOURCE, "source_url": source_url, "origin_time_utc": origin_utc.isoformat(), "local_time_japan": origin_jst.isoformat(), "latitude": latitude, "longitude": longitude, "depth_km": depth, "magnitude": magnitude, "magnitude_type": "JMA bulletin", "region": classify_region(latitude, longitude), "prefecture": "", "nearest_city": "", "event_type": "earthquake", "collection_time": collected_at.isoformat(), "data_quality": "validated", "duplicate_status": "accepted", "training_eligible": "yes" if magnitude >= JMA_MODEL_MAGNITUDE_MINIMUM else "no", "cross_source_duplicate_status": "not_checked", "raw_value": json.dumps(raw, ensure_ascii=False), "normalized_value": json.dumps(normalized, ensure_ascii=False), "source_updated_epoch_ms": int(origin_utc.timestamp() * 1000)})
    return records, failures
