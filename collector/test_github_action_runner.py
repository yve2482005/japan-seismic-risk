import json
import unittest
from unittest.mock import patch

from collector.github_action_runner import materialize_features, promote_rows, quality_gate, risk_level, select_production_candidate


class GitHubActionRunnerTests(unittest.TestCase):
    def test_feature_materialization_replaces_missing_feature_values_with_null(self):
        records = [{"event_id": "evt-1", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10.0, "magnitude": 3.1, "region": "Kyushu"}]
        saved: dict[str, list[dict]] = {}
        with patch("collector.github_action_runner.replace_derived_tab", side_effect=lambda _sheet, tab, rows: saved.setdefault(tab, list(rows)) and len(saved[tab])):
            counts = materialize_features("sheet-id", records)
        self.assertEqual(counts, {"features": 1, "training_rows": 1})
        features = json.loads(saved["FEATURES"][0]["features_json"])
        self.assertIn(None, features.values())

    def test_quality_gate_defers_before_history_and_class_requirements_are_met(self):
        records = [{"event_id": "evt-1", "origin_time_utc": "2025-01-01T00:00:00Z", "latitude": 32.2, "longitude": 132.0, "depth_km": 10.0, "magnitude": 3.1, "region": "Kyushu"}]
        passed, detail = quality_gate(records)
        self.assertFalse(passed)
        self.assertEqual(detail["records"], 1)

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

    def test_risk_level_uses_probability_not_hardcoded_activity_labels(self):
        self.assertEqual([risk_level(value) for value in (0.01, 0.06, 0.16, 0.31)], ["LOW", "MODERATE", "ELEVATED", "HIGH"])
