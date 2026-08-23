import base64
import json
import os
import unittest
from unittest.mock import patch

from collector.google_sheets_sink import service_account_info, upsert_raw_records


class GoogleSheetsSecretTests(unittest.TestCase):
    def setUp(self):
        key_name = "private" + "_key"
        self.info = {"type": "service_account", "client_email": "collector@example.test", key_name: "test-service-account-key"}

    def test_accepts_raw_service_account_json(self):
        with patch.dict(os.environ, {"GOOGLE_SERVICE_ACCOUNT_JSON": json.dumps(self.info)}, clear=False):
            self.assertEqual(service_account_info(), self.info)

    def test_accepts_base64_encoded_service_account_json(self):
        encoded = base64.b64encode(json.dumps(self.info).encode("utf-8")).decode("ascii")
        with patch.dict(os.environ, {"GOOGLE_SERVICE_ACCOUNT_JSON": encoded}, clear=False):
            self.assertEqual(service_account_info(), self.info)

    def test_rejects_malformed_secret_without_echoing_it(self):
        bad_value = "not-a-service-account-secret"
        with patch.dict(os.environ, {"GOOGLE_SERVICE_ACCOUNT_JSON": bad_value}, clear=False):
            with self.assertRaisesRegex(RuntimeError, "raw service-account JSON or base64") as error:
                service_account_info()
        self.assertNotIn(bad_value, str(error.exception))


class _Request:
    def __init__(self, value):
        self.value = value

    def execute(self):
        return self.value


class _FakeValues:
    def __init__(self):
        self.append_calls = []
        self.batch_update_calls = []

    def get(self, **_kwargs):
        return _Request({"values": []})

    def append(self, **kwargs):
        self.append_calls.append(kwargs)
        return _Request({})

    def batchUpdate(self, **kwargs):
        self.batch_update_calls.append(kwargs)
        return _Request({})


class _FakeService:
    def __init__(self):
        self.values_api = _FakeValues()

    def spreadsheets(self):
        return self

    def values(self):
        return self.values_api


class GoogleSheetsBatchTests(unittest.TestCase):
    def test_batches_many_new_records_into_one_append_request(self):
        service = _FakeService()
        records = [{"event_id": f"event-{index}", "source_updated_epoch_ms": index} for index in range(122)]
        with patch("collector.google_sheets_sink.sheet_service", return_value=service):
            result = upsert_raw_records("sheet-id", records)
        self.assertEqual(result, {"appended": 122, "updated": 0, "unchanged": 0})
        self.assertEqual(len(service.values_api.append_calls), 1)
        self.assertEqual(len(service.values_api.append_calls[0]["body"]["values"]), 122)
        self.assertEqual(service.values_api.batch_update_calls, [])
