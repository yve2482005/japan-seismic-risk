import json
import unittest
from unittest.mock import patch

from collector.github_action_runner import USGS_LIVE_TAB, USGS_SOURCE, active_production_rows, alert_definition, closed_production_forecast_outcomes, collect, materialize_features, normalized_records, positive_label_count, production_prediction_rows, promote_rows, quality_gate, risk_level, select_production_candidate, source_aware_alert_records


class GitHubActionRunnerTests(unittest.TestCase):
    def test_feature_materialization_replaces_missing_feature_values_with_null(self):
        records = [{"event_id": "evt-1", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10.0, "magnitude": 3.1, "region": "Kyushu"}]
        saved: dict[str, list[dict]] = {}
        with patch("collector.github_action_runner.replace_derived_tab", side_effect=lambda _sheet, tab, rows: saved.setdefault(tab, list(rows)) and len(saved[tab])):
            counts = materialize_features("sheet-id", records, "test-source-v1")
        self.assertEqual(counts, {"features": 1, "training_rows": 1})
        features = json.loads(saved["FEATURES"][0]["features_json"])
        self.assertIn(None, features.values())
        self.assertEqual(saved["TRAINING_DATA"][0]["dataset_version"], "test-source-v1")

    def test_quality_gate_defers_before_history_and_class_requirements_are_met(self):
        records = [{"event_id": "evt-1", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10.0, "magnitude": 3.1, "region": "Kyushu"}]
        passed, detail = quality_gate(records)
        self.assertFalse(passed)
        self.assertEqual(detail["records"], 1)

    def test_fast_positive_label_count_matches_the_chronological_future_window_definition(self):
        records = [
            {"event_id": "one", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10, "magnitude": 2.5, "region": "Kyushu"},
            {"event_id": "two", "origin_time_utc": "2025-01-01T12:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10, "magnitude": 4.2, "region": "Kyushu"},
            {"event_id": "three", "origin_time_utc": "2025-01-03T00:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10, "magnitude": 4.1, "region": "Kyushu"},
        ]
        self.assertEqual(positive_label_count(records, __import__("collector.train_models", fromlist=["TargetConfig"]).TargetConfig()), 1)

    def test_normalized_records_removes_repeated_source_event_ids_before_training(self):
        rows = [
            {"event_id": "same", "source": "JMA", "data_quality": "validated", "duplicate_status": "accepted", "training_eligible": "yes", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": "32", "longitude": "132", "depth_km": "10", "magnitude": "3", "region": "Kyushu"},
            {"event_id": "same", "source": "JMA", "data_quality": "validated", "duplicate_status": "accepted", "training_eligible": "yes", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": "32", "longitude": "132", "depth_km": "10", "magnitude": "3", "region": "Kyushu"},
        ]
        with patch("collector.github_action_runner.read_tab_records", return_value=rows):
            self.assertEqual(len(normalized_records("sheet", "JMA")), 1)

    def test_source_separated_training_never_promotes_a_model(self):
        records = [{"event_id": "evt-1", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10.0, "magnitude": 3.1, "region": "Kyushu"}]
        with patch("collector.github_action_runner.quality_gate", return_value=(False, {"records": 1})), patch("collector.github_action_runner.append_system_log"):
            from collector.github_action_runner import train_if_ready
            self.assertEqual(train_if_ready("sheet", records, "jma-historical-bulletin-v1", allow_promotion=False)["status"], "deferred_quality_gate")

    def test_no_probability_rows_exist_without_an_actual_production_report(self):
        self.assertEqual(production_prediction_rows([], [], "2026-08-24T00:00:00Z"), [])

    def test_daily_scoring_reuses_only_a_retained_usgs_production_model(self):
        existing = [
            {"model_version": "usgs-production-v1", "dataset_version": "usgs-live-sheet-v1", "status": "production", "trained_at": "2026-08-24T00:00:00Z"},
            {"model_version": "jma-production-like-row", "dataset_version": "jma-historical-bulletin-v1", "status": "production", "trained_at": "2026-08-24T00:00:00Z"},
        ]
        self.assertEqual(
            [row["model_version"] for row in active_production_rows(existing, [{"model_version": "usgs-candidate-v2", "dataset_version": "usgs-live-sheet-v1", "status": "candidate", "trained_at": "2026-08-25T00:00:00Z"}], "usgs-live-sheet-v1")],
            ["usgs-production-v1"],
        )

    def test_retired_model_cannot_be_reused_for_daily_scoring(self):
        history = [
            {"model_version": "usgs-production-v1", "dataset_version": "usgs-live-sheet-v1", "status": "production", "trained_at": "2026-08-24T00:00:00Z"},
            {"model_version": "usgs-production-v1", "dataset_version": "usgs-live-sheet-v1", "status": "retired", "trained_at": "2026-08-25T00:00:00Z"},
        ]
        self.assertEqual(active_production_rows(history, [], "usgs-live-sheet-v1"), [])

    def test_probability_categories_are_derived_from_probability_values(self):
        self.assertEqual([risk_level(value) for value in (0.01, 0.06, 0.16, 0.31)], ["LOW", "MODERATE", "ELEVATED", "HIGH"])

    def test_usgs_collection_targets_the_dedicated_live_tab(self):
        csv_text = "time,updated,latitude,longitude,depth,mag,id,url,magType,place,type\n2026-08-24T00:00:00Z,2026-08-24T00:00:01Z,32.2,132.0,10,3.1,us-test,https://example.test,mb,Kyushu,earthquake\n"
        with patch("collector.github_action_runner.download_csv", return_value=csv_text), patch("collector.github_action_runner.read_tab_records", return_value=[]), patch("collector.github_action_runner.upsert_raw_records", return_value={"appended": 1, "updated": 0, "unchanged": 0}) as upsert, patch("collector.github_action_runner.append_unique_alert_records", return_value={"created": 0, "duplicates_skipped": 0}), patch("collector.github_action_runner.append_system_log"):
            collect("sheet-id")
        self.assertEqual(upsert.call_args.kwargs["tab"], USGS_LIVE_TAB)

    def test_detection_alert_thresholds_follow_the_configured_default_levels(self):
        self.assertEqual(alert_definition(4.0), ("normal", "LEVEL_1", 4.0))
        self.assertEqual(alert_definition(5.0), ("high", "LEVEL_2", 5.0))
        self.assertEqual(alert_definition(6.0), ("critical", "LEVEL_3", 6.0))
        self.assertIsNone(alert_definition(3.9))

    def test_detection_alerts_are_fresh_usgs_only_and_are_not_forecasts(self):
        now = __import__("datetime").datetime(2026, 8, 24, 12, tzinfo=__import__("datetime").timezone.utc)
        records = [
            {"event_id": "usgs-m5", "source": USGS_SOURCE, "origin_time_utc": "2026-08-24T10:00:00Z", "magnitude": 5.2, "region": "Hokkaido", "nearest_city": "Hokkaido", "depth_km": 34, "source_url": "https://example.test/usgs-m5"},
            {"event_id": "jma-historical", "source": "Japan Meteorological Agency", "origin_time_utc": "2026-08-24T10:00:00Z", "magnitude": 6.1, "region": "Hokkaido"},
            {"event_id": "old-usgs", "source": USGS_SOURCE, "origin_time_utc": "2026-08-20T10:00:00Z", "magnitude": 6.1, "region": "Hokkaido"},
        ]
        alerts = source_aware_alert_records(records, now)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["event_id"], "usgs-m5")
        self.assertEqual(alerts[0]["alert_type"], "earthquake_detection_not_prediction")
        self.assertEqual(alerts[0]["severity"], "high")

    def test_forecast_outcomes_require_a_closed_window_and_genuine_usgs_production_model(self):
        now = __import__("datetime").datetime(2026, 8, 26, tzinfo=__import__("datetime").timezone.utc)
        production = [{"model_version": "usgs-production", "dataset_version": "usgs-live-sheet-v1", "status": "production"}]
        predictions = [
            {"prediction_id": "closed", "model_version": "usgs-production", "region": "Kyushu", "target_definition": "M4_NEXT_24H", "probability": 0.2, "generated_at": "2026-08-24T00:00:00Z"},
            {"prediction_id": "open", "model_version": "usgs-production", "region": "Kyushu", "target_definition": "M4_NEXT_24H", "probability": 0.2, "generated_at": "2026-08-26T00:00:00Z"},
            {"prediction_id": "candidate", "model_version": "candidate", "region": "Kyushu", "target_definition": "M4_NEXT_24H", "probability": 0.2, "generated_at": "2026-08-24T00:00:00Z"},
        ]
        records = [{"event_id": "actual-m4", "region": "Kyushu", "origin_time_utc": "2026-08-24T12:00:00Z", "magnitude": 4.1}]
        outcomes = closed_production_forecast_outcomes(predictions, production, records, now)
        self.assertEqual(len(outcomes), 1)
        self.assertEqual(outcomes[0]["outcome_id"], "closed:closed")
        self.assertEqual(outcomes[0]["actual_label"], 1)

    def test_candidate_only_or_jma_only_model_history_cannot_materialize_forecast_outcomes(self):
        now = __import__("datetime").datetime(2026, 8, 26, tzinfo=__import__("datetime").timezone.utc)
        prediction = [{"prediction_id": "candidate", "model_version": "candidate", "region": "Kyushu", "target_definition": "M4_NEXT_24H", "probability": 0.2, "generated_at": "2026-08-24T00:00:00Z"}]
        record = [{"event_id": "actual", "region": "Kyushu", "origin_time_utc": "2026-08-24T12:00:00Z", "magnitude": 4.1}]
        self.assertEqual(closed_production_forecast_outcomes(prediction, [{"model_version": "candidate", "dataset_version": "usgs-live-sheet-v1", "status": "candidate"}], record, now), [])
        self.assertEqual(closed_production_forecast_outcomes(prediction, [{"model_version": "jma-only", "dataset_version": "jma-historical-bulletin-v1", "status": "production"}], record, now), [])

    def test_selects_only_the_best_calibrated_candidate_for_production(self):
        def candidate(pr_auc: float, brier: float, ece: float):
            return {"metrics_json": json.dumps({"pr_auc": pr_auc, "brier_score": brier, "calibration": {"expected_calibration_error": ece}})}
        rows = [candidate(0.41, 0.18, 0.11), candidate(0.53, 0.21, 0.08), candidate(0.98, 0.30, 0.05)]
        self.assertEqual(select_production_candidate(rows), 1)

    def test_promotes_only_when_candidate_improves_effective_production_and_retires_prior_version(self):
        def report(version: str, status: str, pr_auc: float, recall: float, fpr: float, brier: float, ece: float):
            return {"model_version": version, "target_definition": "M4_NEXT_24H", "status": status, "trained_at": "2026-01-01T00:00:00Z", "metrics_json": json.dumps({"pr_auc": pr_auc, "recall": recall, "false_positive_rate": fpr, "brier_score": brier, "calibration": {"expected_calibration_error": ece}})}
        prior = report("production-v1", "production", 0.42, 0.5, 0.2, 0.2, 0.1)
        better = report("candidate-v2", "candidate", 0.5, 0.6, 0.18, 0.18, 0.08)
        retired, promoted = promote_rows([better], [prior], "2026-02-01T00:00:00Z")
        self.assertEqual(promoted, 1)
        self.assertEqual(better["status"], "production")
        self.assertEqual(retired[0]["model_version"], "production-v1")
        self.assertEqual(retired[0]["status"], "retired")

    def test_retains_current_production_when_candidate_worsens_a_required_metric(self):
        def report(version: str, status: str, recall: float):
            return {"model_version": version, "target_definition": "M4_NEXT_24H", "status": status, "trained_at": "2026-01-01T00:00:00Z", "metrics_json": json.dumps({"pr_auc": 0.5, "recall": recall, "false_positive_rate": 0.2, "brier_score": 0.2, "calibration": {"expected_calibration_error": 0.1}})}
        candidate = report("candidate-v2", "candidate", 0.4)
        retired, promoted = promote_rows([candidate], [report("production-v1", "production", 0.5)], "2026-02-01T00:00:00Z")
        self.assertEqual((promoted, retired, candidate["status"]), (0, [], "candidate"))
