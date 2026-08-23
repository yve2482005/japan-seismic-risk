import json
import unittest
from unittest.mock import patch

from collector.github_action_runner import materialize_features, quality_gate


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
