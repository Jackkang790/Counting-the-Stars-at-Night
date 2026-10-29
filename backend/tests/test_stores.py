import os
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import connection, init_db
from app.routers.stores import router


class StoresTests(unittest.TestCase):
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

    def test_demo_stores_contract(self):
        response = self.client.get("/api/v1/stores")
        self.assertEqual(response.status_code, 200)
        stores = response.json()
        self.assertEqual([s["id"] for s in stores], ["demo-store-1", "demo-store-2", "demo-store-3"])
        for store in stores:
            self.assertEqual(set(store), {"id", "name", "description", "display_location", "accepts_coupon", "is_demo"})
            self.assertIs(store["is_demo"], True)
            self.assertIsInstance(store["accepts_coupon"], bool)
            self.assertIn("가상", store["name"])
            self.assertIn("데모", store["display_location"])

    def test_coupon_filter_and_invalid_query(self):
        accepted = self.client.get("/api/v1/stores?accepts_coupon=true")
        rejected = self.client.get("/api/v1/stores?accepts_coupon=false")
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(len(accepted.json()), 2)
        self.assertEqual(len(rejected.json()), 1)
        self.assertTrue(all(s["accepts_coupon"] for s in accepted.json()))
        self.assertTrue(all(not s["accepts_coupon"] for s in rejected.json()))
        self.assertEqual(self.client.get("/api/v1/stores?accepts_coupon=bad").status_code, 422)

    def test_seed_preserves_existing_data(self):
        with connection() as db:
            db.execute("UPDATE stores SET name = ?, accepts_coupon = 0 WHERE id = ?",
                       ("[가상] 수정한 매장", "demo-store-1"))
        init_db()
        stores = self.client.get("/api/v1/stores").json()
        self.assertEqual(len(stores), 3)
        self.assertEqual(stores[0]["name"], "[가상] 수정한 매장")
        self.assertIs(stores[0]["accepts_coupon"], False)

    def test_empty_list(self):
        with connection() as db:
            db.execute("DELETE FROM stores")
        response = self.client.get("/api/v1/stores")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_openapi(self):
        spec = self.client.get("/openapi.json").json()
        operation = spec["paths"]["/api/v1/stores"]["get"]
        schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
        self.assertEqual(schema["type"], "array")
        self.assertEqual(schema["items"]["$ref"], "#/components/schemas/StoreResponse")
        query = operation["parameters"][0]
        self.assertEqual(query["name"], "accepts_coupon")
        self.assertFalse(query["required"])
