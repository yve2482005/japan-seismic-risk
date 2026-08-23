import unittest
from datetime import datetime, timezone

from collector.live_usgs_pipeline import normalize_usgs_row


class LiveUsgsPipelineTests(unittest.TestCase):
    def setUp(self):
        self.row = {
            "id": "us-test-event", "url": "https://earthquake.usgs.gov/earthquakes/eventpage/us-test-event",
            "time": "2026-08-23T00:00:00.000Z", "updated": "2026-08-23T00:02:00.000Z",
            "latitude": "32.2", "longitude": "132.0", "depth": "-1.2", "mag": "4.1",
            "magType": "mb", "place": "Hyuga-nada", "type": "earthquake",
        }

    def test_normalizes_iso_updated_time_and_preserves_source_valid_negative_depth(self):
        record = normalize_usgs_row(self.row, datetime(2026, 8, 23, tzinfo=timezone.utc))
        self.assertEqual(record.event_id, "us-test-event")
        self.assertEqual(record.region, "Kyushu")
        self.assertEqual(record.depth_km, -1.2)
        self.assertEqual(record.updated_epoch_ms, 1787443320000)

    def test_rejects_an_invalid_source_update_time(self):
        invalid = {**self.row, "updated": "not-a-time"}
        with self.assertRaisesRegex(ValueError, "INVALID_UPDATED_TIMESTAMP"):
            normalize_usgs_row(invalid, datetime.now(timezone.utc))
