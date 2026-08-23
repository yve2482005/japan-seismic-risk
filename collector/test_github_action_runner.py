import json
import unittest
from unittest.mock import patch

from collector.github_action_runner import materialize_features, quality_gate, select_production_candidate


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
