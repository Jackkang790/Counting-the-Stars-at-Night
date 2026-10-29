import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import connection, init_db
from app.routers.sessions import router as sessions_router
from app.routers.stars import router as stars_router


class StarsTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ, {
            "DATABASE_PATH": str(Path(tmp.name) / "test.sqlite3"),
            "DEMO_COUPON_VALID_DAYS": "14",
        })
        env.start()
        self.addCleanup(env.stop)

        @asynccontextmanager
        async def lifespan(app):
            init_db()
            yield

        app = FastAPI(lifespan=lifespan)
        app.include_router(sessions_router)
        app.include_router(stars_router)
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        self.session_id = self.new_session()

    def new_session(self):
        return self.client.post("/api/v1/sessions").json()["session_id"]

    def checkin(self, spot_id="a", session_id=None):
        response = self.client.post("/api/v1/checkin", json={
            "session_id": session_id or self.session_id, "spot_id": spot_id,
        })
        self.assertEqual(response.status_code, 200)

    def complete(self, spot_id="a", session_id=None, kind="role"):
        return self.client.post("/api/v1/experiences/complete", json={
            "session_id": session_id or self.session_id, "spot_id": spot_id, "kind": kind,
        })

    def stars(self, session_id=None):
        return self.client.get("/api/v1/stars", params={
            "session_id": session_id or self.session_id,
        })

    def test_award_duplicate_persistence_and_order(self):
        self.assertEqual(self.stars().json(), {"stars": [], "total_stars": 0})
        for i, spot_id in enumerate(["c", "a", "b"], start=1):
            self.checkin(spot_id)
            response = self.complete(spot_id)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {
                "star_awarded": True, "total_stars": i, "coupon_issued": False,
            })
        self.assertEqual(self.complete("b").json(), {
            "star_awarded": False, "total_stars": 3, "coupon_issued": False,
        })
        init_db()
        payload = self.stars().json()
        self.assertEqual(payload["total_stars"], 3)
        self.assertEqual([s["spot_id"] for s in payload["stars"]], ["a", "b", "c"])
        self.assertTrue(all(s["kind"] == "role" and s["created_at"] for s in payload["stars"]))

    def test_switching_location_blocks_previous_spot_and_preserves_stars(self):
        self.checkin("a")
        self.assertEqual(self.complete("a").json()["total_stars"], 1)
        self.checkin("b")
        for kind in ["role", "escape"]:
            response = self.complete("a", kind=kind)
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json(), {"detail": "checkin_required"})
        self.assertEqual(self.complete("c").status_code, 409)
        self.assertEqual(self.complete("b").json()["total_stars"], 2)
        init_db()
        self.assertEqual(self.complete("a", kind="escape").status_code, 409)
        self.assertEqual(self.stars().json()["total_stars"], 2)
        self.checkin("a")
        self.assertFalse(self.complete("a").json()["star_awarded"])
        self.assertEqual(self.complete("a", kind="escape").json()["total_stars"], 3)
        self.assertEqual(self.complete("b", kind="escape").status_code, 409)

    def test_session_isolation_and_required_visit(self):
        self.checkin()
        self.complete()
        second = self.new_session()
        response = self.complete(session_id=second)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"detail": "checkin_required"})
        self.assertEqual(self.stars(second).json(), {"stars": [], "total_stars": 0})
        self.checkin(session_id=second)
        self.assertTrue(self.complete(session_id=second).json()["star_awarded"])
        self.assertEqual(self.stars().json()["total_stars"], 1)

    def test_errors_do_not_write_stars(self):
        for spot_id, session_id, status, detail in [
            ("a", "unknown", 404, "session_not_found"),
            ("unknown", self.session_id, 404, "spot_not_found"),
            ("a", self.session_id, 409, "checkin_required"),
        ]:
            response = self.complete(spot_id, session_id)
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.json(), {"detail": detail})
        self.assertEqual(self.stars("unknown").status_code, 404)
        self.assertEqual(self.client.get("/api/v1/stars").status_code, 422)
        self.assertEqual(self.client.get("/api/v1/stars?session_id=").status_code, 422)
        for body in [{}, {"session_id": self.session_id, "spot_id": ""}]:
            self.assertEqual(self.client.post("/api/v1/experiences/complete", json=body).status_code, 422)
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM stars").fetchone()[0], 0)

    def test_concurrent_completions_award_once(self):
        self.checkin()
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda _: self.complete(), range(4)))
        self.assertTrue(all(r.status_code == 200 for r in responses))
        self.assertEqual(sum(r.json()["star_awarded"] for r in responses), 1)
        self.assertTrue(all(r.json()["total_stars"] == 1 for r in responses))

    def test_kinds_are_separate_and_invalid_kinds_do_not_award(self):
        self.checkin()
        self.assertEqual(self.complete(kind="escape").json()["total_stars"], 1)
        self.assertEqual(self.complete(kind="role").json()["total_stars"], 2)
        self.assertFalse(self.complete().json()["star_awarded"])
        for kind in ["unknown", "ROLE", "", None]:
            self.assertEqual(self.complete(kind=kind).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/experiences/complete", json={
            "session_id": self.session_id, "spot_id": "a",
        }).status_code, 422)
        self.assertEqual(self.stars().json()["total_stars"], 2)
        self.assertEqual([s["kind"] for s in self.stars().json()["stars"]], ["role", "escape"])

    def test_openapi_contract(self):
        spec = self.client.get("/openapi.json").json()
        complete = spec["paths"]["/api/v1/experiences/complete"]["post"]
        self.assertEqual(complete["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
                         "#/components/schemas/CompleteResponse")
        self.assertIn("409", complete["responses"])
        request = spec["components"]["schemas"]["CompleteRequest"]
        self.assertIn("kind", request["required"])
        self.assertEqual(request["properties"]["kind"]["enum"], ["role", "escape", "view"])
        query = spec["paths"]["/api/v1/stars"]["get"]["parameters"][0]
        self.assertEqual(query["name"], "session_id")
        self.assertTrue(query["required"])


if __name__ == "__main__":
    unittest.main()
