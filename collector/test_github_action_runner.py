import json
import unittest
from unittest.mock import patch

from collector.github_action_runner import materialize_features, normalized_records, positive_label_count, promote_rows, quality_gate, select_production_candidate


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
