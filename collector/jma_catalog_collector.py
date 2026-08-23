"""Compliance-gated collector scaffold for approved public catalog downloads.

This script intentionally refuses to fetch a source until an operator records
that the source's terms and robots directives permit the configured action.
It contains no earthquake-data API client and must be run on an operator-owned
Python environment, not in this dashboard's Node deployment.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup


@dataclass(frozen=True)
class SourceConfig:
    name: str
    catalog_url: str
    terms_url: str
    robots_url: str
    compliance_status: str
    rate_limit_seconds: int = 60
    timeout_seconds: int = 20
    parser_version: str = "1.0.0"


@dataclass(frozen=True)
class RawRecord:
    event_id: str
    source: str
    source_url: str
    origin_time_utc: str | None
    latitude: float | None
    longitude: float | None
    depth_km: float | None
    magnitude: float | None
    collection_time: str
    parser_version: str
    raw_value: dict


class ComplianceError(RuntimeError):
    pass


def assert_compliant(config: SourceConfig) -> None:
    if config.compliance_status != "approved":
        raise ComplianceError("Collection is disabled until a human records an approved source compliance review.")
    if config.rate_limit_seconds < 30:
        raise ComplianceError("A minimum 30-second source-specific fetch interval is required.")


def fetch_catalog(config: SourceConfig, session: requests.Session | None = None) -> str:
    """Fetch a single approved downloadable catalog with bounded retries."""
    assert_compliant(config)
    client = session or requests.Session()
    headers = {"User-Agent": "JapanSeismicMonitor/1.0 (compliance-gated catalog collector)"}
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = client.get(config.catalog_url, headers=headers, timeout=config.timeout_seconds)
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(min(2 ** attempt, 4))
    raise RuntimeError(f"Catalog request failed after bounded retries: {last_error}")


def stable_event_id(source: str, origin: str | None, latitude: float | None, longitude: float | None, magnitude: float | None) -> str:
    normalized = f"{source}|{origin}|{latitude}|{longitude}|{magnitude}".encode("utf-8")
    return f"{source.lower().replace(' ', '-')}-{hashlib.sha256(normalized).hexdigest()[:20]}"


def parse_html_table(html: str, config: SourceConfig) -> Iterable[RawRecord]:
    """Example parser adapter; replace selectors only after source review and parser tests."""
    soup = BeautifulSoup(html, "html.parser")
    collected_at = datetime.now(timezone.utc).isoformat()
    for row in soup.select("table[data-earthquake-catalog] tbody tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.select("td")]
        if len(cells) < 5:
            logging.warning("Skipping malformed catalog row")
            continue
        origin, latitude_text, longitude_text, depth_text, magnitude_text = cells[:5]
        try:
            latitude, longitude = float(latitude_text), float(longitude_text)
            depth_km, magnitude = float(depth_text), float(magnitude_text)
        except ValueError:
            logging.warning("Skipping non-numeric catalog row: %s", cells)
            continue
        yield RawRecord(
            event_id=stable_event_id(config.name, origin, latitude, longitude, magnitude),
            source=config.name,
            source_url=config.catalog_url,
            origin_time_utc=origin,
            latitude=latitude,
            longitude=longitude,
            depth_km=depth_km,
            magnitude=magnitude,
            collection_time=collected_at,
            parser_version=config.parser_version,
            raw_value={"cells": cells},
        )


def write_staging_json(records: Iterable[RawRecord], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps([asdict(record) for record in records], ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    logging.info("This is an operator-run, compliance-gated collector scaffold. Configure an approved downloadable catalog before executing.")
