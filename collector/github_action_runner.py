"""Stateless GitHub Actions runner for the approved USGS public CSV pipeline.

All durable records, deduplication state, derived datasets, run logs, and model
reports live in the approved Google Sheet. This file deliberately contains no
credentials and makes no earthquake API request.
"""
from __future__ import annotations

import argparse
import bisect
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
    from .jma_historical_pipeline import JMA_BACKFILL_MONTHS, JMA_SOURCE, download_archive, parse_archive
    from .live_usgs_pipeline import USGS_CSV_URL, download_csv, normalize_usgs_row
    from .train_models import FEATURE_NAMES, STANDARD_TARGETS, build_dataset, parse_time, train
except ImportError:
    from google_sheets_sink import append_derived_records, append_system_log, create_or_prepare_spreadsheet, read_tab_records, replace_derived_tab, upsert_raw_records
    from jma_historical_pipeline import JMA_BACKFILL_MONTHS, JMA_SOURCE, download_archive, parse_archive
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


def _cross_source_duplicate_status(record: dict[str, Any], usgs_rows: list[dict[str, str]]) -> str:
    """Flag likely USGS matches without deleting either source's original record."""
    origin = parse_time(record["origin_time_utc"])
    for row in usgs_rows:
        if not row.get("source", "").startswith("U.S. Geological Survey"):
            continue
        try:
            time_gap = abs((origin - parse_time(row["origin_time_utc"])).total_seconds())
            latitude_gap = abs(float(record["latitude"]) - float(row["latitude"]))
            longitude_gap = abs(float(record["longitude"]) - float(row["longitude"]))
            magnitude_gap = abs(float(record["magnitude"]) - float(row["magnitude"]))
        except (KeyError, ValueError):
            continue
        if time_gap <= 60 and latitude_gap <= 0.1 and longitude_gap <= 0.1 and magnitude_gap <= 0.5:
            return "possible_usgs_match_retained_source_separated"
    return "no_usgs_match_checked"


def backfill_jma_historical(spreadsheet_id: str) -> dict[str, Any]:
    """Run the owner-approved static ZIP import; it does not alter USGS live collection."""
    existing_rows = read_tab_records(spreadsheet_id, "RAW_EARTHQUAKES")
    records: list[dict[str, Any]] = []
    totals = {"invalid_rejected": 0, "outside_envelope": 0, "within_source_duplicates": 0, "cross_source_matches_retained": 0}
    periods: list[str] = []
    for year, month in JMA_BACKFILL_MONTHS:
        periods.append(f"{year:04d}-{month:02d}")
        parsed, failures = parse_archive(year, month, download_archive(year, month), datetime.now(timezone.utc))
        totals["invalid_rejected"] += failures["invalid_rows"]
        totals["outside_envelope"] += failures["outside_envelope"]
        totals["within_source_duplicates"] += failures["within_source_duplicates"]
        for record in parsed:
            record["cross_source_duplicate_status"] = _cross_source_duplicate_status(record, existing_rows)
            if record["cross_source_duplicate_status"] != "no_usgs_match_checked":
                totals["cross_source_matches_retained"] += 1
        records.extend(parsed)
    outcome = upsert_raw_records(spreadsheet_id, records)
    result = {"source": JMA_SOURCE, "source_kind": "historical_static_zip_backfill_not_live", "archive_periods": periods, "records_parsed": len(records), **totals, **outcome, "completed_at": datetime.now(timezone.utc).isoformat()}
    append_system_log(spreadsheet_id, "jma_backfill", "info", "JMA historical ZIP backfill completed; records remain source-separated from USGS live observations", result)
    return result


def normalized_records(spreadsheet_id: str, source: str) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for row in read_tab_records(spreadsheet_id, "RAW_EARTHQUAKES"):
        if row.get("source") != source or row.get("data_quality") != "validated" or row.get("duplicate_status") not in {"accepted", "updated"}:
            continue
        if row.get("training_eligible") not in {"", "yes"}:
            continue
        try:
            unique.setdefault(row["event_id"], {"event_id": row["event_id"], "origin_time_utc": row["origin_time_utc"], "latitude": float(row["latitude"]), "longitude": float(row["longitude"]), "depth_km": float(row["depth_km"]) if row.get("depth_km") else None, "magnitude": float(row["magnitude"]) if row.get("magnitude") else None, "region": row["region"]})
        except (KeyError, ValueError):
            continue
    return sorted(unique.values(), key=lambda record: parse_time(record["origin_time_utc"]))


def source_quality_summary(spreadsheet_id: str, source: str) -> dict[str, int]:
    rows = [row for row in read_tab_records(spreadsheet_id, "RAW_EARTHQUAKES") if row.get("source") == source and row.get("data_quality") == "validated" and row.get("duplicate_status") in {"accepted", "updated"}]
    return {"raw_rows": len(rows), "unique_event_ids": len({row.get("event_id") for row in rows}), "duplicate_rows_removed_for_training": len(rows) - len({row.get("event_id") for row in rows})}


