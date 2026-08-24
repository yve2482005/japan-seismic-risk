import io
import unittest
import zipfile
from datetime import datetime, timezone

from collector.jma_historical_pipeline import JMA_SOURCE, archive_url, parse_archive


def archive_bytes(lines: list[str]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("h202312.txt", "\n".join(["header 1", "header 2", "header 3", *lines]))
    return output.getvalue()


class JmaHistoricalPipelineTests(unittest.TestCase):
    def test_parses_static_zip_rows_with_day_carry_and_preserves_archive_provenance(self):
        lines = [
            "   1 00 00 14.5 0.1  36 16.3 0.3  140 50.5 0.7   45 1  2.9V        (3,111) E OFF IBARAKI PREF",
            "     00 07 03.5 0.1  34 20.6 0.3  140 18.0 0.4   75 1  1.9V        (3,106) FAR S OFF BOSO PENINSULA",
        ]
        records, failures = parse_archive(2023, 12, archive_bytes(lines), datetime(2026, 8, 23, tzinfo=timezone.utc))
        self.assertEqual(len(records), 2)
        self.assertEqual(failures["invalid_rows"], 0)
        self.assertTrue(records[0]["event_id"].startswith("jma-bulletin-202312-"))
        self.assertEqual(records[0]["source"], JMA_SOURCE)
        self.assertEqual(records[0]["training_eligible"], "yes")
        self.assertEqual(records[1]["training_eligible"], "no")
        self.assertEqual(records[0]["local_time_japan"], "2023-12-01T00:00:14.500000+09:00")
        self.assertIn(archive_url(2023, 12), records[0]["raw_value"])

    def test_rejects_rows_outside_the_approved_japan_envelope(self):
        line = "   1 00 00 14.5 0.1  10 16.3 0.3  100 50.5 0.7   45 1  3.0V        (3,111) OUTSIDE"
        records, failures = parse_archive(2023, 12, archive_bytes([line]), datetime.now(timezone.utc))
        self.assertEqual(records, [])
        self.assertEqual(failures["outside_envelope"], 1)

