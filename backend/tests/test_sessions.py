import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import connection, init_db
from app.routers.sessions import router


class SessionsTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ, {"DATABASE_PATH": str(Path(tmp.name) / "test.sqlite3")})
        env.start()
        self.addCleanup(env.stop)

        @asynccontextmanager
        async def lifespan(app):
            init_db()
            yield

        app = FastAPI(lifespan=lifespan)
        app.include_router(router)
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def new_session(self):
        response = self.client.post("/api/v1/sessions")
        self.assertEqual(response.status_code, 201)
        session_id = response.json()["session_id"]
        UUID(session_id)
        return session_id

    def test_session_persistence_and_unique_ids(self):
        first, second = self.new_session(), self.new_session()
        self.assertNotEqual(first, second)
        init_db()
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0], 2)

    def test_checkin_without_gps_is_idempotent_and_session_scoped(self):
        first, second = self.new_session(), self.new_session()
        for session_id, spot_id in [(first, "a"), (first, "a"), (first, "b"), (second, "a")]:
            response = self.client.post("/api/v1/checkin", json={
                "session_id": session_id, "spot_id": spot_id,
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"spot_id": spot_id, "arrived": True})
        init_db()
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM visits").fetchone()[0], 2)
            self.assertEqual(db.execute("SELECT spot_id FROM visits WHERE session_id = ?", (first,)).fetchone()[0], "b")
            self.assertEqual(db.execute("SELECT spot_id FROM visits WHERE session_id = ?", (second,)).fetchone()[0], "a")

    def test_same_spot_retry_preserves_record_and_invalid_switch_preserves_location(self):
        session_id = self.new_session()
        body = {"session_id": session_id, "spot_id": "a"}
        self.assertEqual(self.client.post("/api/v1/checkin", json=body).status_code, 200)
        with connection() as db:
            before = dict(db.execute("SELECT * FROM visits WHERE session_id = ?", (session_id,)).fetchone())
        self.assertEqual(self.client.post("/api/v1/checkin", json=body).status_code, 200)
        self.assertEqual(self.client.post("/api/v1/checkin", json={**body, "spot_id": "unknown"}).status_code, 404)
        with connection() as db:
            after = dict(db.execute("SELECT * FROM visits WHERE session_id = ?", (session_id,)).fetchone())
        self.assertEqual(before, after)

    def test_concurrent_checkins_keep_one_current_location(self):
        session_id = self.new_session()
        with ThreadPoolExecutor(max_workers=3) as pool:
            responses = list(pool.map(lambda spot: self.client.post("/api/v1/checkin", json={
                "session_id": session_id, "spot_id": spot,
            }), "abc"))
        self.assertTrue(all(response.status_code == 200 for response in responses))
        with connection() as db:
            rows = db.execute("SELECT spot_id FROM visits WHERE session_id = ?", (session_id,)).fetchall()
            self.assertEqual(len(rows), 1)
            self.assertIn(rows[0]["spot_id"], "abc")

    def test_missing_resources_and_invalid_input(self):
        session_id = self.new_session()
        for body, detail in [
            ({"session_id": "unknown", "spot_id": "a"}, "session_not_found"),
            ({"session_id": session_id, "spot_id": "unknown"}, "spot_not_found"),
        ]:
            response = self.client.post("/api/v1/checkin", json=body)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json(), {"detail": detail})
        for body in [{}, {"session_id": "", "spot_id": "a"},
                     {"session_id": session_id, "spot_id": None}]:
            self.assertEqual(self.client.post("/api/v1/checkin", json=body).status_code, 422)
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM visits").fetchone()[0], 0)

    def test_openapi_contract(self):
        spec = self.client.get("/openapi.json").json()
        sessions = spec["paths"]["/api/v1/sessions"]["post"]
        self.assertIn("201", sessions["responses"])
        checkin = spec["paths"]["/api/v1/checkin"]["post"]
        self.assertEqual(checkin["requestBody"]["content"]["application/json"]["schema"]["$ref"],
                         "#/components/schemas/CheckinRequest")
        self.assertIn("404", checkin["responses"])
        self.assertIn("422", checkin["responses"])


if __name__ == "__main__":
    unittest.main()