def materialize_features(spreadsheet_id: str, records: list[dict[str, Any]], dataset_version: str) -> dict[str, int]:
    if not records:
        return {"features": 0, "training_rows": 0}
    features, labels = build_dataset(records, STANDARD_TARGETS[0])
    now = datetime.now(timezone.utc).isoformat()
    feature_rows = []
    training_rows = []
    for record, values, label in zip(records, features.tolist(), labels.tolist(), strict=True):
        safe_features = {name: None if not np.isfinite(value) else float(value) for name, value in zip(FEATURE_NAMES, values, strict=True)}
        feature_rows.append({"event_id": record["event_id"], "feature_as_of_utc": record["origin_time_utc"], "region": record["region"], "target_name": "M4_NEXT_24H_REGION", "features_json": json.dumps(safe_features), "created_at": now})
        training_rows.append({"event_id": record["event_id"], "target_name": "M4_NEXT_24H_REGION", "label": int(label), "feature_version": "chronological-v1", "dataset_version": dataset_version, "created_at": now})
    return {"features": replace_derived_tab(spreadsheet_id, "FEATURES", feature_rows), "training_rows": replace_derived_tab(spreadsheet_id, "TRAINING_DATA", training_rows)}


def quality_gate(records: list[dict[str, Any]]) -> tuple[bool, dict[str, Any]]:
    if not records:
        return False, {"reason": "no validated records"}
    history_days = (parse_time(records[-1]["origin_time_utc"]) - parse_time(records[0]["origin_time_utc"])).total_seconds() / 86400
    positives = positive_label_count(records, STANDARD_TARGETS[0])
    passed = len(records) >= MIN_TRAINING_RECORDS and history_days >= MIN_HISTORY_DAYS and positives >= MIN_POSITIVE_LABELS
    return passed, {"records": len(records), "history_days": round(history_days, 2), "positive_labels": positives, "minimum_records": MIN_TRAINING_RECORDS, "minimum_history_days": MIN_HISTORY_DAYS, "minimum_positive_labels": MIN_POSITIVE_LABELS}


def positive_label_count(records: list[dict[str, Any]], target: Any) -> int:
    """Count the same future regional labels as build_dataset without materializing O(n²) features."""
    by_region: dict[str, list[dict[str, Any]]] = {}
    for record in sorted(records, key=lambda item: parse_time(item["origin_time_utc"])):
        by_region.setdefault(record["region"], []).append(record)
    positives = 0
    for region_records in by_region.values():
        qualifying_times = [parse_time(record["origin_time_utc"]).timestamp() for record in region_records if float(record.get("magnitude") or -99) >= target.magnitude_threshold]
        for record in region_records:
            anchor = parse_time(record["origin_time_utc"]).timestamp()
            first_future = bisect.bisect_right(qualifying_times, anchor)
            if first_future < len(qualifying_times) and qualifying_times[first_future] <= anchor + target.horizon_hours * 3600:
                positives += 1
    return positives


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


