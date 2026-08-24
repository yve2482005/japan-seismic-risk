"""Chronological probability-model trainer for a permitted, validated catalog.

This script is intentionally offline and operator-run. It reads normalized
records from JSON, never fetches earthquake data, and reports the actual held-
out test metrics. It must not be used to force or represent a 98% score.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, average_precision_score, brier_score_loss, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_NAMES = ("events_last_1h", "events_last_6h", "events_last_24h", "events_last_3d", "events_last_7d", "events_last_30d", "magnitude_min_24h", "magnitude_max_24h", "magnitude_mean_24h", "magnitude_median_24h", "magnitude_stddev_24h", "depth_min_24h", "depth_mean_24h", "depth_max_24h", "hours_since_previous", "hours_since_m3plus", "hours_since_m4plus", "hours_since_m5plus", "distance_from_previous_km", "local_event_density_24h", "regional_event_density_7d", "activity_change_rate", "magnitude_trend", "short_to_long_activity_ratio", "historical_m4plus", "historical_m5plus", "historical_m6plus")


@dataclass(frozen=True)
class TargetConfig:
    magnitude_threshold: float = 4.0
    horizon_hours: int = 24
    region_scoped: bool = True


STANDARD_TARGETS = (
    TargetConfig(4.0, 24, True),
    TargetConfig(5.0, 24, True),
    TargetConfig(5.0, 24 * 7, True),
    TargetConfig(6.0, 24 * 7, True),
)


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def build_dataset(records: list[dict[str, Any]], target: TargetConfig) -> tuple[np.ndarray, np.ndarray]:
    ordered = sorted(records, key=lambda record: parse_time(record["origin_time_utc"]))
    rows: list[list[float]] = []
    labels: list[int] = []
    for index, anchor in enumerate(ordered):
        anchor_time = parse_time(anchor["origin_time_utc"])
        earlier = [record for record in ordered[:index] if not target.region_scoped or record.get("region") == anchor.get("region")]
        def recent(hours: int) -> list[dict[str, Any]]:
            return [record for record in earlier if anchor_time - parse_time(record["origin_time_utc"]) <= timedelta(hours=hours)]
        last_24 = recent(24)
        magnitudes = [float(record["magnitude"]) for record in last_24 if record.get("magnitude") is not None]
        depths = [float(record["depth_km"]) for record in last_24 if record.get("depth_km") is not None]
        previous_time = parse_time(earlier[-1]["origin_time_utc"]) if earlier else None
        previous_24 = [record for record in earlier if timedelta(hours=24) < anchor_time - parse_time(record["origin_time_utc"]) <= timedelta(hours=48)]
        def stat(values: list[float], reducer: str) -> float:
            return float(getattr(np, reducer)(values)) if values else np.nan
        def hours_since(threshold: float | None = None) -> float:
            candidates = [record for record in earlier if threshold is None or float(record.get("magnitude") or -99) >= threshold]
            return (anchor_time - parse_time(candidates[-1]["origin_time_utc"])).total_seconds() / 3600 if candidates else np.nan
        def haversine(left: dict[str, Any], right: dict[str, Any]) -> float:
            lat1, lon1, lat2, lon2 = map(np.radians, [float(left["latitude"]), float(left["longitude"]), float(right["latitude"]), float(right["longitude"])])
            a = np.sin((lat2-lat1)/2)**2 + np.cos(lat1)*np.cos(lat2)*np.sin((lon2-lon1)/2)**2
            return float(6371 * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a)))
        local_24 = [record for record in last_24 if haversine(record, anchor) <= 100]
        prior_magnitudes = [float(record["magnitude"]) for record in previous_24 if record.get("magnitude") is not None]
        rows.append([
            len(recent(1)), len(recent(6)), len(last_24), len(recent(72)), len(recent(168)), len(recent(720)),
            stat(magnitudes, "min"), stat(magnitudes, "max"), stat(magnitudes, "mean"), stat(magnitudes, "median"), stat(magnitudes, "std"),
            stat(depths, "min"), stat(depths, "mean"), stat(depths, "max"),
            hours_since(), hours_since(3), hours_since(4), hours_since(5),
            haversine(earlier[-1], anchor) if earlier else np.nan, len(local_24), len(recent(168)),
            ((len(last_24) - len(previous_24)) / len(previous_24)) if previous_24 else np.nan,
            (float(np.mean(magnitudes)) - float(np.mean(prior_magnitudes))) if magnitudes and prior_magnitudes else np.nan,
            (len(last_24) / 1) / (len(recent(720)) / 30) if recent(720) else np.nan,
            sum(float(record.get("magnitude") or -99) >= 4 for record in earlier), sum(float(record.get("magnitude") or -99) >= 5 for record in earlier), sum(float(record.get("magnitude") or -99) >= 6 for record in earlier),
        ])
        horizon = anchor_time + timedelta(hours=target.horizon_hours)
        label = any(
            parse_time(event["origin_time_utc"]) > anchor_time
            and parse_time(event["origin_time_utc"]) <= horizon
            and (not target.region_scoped or event.get("region") == anchor.get("region"))
            and float(event.get("magnitude") or -99) >= target.magnitude_threshold
            for event in ordered[index + 1:]
        )
        labels.append(int(label))
    return np.asarray(rows), np.asarray(labels)


def regional_feature_vector(records: list[dict[str, Any]], region: str, as_of: datetime) -> list[float] | None:
    """Build a no-future-information feature row for a regional forecast timestamp."""
    earlier = [record for record in records if record.get("region") == region and parse_time(record["origin_time_utc"]) <= as_of]
    if not earlier:
        return None
    def recent(hours: int) -> list[dict[str, Any]]:
        return [record for record in earlier if as_of - parse_time(record["origin_time_utc"]) <= timedelta(hours=hours)]
    def stat(values: list[float], reducer: str) -> float:
        return float(getattr(np, reducer)(values)) if values else np.nan
    def hours_since(threshold: float | None = None) -> float:
        candidates = [record for record in earlier if threshold is None or float(record.get("magnitude") or -99) >= threshold]
        return (as_of - parse_time(candidates[-1]["origin_time_utc"])).total_seconds() / 3600 if candidates else np.nan
    last_24, previous_24 = recent(24), [record for record in earlier if timedelta(hours=24) < as_of - parse_time(record["origin_time_utc"]) <= timedelta(hours=48)]
    magnitudes = [float(record["magnitude"]) for record in last_24 if record.get("magnitude") is not None]
    depths = [float(record["depth_km"]) for record in last_24 if record.get("depth_km") is not None]
    prior_magnitudes = [float(record["magnitude"]) for record in previous_24 if record.get("magnitude") is not None]
    last_30 = recent(720)
    return [
        len(recent(1)), len(recent(6)), len(last_24), len(recent(72)), len(recent(168)), len(last_30),
        stat(magnitudes, "min"), stat(magnitudes, "max"), stat(magnitudes, "mean"), stat(magnitudes, "median"), stat(magnitudes, "std"),
        stat(depths, "min"), stat(depths, "mean"), stat(depths, "max"),
        hours_since(), hours_since(3), hours_since(4), hours_since(5), np.nan, len(last_24), len(recent(168)),
        ((len(last_24) - len(previous_24)) / len(previous_24)) if previous_24 else np.nan,
        (float(np.mean(magnitudes)) - float(np.mean(prior_magnitudes))) if magnitudes and prior_magnitudes else np.nan,
        (len(last_24) / 1) / (len(last_30) / 30) if last_30 else np.nan,
        sum(float(record.get("magnitude") or -99) >= 4 for record in earlier), sum(float(record.get("magnitude") or -99) >= 5 for record in earlier), sum(float(record.get("magnitude") or -99) >= 6 for record in earlier),
    ]


def production_model(records: list[dict[str, Any]], target: TargetConfig, algorithm: str):
    """Refit the selected, already evaluated algorithm on all available source-specific history."""
    features, labels = build_dataset(records, target)
    if len(np.unique(labels)) < 2:
        raise ValueError("Insufficient class diversity for a production refit.")
    if algorithm == "logistic_regression":
        model = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", LogisticRegression(max_iter=2000, class_weight="balanced"))])
    elif algorithm == "random_forest":
        model = Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42))])
    elif algorithm == "gradient_boosting":
        model = Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", HistGradientBoostingClassifier(random_state=42))])
    else:
        raise ValueError(f"Unsupported production algorithm: {algorithm}")
    return model.fit(features, labels)


def chronological_slices(n_rows: int) -> tuple[slice, slice, slice]:
    train_end = int(n_rows * 0.7)
    valid_end = int(n_rows * 0.85)
    return slice(0, train_end), slice(train_end, valid_end), slice(valid_end, n_rows)


def metric_report(labels: np.ndarray, probabilities: np.ndarray) -> dict[str, Any]:
    predictions = probabilities >= 0.5
    tn, fp, fn, tp = confusion_matrix(labels, predictions, labels=[0, 1]).ravel()
    calibration_bins = []
    for lower in np.linspace(0, 0.9, 10):
        upper = lower + 0.1
        mask = (probabilities >= lower) & ((probabilities < upper) if upper < 1 else (probabilities <= upper))
        calibration_bins.append({"lower": float(lower), "upper": float(upper), "count": int(mask.sum()), "mean_predicted_probability": float(probabilities[mask].mean()) if mask.any() else None, "observed_rate": float(labels[mask].mean()) if mask.any() else None})
    ece = sum((row["count"] / len(labels)) * abs((row["mean_predicted_probability"] or 0) - (row["observed_rate"] or 0)) for row in calibration_bins)
    report: dict[str, Any] = {
        "accuracy": float(accuracy_score(labels, predictions)),
        "precision": float(precision_score(labels, predictions, zero_division=0)),
        "recall": float(recall_score(labels, predictions, zero_division=0)),
        "f1": float(f1_score(labels, predictions, zero_division=0)),
        "brier_score": float(brier_score_loss(labels, probabilities)),
        "false_positive_rate": float(fp / (fp + tn)) if fp + tn else None,
        "false_negative_rate": float(fn / (fn + tp)) if fn + tp else None,
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "calibration": {"expected_calibration_error": float(ece), "bins": calibration_bins},
    }
    if len(np.unique(labels)) == 2:
        report["roc_auc"] = float(roc_auc_score(labels, probabilities))
        report["pr_auc"] = float(average_precision_score(labels, probabilities))
    else:
        report["roc_auc"] = None
        report["pr_auc"] = None
    return report


def train(records_path: Path, output_path: Path, target: TargetConfig = TargetConfig()) -> None:
    records = json.loads(records_path.read_text(encoding="utf-8"))
    features, labels = build_dataset(records, target)
    train_slice, validation_slice, test_slice = chronological_slices(len(labels))
    if len(labels[test_slice]) < 2 or len(np.unique(labels[train_slice])) < 2:
        raise ValueError("Insufficient chronological, class-diverse data for an honest model evaluation.")
    baseline = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", LogisticRegression(max_iter=2000, class_weight="balanced"))])
    forest = Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42))])
    gradient = Pipeline([("imputer", SimpleImputer(strategy="median")), ("model", HistGradientBoostingClassifier(random_state=42))])
    candidates = {"logistic_regression": baseline, "random_forest": forest, "gradient_boosting": gradient}
    trained: dict[str, dict[str, Any]] = {}
    for name, model in candidates.items():
        model.fit(features[train_slice], labels[train_slice])
        validation_probability = model.predict_proba(features[validation_slice])[:, 1]
        test_probability = model.predict_proba(features[test_slice])[:, 1]
        trained[name] = {"validation": metric_report(labels[validation_slice], validation_probability), "test": metric_report(labels[test_slice], test_probability)}
    output = {"target": asdict(target), "feature_names": FEATURE_NAMES, "time_aware_split": {"training": [train_slice.start, train_slice.stop], "validation": [validation_slice.start, validation_slice.stop], "test": [test_slice.start, test_slice.stop]}, "models": trained, "generated_at": datetime.now(timezone.utc).isoformat()}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")


def train_standard_targets(records_path: Path, output_path: Path) -> None:
    """Run the four standard target definitions independently, preserving chronological splits."""
    records = json.loads(records_path.read_text(encoding="utf-8"))
    outputs: dict[str, Any] = {}
    for target in STANDARD_TARGETS:
        temporary = output_path.with_suffix(f".m{target.magnitude_threshold:g}_{target.horizon_hours}h.tmp.json")
        train(records_path, temporary, target)
        outputs[f"M{target.magnitude_threshold:g}_NEXT_{target.horizon_hours}H"] = json.loads(temporary.read_text(encoding="utf-8"))
        temporary.unlink(missing_ok=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"targets": outputs, "generated_at": datetime.now(timezone.utc).isoformat()}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit("Import train() from an approved operator workflow; do not train on unreviewed data.")
