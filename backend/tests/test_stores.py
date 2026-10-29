import os
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timedelta, timezone

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
            self.assertEqual(set(store), {"id", "name", "description", "display_location", "accepts_coupon", "is_demo",
                                          "lat", "lng", "hours", "open_now", "night"})
            self.assertIs(store["is_demo"], True)
            self.assertIsInstance(store["accepts_coupon"], bool)
            self.assertIn("가상", store["name"])
            self.assertIn("데모", store["display_location"])
            self.assertIsInstance(store["lat"], float)
            self.assertIsInstance(store["lng"], float)
            self.assertRegex(store["hours"], r"^\d{2}:\d{2}–\d{2}:\d{2}$")
            self.assertIsInstance(store["open_now"], bool)
            self.assertIsInstance(store["night"], bool)

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

    def at_kst(self, hour, minute=0):
        return patch("app.stores.utc_now", return_value=datetime(
            2030, 1, 2, hour, minute, tzinfo=timezone(timedelta(hours=9)),
        ).astimezone(timezone.utc))

    def test_opening_closing_and_overnight_boundaries(self):
        for hour, minute, expected in [
            (10, 59, [False, False, True]),
            (11, 0, [True, False, True]),
            (21, 59, [True, True, False]),
            (22, 0, [False, True, False]),
            (0, 0, [False, True, False]),
            (1, 59, [False, True, False]),
            (2, 0, [False, False, False]),
        ]:
            with self.subTest(hour=hour, minute=minute), self.at_kst(hour, minute):
                stores = self.client.get("/api/v1/stores").json()
                self.assertEqual([s["open_now"] for s in stores], expected)
                self.assertEqual([s["night"] for s in stores], [True, True, False])

    def test_combined_filters_and_invalid_values(self):
        with self.at_kst(21):
            response = self.client.get("/api/v1/stores?accepts_coupon=true&open_now=true&night=true")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json()), 2)
            self.assertEqual(self.client.get("/api/v1/stores?open_now=true&night=false").json(), [])
        for field in ["open_now", "night"]:
            self.assertEqual(self.client.get(f"/api/v1/stores?{field}=bad").status_code, 422)
        with self.at_kst(10):
            self.assertEqual(len(self.client.get("/api/v1/stores?open_now=false").json()), 2)
            self.assertEqual(len(self.client.get("/api/v1/stores?night=false").json()), 1)

    def test_preserve_custom_details_and_unknown_information(self):
        with connection() as db:
            db.execute("UPDATE stores SET lat=36.1, lng=127.1, opens_at='10:00', closes_at='21:00' "
                       "WHERE id='demo-store-1'")
            db.execute("UPDATE stores SET is_demo=0, lat=NULL, lng=NULL, opens_at=NULL, closes_at=NULL "
                       "WHERE id='demo-store-2'")
        init_db()
        with self.at_kst(20):
            stores = self.client.get("/api/v1/stores").json()
            self.assertEqual(stores[0]["lat"], 36.1)
            self.assertEqual(stores[0]["hours"], "10:00–21:00")
            self.assertFalse(stores[0]["night"])
            self.assertTrue(stores[0]["open_now"])
            for field in ["lat", "lng", "hours", "open_now", "night"]:
                self.assertIsNone(stores[1][field])
            filtered = self.client.get("/api/v1/stores?open_now=false").json()
            self.assertNotIn("demo-store-2", [s["id"] for s in filtered])

    def test_legacy_store_schema_migration(self):
        # 쿠폰의 store_id 외래키가 가리키는 stores 이름을 유지한 채 과거 DB를 재현한다.
        with connection() as db:
            for column in ["lat", "lng", "opens_at", "closes_at"]:
                db.execute(f"ALTER TABLE stores DROP COLUMN {column}")
            db.execute("UPDATE stores SET name='[가상] 기존 이름', accepts_coupon=0 WHERE id='demo-store-1'")
        init_db()
        init_db()
        stores = self.client.get("/api/v1/stores").json()
        self.assertEqual(len(stores), 3)
        self.assertEqual(stores[0]["name"], "[가상] 기존 이름")
        self.assertFalse(stores[0]["accepts_coupon"])
        self.assertIsNotNone(stores[0]["lat"])
        self.assertEqual(stores[0]["hours"], "11:00–22:00")