def effective_model_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Resolve append-only Sheet history to the latest status for each model version."""
    effective: dict[str, dict[str, Any]] = {}
    for row in rows:
        version = row.get("model_version")
        if not version:
            continue
        current = effective.get(version)
        if current is None or row.get("trained_at", "") >= current.get("trained_at", ""):
            effective[version] = row
    return list(effective.values())


def candidate_outperforms(candidate: dict[str, Any], production: dict[str, Any] | None) -> bool:
    """Require an eligible candidate to match or improve all retained production safeguards."""
    if production is None:
        return True
    candidate_metrics = json.loads(candidate["metrics_json"])
    production_metrics = json.loads(production["metrics_json"])
    candidate_calibration = candidate_metrics.get("calibration", {})
    production_calibration = production_metrics.get("calibration", {})
    comparisons = (
        ("pr_auc", True),
        ("recall", True),
        ("false_positive_rate", False),
        ("brier_score", False),
    )
    for field, higher_is_better in comparisons:
        candidate_value, production_value = candidate_metrics.get(field), production_metrics.get(field)
        if not isinstance(candidate_value, (int, float)) or not isinstance(production_value, (int, float)):
            return False
        if (higher_is_better and candidate_value < production_value) or (not higher_is_better and candidate_value > production_value):
            return False
    candidate_ece = candidate_calibration.get("expected_calibration_error")
    production_ece = production_calibration.get("expected_calibration_error")
    return isinstance(candidate_ece, (int, float)) and isinstance(production_ece, (int, float)) and candidate_ece <= production_ece


def promote_rows(candidates: list[dict[str, Any]], existing_rows: list[dict[str, Any]], promoted_at: str) -> tuple[list[dict[str, Any]], int]:
    """Promote only better calibrated candidates and append a status transition for any replaced production model."""
    retired: list[dict[str, Any]] = []
    effective_existing = effective_model_rows(existing_rows)
    by_target: dict[str, list[dict[str, Any]]] = {}
    for row in candidates:
        by_target.setdefault(row["target_definition"], []).append(row)
    promoted = 0
    for target, target_rows in by_target.items():
        selected_index = select_production_candidate(target_rows)
        if selected_index is None:
            continue
        production = next((row for row in effective_existing if row.get("target_definition") == target and row.get("status") == "production"), None)
        candidate = target_rows[selected_index]
        if not candidate_outperforms(candidate, production):
            continue
        candidate["status"] = "production"
        promoted += 1
        if production:
            retired.append({**production, "status": "retired", "trained_at": promoted_at})
    return retired, promoted


def train_if_ready(spreadsheet_id: str, records: list[dict[str, Any]], dataset_version: str, allow_promotion: bool) -> dict[str, Any]:
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
            rows.append({"model_version": f"{algorithm}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}", "algorithm": algorithm, "target_definition": target_name, "dataset_version": dataset_version, "metrics_json": json.dumps(test), "calibration_json": json.dumps(test["calibration"]), "status": "candidate" if allow_promotion else "candidate_source_separated", "trained_at": report["generated_at"]})
    if not rows:
        result = {"status": "deferred_class_diversity", "deferred_targets": deferred_targets, **gate}
        append_system_log(spreadsheet_id, "training", "info", "Training deferred: no target had sufficient chronological class diversity", result)
        return result
    existing_rows = read_tab_records(spreadsheet_id, "MODEL_METRICS")
    promoted_at = datetime.now(timezone.utc).isoformat()
    retired_rows, promoted = promote_rows(rows, existing_rows, promoted_at) if allow_promotion else ([], 0)
    append_derived_records(spreadsheet_id, "MODEL_METRICS", [*rows, *retired_rows])
    result = {"status": "production_models_promoted" if promoted else ("candidate_reports_generated" if allow_promotion else "candidate_reports_source_separated"), "dataset_version": dataset_version, "reports": len(rows), "promoted_models": promoted, "deferred_targets": deferred_targets, "promotion_thresholds": {"max_brier_score": MAX_BRIER_SCORE, "max_expected_calibration_error": MAX_EXPECTED_CALIBRATION_ERROR}, **gate}
    append_system_log(spreadsheet_id, "training", "info", "Chronological candidate reports evaluated without cross-source record mixing", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("collect", "train", "all", "jma-backfill", "jma-quality-check", "jma-train"), default="all")
    parser.add_argument("--spreadsheet-id", default=None)
    args = parser.parse_args()
    spreadsheet_id = args.spreadsheet_id or require_environment("GOOGLE_SHEETS_SPREADSHEET_ID")
    create_or_prepare_spreadsheet("Japan Seismic Monitor — Live Dataset", spreadsheet_id)
    output: dict[str, Any] = {"mode": args.mode, "spreadsheet_id": spreadsheet_id}
    if args.mode in {"collect", "all"}:
        output["collection"] = collect(spreadsheet_id)
    if args.mode in {"train", "all"}:
        records = normalized_records(spreadsheet_id, "U.S. Geological Survey (USGS), ANSS ComCat")
        output["derived"] = materialize_features(spreadsheet_id, records, "usgs-live-sheet-v1")
        output["training"] = train_if_ready(spreadsheet_id, records, "usgs-live-sheet-v1", allow_promotion=True)
    if args.mode == "jma-backfill":
        output["jma_backfill"] = backfill_jma_historical(spreadsheet_id)
    if args.mode == "jma-quality-check":
        records = normalized_records(spreadsheet_id, JMA_SOURCE)
        passed, gate = quality_gate(records)
        output["jma_quality_check"] = {"status": "jma_source_separated_quality_gate_satisfied" if passed else "deferred_quality_gate", "dataset_version": "jma-historical-bulletin-v1", "metrics_reported": False, "probabilities_reported": False, **source_quality_summary(spreadsheet_id, JMA_SOURCE), **gate}
        append_system_log(spreadsheet_id, "jma_quality_check", "info", "JMA-only quality gate evaluated without model training or metrics", output["jma_quality_check"])
    if args.mode == "jma-train":
        records = normalized_records(spreadsheet_id, JMA_SOURCE)
        output["derived"] = materialize_features(spreadsheet_id, records, "jma-historical-bulletin-v1")
        output["training"] = train_if_ready(spreadsheet_id, records, "jma-historical-bulletin-v1", allow_promotion=False)
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
