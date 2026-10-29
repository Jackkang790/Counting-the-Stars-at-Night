import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.database import connection
from app.demo import create_app
from app.demo_scenarios import TAGS, seed_demo_scenarios


class DemoScenarioTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ, {
            "DATABASE_PATH": str(Path(tmp.name) / "demo.sqlite3"),
            "DEMO_COUPON_VALID_DAYS": "14",
        })
        env.start()
        self.addCleanup(env.stop)
        self.client = TestClient(create_app())
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def coupons(self, session_id):
        return self.client.get("/api/v1/coupons", params={"session_id": session_id}).json()

    def test_walkthrough_examples_run_from_start_to_redemption(self):
        spec = self.client.get("/openapi.json").json()
        self.assertEqual([t["name"] for t in spec["tags"]], [t["name"] for t in TAGS])
        self.assertIn("tour-1", spec["info"]["description"])
        self.assertEqual(self.coupons("tour-1"), [])
        total = 0
        for spot in ["a", "b", "c"]:
            checkin = spec["paths"]["/api/v1/checkin"]["post"]["requestBody"]["content"]["application/json"]["examples"][f"tour-1-{spot}"]["value"]
            self.assertEqual(self.client.post("/api/v1/checkin", json=checkin).status_code, 200)
            for kind in ["role", "escape"]:
                path = "/api/v1/experiences/complete"
                body = spec["paths"][path]["post"]["requestBody"]["content"]["application/json"]["examples"][f"tour-1-{spot}-{kind}"]["value"]
                response = self.client.post(path, json=body)
                self.assertEqual(response.status_code, 200)
                total += 1
                self.assertEqual(response.json()["total_stars"], total)
                self.assertEqual(response.json()["coupon_issued"], total == 6)
                repeated = self.client.post(path, json=body)
                self.assertEqual(repeated.status_code, 200)
                self.assertEqual(repeated.json(), {
                    "star_awarded": False, "total_stars": total, "coupon_issued": False,
                })
        coupon = self.coupons("tour-1")[0]
        response = self.client.post("/api/v1/coupons/redeem-by-code", json={
            "code": coupon["code"], "store_id": "demo-store-1",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.coupons("tour-1")[0]["status"], "redeemed")

    def test_tours_start_empty_are_isolated_and_reseeding_preserves_results(self):
        for session_id in ["tour-1", "tour-2", "tour-3"]:
            self.assertEqual(self.coupons(session_id), [])
            self.assertEqual(self.client.get("/api/v1/stars", params={"session_id": session_id}).json(),
                             {"stars": [], "total_stars": 0})
        spec = self.client.get("/openapi.json").json()
        for tour, spot in [("tour-1", "a"), ("tour-2", "b")]:
            checkin = spec["paths"]["/api/v1/checkin"]["post"]["requestBody"]["content"]["application/json"]["examples"][f"{tour}-{spot}"]["value"]
            self.assertEqual(self.client.post("/api/v1/checkin", json=checkin).status_code, 200)
            complete = spec["paths"]["/api/v1/experiences/complete"]["post"]["requestBody"]["content"]["application/json"]["examples"][f"{tour}-{spot}-role"]["value"]
            self.assertEqual(self.client.post("/api/v1/experiences/complete", json=complete).status_code, 200)
        seed_demo_scenarios()
        for tour, spots in [("tour-1", ["a"]), ("tour-2", ["b"]), ("tour-3", [])]:
            stars = self.client.get("/api/v1/stars", params={"session_id": tour}).json()
            self.assertEqual([s["spot_id"] for s in stars["stars"]], spots)
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0], 3)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM coupons").fetchone()[0], 0)
        session = self.client.post("/api/v1/sessions").json()["session_id"]
        self.assertEqual(self.coupons(session), [])

    def test_query_examples_and_number_redemption_are_ready(self):
        spec = self.client.get("/openapi.json").json()
        self.assertNotIn("/api/v1/coupons/{coupon_id}/redeem", spec["paths"])
        self.assertNotIn("참고 · 세션으로 사용", [tag["name"] for tag in spec["tags"]])
        for path in ["/api/v1/stars", "/api/v1/coupons"]:
            param = spec["paths"][path]["get"]["parameters"][0]
            self.assertEqual(list(param["examples"]), ["tour-1", "tour-2", "tour-3"])
            for example in param["examples"].values():
                self.assertEqual(self.client.get(path, params={"session_id": example["value"]}).status_code, 200)
        body = {"session_id": "tour-1"}
        for spot in "abc":
            request = {**body, "spot_id": spot}
            self.assertEqual(self.client.post("/api/v1/checkin", json=request).status_code, 200)
            for kind in ["role", "escape"]:
                self.assertEqual(self.client.post("/api/v1/experiences/complete", json={**request, "kind": kind}).status_code, 200)
        coupon = self.coupons(body["session_id"])[0]
        path = "/api/v1/coupons/redeem-by-code"
        request = dict(spec["paths"][path]["post"]["requestBody"]["content"]["application/json"]["example"])
        request["code"] = coupon["code"]
        self.assertEqual(self.client.post(path, json=request).status_code, 200)
        self.assertEqual(self.client.post(path, json=request).status_code, 409)
