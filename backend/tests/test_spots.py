import os
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import connection, init_db
from app.routers.spots import router


class SpotsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        env = patch.dict(os.environ, {
            "DATABASE_PATH": str(Path(self.tmp.name) / "nested" / "test.sqlite3")
        })
        env.start()
        self.addCleanup(env.stop)

    def test_initialization_is_idempotent_and_preserves_data(self):
        init_db()
        with connection() as db:
            db.execute("UPDATE spots SET description = ? WHERE id = ?", ("수정 내용", "a"))
        init_db()
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM spots").fetchone()[0], 3)
            self.assertEqual(
                db.execute("SELECT description FROM spots WHERE id = 'a'").fetchone()[0],
                "수정 내용",
            )

    def test_list_and_openapi_contract(self):
        @asynccontextmanager
        async def lifespan(app):
            init_db()
            yield

        app = FastAPI(lifespan=lifespan)
        app.include_router(router)
        with TestClient(app) as client:
            response = client.get("/api/v1/spots")
            self.assertEqual(response.status_code, 200)
            spots = response.json()
            self.assertEqual([s["id"] for s in spots], ["a", "b", "c"])
            self.assertEqual([s["name"] for s in spots], ["관사 16호", "관사 42호", "헤레디움"])
            self.assertEqual([s["display_order"] for s in spots], [1, 2, 3])
            self.assertEqual(set(spots[0]), {"id", "name", "description", "display_order"})
            self.assertTrue(all(isinstance(s["description"], str) for s in spots))
            spec = client.get("/openapi.json").json()
            schema = spec["paths"]["/api/v1/spots"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
            self.assertEqual(schema["type"], "array")
            self.assertEqual(schema["items"]["$ref"], "#/components/schemas/SpotResponse")
            self.assertEqual(client.get("/docs").status_code, 200)


if __name__ == "__main__":
    unittest.main()
