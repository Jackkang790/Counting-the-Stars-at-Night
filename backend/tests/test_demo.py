import unittest
import os
import tempfile
from pathlib import Path
from urllib.parse import urljoin
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.demo import app
from app import __version__


class DemoDocsTests(unittest.TestCase):
    def test_docs_direct_and_under_proxy_prefix(self):
        outer = FastAPI()
        outer.mount("/proxy/8000", app)
        for target, prefix in [(app, ""), (outer, "/proxy/8000")]:
            with self.subTest(prefix=prefix):
                client = TestClient(target)
                docs_url = f"{prefix}/docs"
                response = client.get(docs_url)
                self.assertEqual(response.status_code, 200)
                self.assertIn("url: './openapi.json'", response.text)
                schema_url = urljoin(docs_url, "./openapi.json")
                schema = client.get(schema_url)
                self.assertEqual(schema.status_code, 200)
                self.assertEqual(schema.json()["servers"], [{"url": "."}])
                base = urljoin(schema_url, ".")
                health = client.get(base + "api/v1/health")
                self.assertEqual(health.status_code, 200)
                self.assertEqual(health.json()["status"], "ok")


class DemoIntegrationTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ, {
            "DATABASE_PATH": str(Path(tmp.name) / "demo.sqlite3"),
        })
        env.start()
        self.addCleanup(env.stop)
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def test_full_tour_to_coupon_redemption(self):
        self.assertEqual(self.client.get("/openapi.json").json()["info"]["version"], __version__)
        session = self.client.post("/api/v1/sessions")
        self.assertEqual(session.status_code, 201)
        session_id = session.json()["session_id"]
        spots = self.client.get("/api/v1/spots").json()
        total = 0
        for spot in spots:
            body = {"session_id": session_id, "spot_id": spot["id"]}
            self.assertEqual(self.client.post("/api/v1/checkin", json=body).status_code, 200)
            for kind in ["role", "escape"]:
                completed = self.client.post("/api/v1/experiences/complete", json={**body, "kind": kind})
                self.assertEqual(completed.status_code, 200)
                total += 1
                self.assertEqual(completed.json(), {
                    "star_awarded": True, "total_stars": total, "coupon_issued": total == 6,
                })
        params = {"session_id": session_id}
        self.assertEqual(self.client.get("/api/v1/stars", params=params).json()["total_stars"], 6)
        coupons = self.client.get("/api/v1/coupons", params=params).json()
        self.assertEqual(len(coupons), 1)
        path = '/api/v1/coupons/redeem-by-code'
        redemption = {"code": coupons[0]["code"], "store_id": "demo-store-1"}
        self.assertEqual(self.client.post(path, json=redemption).status_code, 200)
        self.assertEqual(self.client.post(path, json=redemption).status_code, 409)
        self.assertEqual(len(self.client.get("/api/v1/stores").json()), 3)

    def test_cors_allowed_and_disallowed_origins(self):
        # 실행 환경의 허용 목록과 미허용 외부 출처를 함께 검증한다.
        origins = next(m.kwargs["allow_origins"] for m in app.user_middleware
                       if m.cls.__name__ == "CORSMiddleware")
        self.assertNotIn("*", origins)
        if origins:
            response = self.client.options("/api/v1/checkin", headers={
                "Origin": origins[0], "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["access-control-allow-origin"], origins[0])
        response = self.client.options("/api/v1/checkin", headers={
            "Origin": "https://not-allowed.invalid", "Access-Control-Request-Method": "POST",
        })
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)
