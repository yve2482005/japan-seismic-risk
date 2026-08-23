import base64
import json
import os
import unittest
from unittest.mock import patch

from collector.google_sheets_sink import service_account_info


class GoogleSheetsSecretTests(unittest.TestCase):
    def setUp(self):
        self.info = {"type": "service_account", "client_email": "collector@example.test", "private_key": "test-private-key"}

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
