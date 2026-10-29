import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.database import connection, init_db


class MigrationTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.path = Path(tmp.name) / "legacy.sqlite3"
        env = patch.dict(os.environ, {
            "DATABASE_PATH": str(self.path), "DEMO_COUPON_VALID_DAYS": "14",
        })
        env.start()
        self.addCleanup(env.stop)
        init_db()
        with connection() as db:
            db.execute("INSERT INTO sessions VALUES ('legacy-session', '2030-01-01T00:00:00+00:00')")
            db.execute("DROP TABLE stars")
            db.execute("CREATE TABLE stars (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id), "
                       "spot_id TEXT REFERENCES spots(id), amount INTEGER, created_at TEXT)")
            db.execute("INSERT INTO stars VALUES ('old-star', 'legacy-session', 'a', 2, '2030-01-01T00:00:00+00:00')")
            db.execute("DROP TABLE coupons")
            db.execute("CREATE TABLE coupon_templates (id TEXT PRIMARY KEY)")
            db.execute("INSERT INTO coupon_templates VALUES ('first'), ('second')")
            db.execute("CREATE TABLE coupons (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id), "
                       "template_id TEXT REFERENCES coupon_templates(id), title TEXT, benefit TEXT, "
                       "code TEXT UNIQUE, status TEXT, issued_at TEXT, expires_at TEXT, "
                       "redeemed_at TEXT, store_id TEXT REFERENCES stores(id))")
            db.execute("INSERT INTO coupons VALUES ('old-coupon', 'legacy-session', 'first', 'title', 'benefit', "
                       "'000000000001', 'redeemed', '2030-01-01T00:00:00+00:00', "
                       "'2030-01-10T00:00:00+00:00', '2030-01-02T00:00:00+00:00', 'demo-store-1')")

    def test_legacy_records_preserved_without_inventing_completions(self):
        with connection() as db:
            old_coupon = dict(db.execute("SELECT * FROM coupons").fetchone())
        init_db()
        init_db()
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM stars").fetchone()[0], 0)
            old_star = db.execute("SELECT * FROM legacy_stars_v020").fetchone()
            self.assertEqual((old_star["id"], old_star["amount"]), ("old-star", 2))
            coupon = dict(db.execute("SELECT * FROM coupons").fetchone())
            self.assertEqual(coupon, {k: v for k, v in old_coupon.items() if k != "template_id"})
            self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])
            tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertNotIn("coupon_templates", tables)
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO stars VALUES ('invalid', 'legacy-session', 'a', 'other', 'now')")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO coupons SELECT 'duplicate', session_id, title, benefit, '000000000002', "
                           "status, issued_at, expires_at, redeemed_at, store_id FROM coupons")

    def test_duplicate_session_coupons_abort_and_rollback_all_schema_changes(self):
        with connection() as db:
            db.execute("INSERT INTO coupons SELECT 'second-coupon', session_id, 'second', title, benefit, "
                       "'000000000002', status, issued_at, expires_at, redeemed_at, store_id FROM coupons")
        with self.assertRaisesRegex(RuntimeError, "한 세션에 여러 쿠폰"):
            init_db()
        with connection() as db:
            self.assertIn("amount", {r["name"] for r in db.execute("PRAGMA table_info(stars)")})
            self.assertEqual(db.execute("SELECT COUNT(*) FROM coupons").fetchone()[0], 2)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM stars").fetchone()[0], 1)
            tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertNotIn("legacy_stars_v020", tables)
            self.assertNotIn("coupons_next", tables)
            self.assertIn("coupon_templates", tables)

    def test_missing_expiry_backfilled_once(self):
        with connection() as db:
            db.execute("UPDATE coupons SET expires_at = NULL")
        init_db()
        with patch.dict(os.environ, {"DEMO_COUPON_VALID_DAYS": "30"}):
            init_db()
        with connection() as db:
            self.assertEqual(db.execute("SELECT expires_at FROM coupons").fetchone()[0],
                             "2030-01-15T00:00:00+00:00")

    def test_multiple_visits_keep_latest_location_and_enforce_one_per_session(self):
        with connection() as db:
            db.execute("DROP INDEX visits_one_per_session")
            # 날짜가 같으면 마지막 삽입 행, 더 오래된 행은 나중에 넣어도 제외한다.
            for spot, date in [("a", "2030-01-02"), ("b", "2030-01-02"), ("c", "2030-01-01")]:
                db.execute("INSERT INTO visits VALUES (?, 'legacy-session', ?, ?)",
                           (f"visit-{spot}", spot, date + "T00:00:00+00:00"))
        init_db()
        init_db()
        with connection() as db:
            rows = db.execute("SELECT spot_id FROM visits WHERE session_id = 'legacy-session'").fetchall()
            self.assertEqual([r["spot_id"] for r in rows], ["b"])
            self.assertEqual(db.execute("SELECT COUNT(*) FROM coupons").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM legacy_stars_v020").fetchone()[0], 1)
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO visits VALUES ('another', 'legacy-session', 'c', 'now')")
