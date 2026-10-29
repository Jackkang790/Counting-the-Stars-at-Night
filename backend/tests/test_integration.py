import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.database import connection
from app.integrated import ROOT, create_app, seed_frontend_tour


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ, {"DATABASE_PATH": str(Path(tmp.name) / "integration.sqlite3")})
        env.start()
        self.addCleanup(env.stop)
        self.client = TestClient(create_app())
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        self.tour = json.loads((ROOT / "shared" / "tour.json").read_text(encoding="utf-8"))
        self.sid = self.client.post("/api/v1/sessions").json()["session_id"]

    def complete(self, spot, kind):
        body = {"session_id": self.sid, "spot_id": spot}
        self.assertEqual(self.client.post("/api/v1/checkin", json=body).status_code, 200)
        return self.client.post("/api/v1/experiences/complete", json={**body, "kind": kind})

    def test_frontend_six_missions_issue_one_coupon_and_redeem_at_frontend_store(self):
        total = 0
        for spot in self.tour["spots"]:
            for kind in spot["missions"]:
                result = self.complete(spot["server"], kind)
                self.assertEqual(result.status_code, 200)
                total += 1
                self.assertEqual(result.json()["total_stars"], total)
                self.assertEqual(result.json()["coupon_issued"], total == 6)
        # 기존 role과 전시 view는 같은 별이며 일곱 번째 별을 만들지 않는다.
        self.assertFalse(self.complete("c", "role").json()["star_awarded"])
        coupons = self.client.get("/api/v1/coupons", params={"session_id": self.sid}).json()
        self.assertEqual(len(coupons), 1)
        redeemed = self.client.post("/api/v1/coupons/redeem-by-code", json={
            "code": coupons[0]["code"], "store_id": self.tour["cafes"][0]["id"],
        })
        self.assertEqual(redeemed.status_code, 200)
        self.assertEqual(redeemed.json()["store_id"], "kiko")
        self.assertEqual(redeemed.json()["status"], "redeemed")

    def test_view_is_only_supported_at_heredium_and_preserves_legacy_star(self):
        self.assertEqual(self.complete("a", "view").status_code, 422)
        self.assertTrue(self.complete("c", "role").json()["star_awarded"])
        result = self.complete("c", "view")
        self.assertFalse(result.json()["star_awarded"])
        self.assertEqual(result.json()["total_stars"], 1)

    def test_shared_places_and_stores_preserve_status_and_saved_data(self):
        spots = self.client.get("/api/v1/spots").json()
        self.assertEqual([(s["id"], s["name"]) for s in spots], [(s["server"], s["name"]) for s in self.tour["spots"]])
        stores = {s["id"]: s for s in self.client.get("/api/v1/stores").json()}
        for cafe in self.tour["cafes"]:
            self.assertEqual(stores[cafe["id"]]["name"], cafe["name"])
            self.assertTrue(stores[cafe["id"]]["accepts_coupon"])
            self.assertTrue(stores[cafe["id"]]["is_demo"])
            self.assertIsNone(stores[cafe["id"]]["hours"])
        with connection() as db:
            db.execute("UPDATE stores SET accepts_coupon=0, name='수정한 키코' WHERE id='kiko'")
        seed_frontend_tour()
        stores = {s["id"]: s for s in self.client.get("/api/v1/stores").json()}
        self.assertFalse(stores["kiko"]["accepts_coupon"])
        self.assertEqual(stores["kiko"]["name"], "수정한 키코")
        self.assertIn("demo-store-1", stores)

    def test_unknown_api_returns_json_404(self):
        response = self.client.get("/api/v1/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertIn("application/json", response.headers["content-type"])
