"""Stateless GitHub Actions runner for the approved USGS public CSV pipeline.

All durable records, deduplication state, derived datasets, run logs, and model
reports live in the approved Google Sheet. This file deliberately contains no
credentials and makes no earthquake API request.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

try:
    from .google_sheets_sink import append_derived_records, append_system_log, create_or_prepare_spreadsheet, read_tab_records, replace_derived_tab, upsert_raw_records
    from .live_usgs_pipeline import USGS_CSV_URL, download_csv, normalize_usgs_row
    from .train_models import FEATURE_NAMES, STANDARD_TARGETS, build_dataset, parse_time, train
except ImportError:
    from google_sheets_sink import append_derived_records, append_system_log, create_or_prepare_spreadsheet, read_tab_records, replace_derived_tab, upsert_raw_records
    from live_usgs_pipeline import USGS_CSV_URL, download_csv, normalize_usgs_row
    from train_models import FEATURE_NAMES, STANDARD_TARGETS, build_dataset, parse_time, train

MIN_TRAINING_RECORDS = 500
MIN_HISTORY_DAYS = 90
MIN_POSITIVE_LABELS = 12
MAX_EXPECTED_CALIBRATION_ERROR = 0.20
MAX_BRIER_SCORE = 0.25


def require_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} must be provided through an encrypted GitHub Actions repository secret.")
    return value


def collect(spreadsheet_id: str) -> dict[str, Any]:
    collected_at = datetime.now(timezone.utc)
    normalized: list[dict[str, Any]] = []
    invalid = outside_japan = 0
    for row in csv.DictReader(io.StringIO(download_csv())):
        try:
            item = normalize_usgs_row(row, collected_at)
        except ValueError as error:
            if str(error) == "OUTSIDE_JAPAN_MONITORING_ENVELOPE":
                outside_japan += 1
            else:
                invalid += 1
            continue
        record = item.__dict__.copy()
        record["raw_value"] = json.dumps(record["raw_value"], ensure_ascii=False)
        record["normalized_value"] = json.dumps(record["normalized_value"], ensure_ascii=False)
        record["source_updated_epoch_ms"] = item.updated_epoch_ms
        normalized.append(record)
    outcome = upsert_raw_records(spreadsheet_id, normalized)
    result = {"source": "USGS public monthly CSV", "source_url": USGS_CSV_URL, "rows_in_japan_envelope": len(normalized), "invalid_rejected": invalid, "outside_envelope": outside_japan, **outcome, "completed_at": datetime.now(timezone.utc).isoformat()}
    append_system_log(spreadsheet_id, "collector", "info", "USGS public CSV collection completed", result)
    return result


def normalized_records(spreadsheet_id: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row in read_tab_records(spreadsheet_id, "RAW_EARTHQUAKES"):
        if row.get("data_quality") != "validated" or row.get("duplicate_status") not in {"accepted", "updated"}:
            continue
        try:
            records.append({"event_id": row["event_id"], "origin_time_utc": row["origin_time_utc"], "latitude": float(row["latitude"]), "longitude": float(row["longitude"]), "depth_km": float(row["depth_km"]) if row.get("depth_km") else None, "magnitude": float(row["magnitude"]) if row.get("magnitude") else None, "region": row["region"]})
        except (KeyError, ValueError):
            continue
    return sorted(records, key=lambda record: parse_time(record["origin_time_utc"]))


def materialize_features(spreadsheet_id: str, records: list[dict[str, Any]]) -> dict[str, int]:
    if not records:
        return {"features": 0, "training_rows": 0}
    features, labels = build_dataset(records, STANDARD_TARGETS[0])
    now = datetime.now(timezone.utc).isoformat()
    feature_rows = []
    training_rows = []
    for record, values, label in zip(records, features.tolist(), labels.tolist(), strict=True):
        safe_features = {name: None if not np.isfinite(value) else float(value) for name, value in zip(FEATURE_NAMES, values, strict=True)}
        feature_rows.append({"event_id": record["event_id"], "feature_as_of_utc": record["origin_time_utc"], "region": record["region"], "target_name": "M4_NEXT_24H_REGION", "features_json": json.dumps(safe_features), "created_at": now})
        training_rows.append({"event_id": record["event_id"], "target_name": "M4_NEXT_24H_REGION", "label": int(label), "feature_version": "chronological-v1", "dataset_version": "live-sheet-v1", "created_at": now})
    return {"features": replace_derived_tab(spreadsheet_id, "FEATURES", feature_rows), "training_rows": replace_derived_tab(spreadsheet_id, "TRAINING_DATA", training_rows)}


def quality_gate(records: list[dict[str, Any]]) -> tuple[bool, dict[str, Any]]:
    if not records:
        return False, {"reason": "no validated records"}
    history_days = (parse_time(records[-1]["origin_time_utc"]) - parse_time(records[0]["origin_time_utc"])).total_seconds() / 86400
    labels = build_dataset(records, STANDARD_TARGETS[0])[1]
    positives = int(labels.sum())
    passed = len(records) >= MIN_TRAINING_RECORDS and history_days >= MIN_HISTORY_DAYS and positives >= MIN_POSITIVE_LABELS
    return passed, {"records": len(records), "history_days": round(history_days, 2), "positive_labels": positives, "minimum_records": MIN_TRAINING_RECORDS, "minimum_history_days": MIN_HISTORY_DAYS, "minimum_positive_labels": MIN_POSITIVE_LABELS}


def select_production_candidate(rows: list[dict[str, Any]]) -> int | None:
    """Select one candidate only when calibration and held-out uncertainty checks pass."""
    eligible: list[tuple[int, float]] = []
    for index, row in enumerate(rows):
        metrics = json.loads(row["metrics_json"])
        calibration = metrics.get("calibration", {})
        pr_auc = metrics.get("pr_auc")
        brier = metrics.get("brier_score")
        ece = calibration.get("expected_calibration_error")
        if isinstance(pr_auc, (int, float)) and isinstance(brier, (int, float)) and isinstance(ece, (int, float)) and brier <= MAX_BRIER_SCORE and ece <= MAX_EXPECTED_CALIBRATION_ERROR:
            eligible.append((index, float(pr_auc)))
    return max(eligible, key=lambda item: item[1])[0] if eligible else None


def train_if_ready(spreadsheet_id: str, records: list[dict[str, Any]]) -> dict[str, Any]:
    passed, gate = quality_gate(records)
    if not passed:
        append_system_log(spreadsheet_id, "training", "info", "Training deferred: quality gate not met", gate)
        return {"status": "deferred_quality_gate", **gate}
    input_path = Path("/tmp/validated_live_records.json")
    input_path.write_text(json.dumps(records), encoding="utf-8")
    rows = []
    deferred_targets: list[str] = []
    for target in STANDARD_TARGETS:
        target_name = f"M{target.magnitude_threshold:g}_NEXT_{target.horizon_hours}H"
        output_path = Path(f"/tmp/{target_name}.json")
        try:
            train(input_path, output_path, target)
        except ValueError:
            deferred_targets.append(target_name)
            continue
        report = json.loads(output_path.read_text(encoding="utf-8"))
        for algorithm, result in report["models"].items():
            test = result["test"]
            rows.append({"model_version": f"{algorithm}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}", "algorithm": algorithm, "target_definition": target_name, "dataset_version": "live-sheet-v1", "metrics_json": json.dumps(test), "calibration_json": json.dumps(test["calibration"]), "status": "candidate", "trained_at": report["generated_at"]})
    if not rows:
        result = {"status": "deferred_class_diversity", "deferred_targets": deferred_targets, **gate}
        append_system_log(spreadsheet_id, "training", "info", "Training deferred: no target had sufficient chronological class diversity", result)
        return result
    promoted = 0
    by_target: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_target.setdefault(row["target_definition"], []).append(row)
    for target_rows in by_target.values():
        selected_index = select_production_candidate(target_rows)
        if selected_index is not None:
            target_rows[selected_index]["status"] = "production"
            promoted += 1
    append_derived_records(spreadsheet_id, "MODEL_METRICS", rows)
    result = {"status": "production_models_promoted" if promoted else "candidate_reports_generated", "reports": len(rows), "promoted_models": promoted, "deferred_targets": deferred_targets, "promotion_thresholds": {"max_brier_score": MAX_BRIER_SCORE, "max_expected_calibration_error": MAX_EXPECTED_CALIBRATION_ERROR}, **gate}
    append_system_log(spreadsheet_id, "training", "info", "Chronological candidate reports evaluated for promotion", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("collect", "train", "all"), default="all")
    parser.add_argument("--spreadsheet-id", default=None)
    args = parser.parse_args()
    spreadsheet_id = args.spreadsheet_id or require_environment("GOOGLE_SHEETS_SPREADSHEET_ID")
    create_or_prepare_spreadsheet("Japan Seismic Monitor — Live Dataset", spreadsheet_id)
    output: dict[str, Any] = {"mode": args.mode, "spreadsheet_id": spreadsheet_id}
    if args.mode in {"collect", "all"}:
        output["collection"] = collect(spreadsheet_id)
    if args.mode in {"train", "all"}:
        records = normalized_records(spreadsheet_id)
        output["derived"] = materialize_features(spreadsheet_id, records)
        output["training"] = train_if_ready(spreadsheet_id, records)
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
