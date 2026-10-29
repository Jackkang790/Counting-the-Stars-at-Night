import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.demo import create_app


class CorsTests(unittest.TestCase):
    def client(self, origins=None):
        with patch.dict(os.environ):
            if origins is None:
                os.environ.pop("CORS_ORIGINS", None)
            else:
                os.environ["CORS_ORIGINS"] = origins
            return TestClient(create_app())

    def preflight(self, client, origin, method="POST"):
        return client.options("/api/v1/checkin", headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type",
        })

    def test_default_dev_and_preview_origins(self):
        client = self.client()
        for origin in ["http://localhost:5173", "http://127.0.0.1:5173",
                       "http://localhost:4173", "http://127.0.0.1:4173"]:
            with self.subTest(origin=origin):
                response = self.preflight(client, origin)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["access-control-allow-origin"], origin)
                actual = client.get("/api/v1/health", headers={"Origin": origin})
                self.assertEqual(actual.status_code, 200)
                self.assertEqual(actual.headers["access-control-allow-origin"], origin)

    def test_custom_origins_replace_defaults(self):
        client = self.client(" https://demo.example.test , , https://demo.example.test ")
        self.assertEqual(self.preflight(client, "https://demo.example.test").status_code, 200)
        response = self.preflight(client, "http://localhost:4173")
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_unlisted_origins_and_methods(self):
        client = self.client()
        for origin in ["https://localhost:4173", "http://localhost:9999", "https://not-allowed.invalid"]:
            self.assertEqual(self.preflight(client, origin).status_code, 400)
            actual = client.get("/api/v1/health", headers={"Origin": origin})
            self.assertNotIn("access-control-allow-origin", actual.headers)
        self.assertEqual(self.preflight(client, "http://localhost:4173", "DELETE").status_code, 400)

    def test_empty_list_disables_cross_origin_access(self):
        client = self.client(" , ")
        self.assertEqual(self.preflight(client, "http://localhost:4173").status_code, 400)
        self.assertEqual(client.get("/api/v1/health").status_code, 200)
