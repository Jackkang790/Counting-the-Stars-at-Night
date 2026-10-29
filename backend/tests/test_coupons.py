from concurrent.futures import ThreadPoolExecutor
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.config import coupon_valid_days
from app.database import connection, init_db
from app.routers.coupons import router
import test_stars


class CouponsTests(unittest.TestCase):
    new_session = test_stars.StarsTests.new_session
    checkin = test_stars.StarsTests.checkin
    complete = test_stars.StarsTests.complete
    stars = test_stars.StarsTests.stars

    def setUp(self):
        test_stars.StarsTests.setUp(self)
        self.client.app.include_router(router)

    def prepare_final_star(self):
        for spot in "abc":
            self.checkin(spot)
            for kind in ["role", "escape"]:
                if (spot, kind) != ("c", "escape"):
                    response = self.complete(spot, kind=kind)
                    self.assertEqual(response.status_code, 200)
                    self.assertFalse(response.json()["coupon_issued"])

    def coupons(self, session_id=None):
        return self.client.get("/api/v1/coupons", params={
            "session_id": session_id or self.session_id,
        })

    def earn_coupon(self):
        self.prepare_final_star()
        self.assertTrue(self.complete("c", kind="escape").json()["coupon_issued"])
        return self.coupons().json()[0]

    def redeem(self, coupon_id, session_id=None):
        return self.client.post(f"/api/v1/coupons/{coupon_id}/redeem", json={
            "session_id": session_id or self.session_id,
        })

    def test_all_six_combinations_and_issuance_once(self):
        self.assertEqual(self.coupons().json(), [])
        self.prepare_final_star()
        self.assertEqual(self.stars().json()["total_stars"], 5)
        self.assertEqual(self.coupons().json(), [])
        self.assertTrue(self.complete("c", kind="escape").json()["coupon_issued"])
        self.assertFalse(self.complete("c", kind="escape").json()["coupon_issued"])
        self.assertEqual(self.complete("a").status_code, 409)
        self.checkin("a")
        self.assertFalse(self.complete("a").json()["coupon_issued"])
        coupons = self.coupons().json()
        self.assertEqual(len(coupons), 1)
        self.assertEqual(coupons[0]["status"], "issued")
        self.assertIsNone(coupons[0]["redeemed_at"])
        self.assertRegex(coupons[0]["code"], r"^\d{12}$")
        self.assertNotIn("session_id", coupons[0])

    def test_redeem_once_and_persist(self):
        coupon = self.earn_coupon()
        response = self.redeem(coupon["id"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "redeemed")
        self.assertIsNotNone(response.json()["redeemed_at"])
        repeated = self.redeem(coupon["id"])
        self.assertEqual(repeated.status_code, 409)
        self.assertEqual(repeated.json(), {"detail": "already_redeemed"})
        init_db()
        self.assertEqual(self.coupons().json(), [response.json()])
        self.assertFalse(self.complete("c", kind="escape").json()["coupon_issued"])

    def test_coupon_session_isolation_and_errors(self):
        coupon = self.earn_coupon()
        second = self.new_session()
        self.assertEqual(self.coupons(second).json(), [])
        response = self.redeem(coupon["id"], second)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "coupon_not_found"})
        self.assertEqual(self.redeem("missing").status_code, 404)
        self.assertEqual(self.redeem(coupon["id"], "missing").json(), {"detail": "session_not_found"})
        self.assertEqual(self.coupons("missing").status_code, 404)
        self.assertEqual(self.client.get("/api/v1/coupons").status_code, 422)
        self.assertEqual(self.client.post(f'/api/v1/coupons/{coupon["id"]}/redeem', json={}).status_code, 422)
        self.assertEqual(self.coupons().json()[0]["status"], "issued")

    def test_concurrent_coupon_issue(self):
        self.prepare_final_star()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.complete("c", kind="escape"), range(4)))
        self.assertTrue(all(r.status_code == 200 for r in results))
        self.assertEqual(sum(r.json()["coupon_issued"] for r in results), 1)
        self.assertEqual(len(self.coupons().json()), 1)

    def test_concurrent_redeem_once(self):
        coupon = self.earn_coupon()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.redeem(coupon["id"]), range(4)))
        self.assertEqual(sorted(r.status_code for r in results), [200, 409, 409, 409])

    def test_issuance_failure_rolls_back_star(self):
        self.prepare_final_star()
        with patch("app.routers.stars.issue_coupon", side_effect=RuntimeError("test failure")):
            with self.assertRaises(RuntimeError):
                self.complete("c", kind="escape")
        self.assertEqual(self.stars().json()["total_stars"], 5)
        self.assertEqual(self.coupons().json(), [])
        self.assertTrue(self.complete("c", kind="escape").json()["coupon_issued"])

    def test_config_change_preserves_issued_benefit(self):
        coupon = self.earn_coupon()
        with patch.dict("os.environ", {"DEMO_COUPON_TITLE": "changed", "DEMO_COUPON_BENEFIT": "changed benefit"}):
            init_db()
            second = self.new_session()
            for spot in "abc":
                self.checkin(spot, session_id=second)
                for kind in ["role", "escape"]:
                    self.complete(spot, session_id=second, kind=kind)
            self.assertEqual(self.coupons(second).json()[0]["title"], "changed")
            self.assertEqual(self.coupons(second).json()[0]["benefit"], "changed benefit")
        self.assertEqual(self.coupons().json()[0], coupon)

    def test_coupon_openapi(self):
        spec = self.client.get("/openapi.json").json()
        self.assertNotIn("/api/v1/coupons/{coupon_id}/redeem", spec["paths"])
        redeem = spec["paths"]["/api/v1/coupons/redeem-by-code"]["post"]
        self.assertIn("409", redeem["responses"])
        self.assertEqual(redeem["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
                         "#/components/schemas/CouponResponse")
        self.assertEqual(spec["paths"]["/api/v1/coupons"]["get"]["responses"]["200"]
                         ["content"]["application/json"]["schema"]["type"], "array")

    def redeem_code(self, code, store_id="demo-store-1"):
        return self.client.post("/api/v1/coupons/redeem-by-code", json={
            "code": code, "store_id": store_id,
        })

    def test_redeem_by_code_records_store_without_session(self):
        coupon = self.earn_coupon()
        self.assertIsNone(coupon["store_id"])
        response = self.redeem_code(coupon["code"])
        self.assertEqual(response.status_code, 200)
        used = response.json()
        self.assertEqual(used["id"], coupon["id"])
        self.assertEqual(used["status"], "redeemed")
        self.assertEqual(used["store_id"], "demo-store-1")
        self.assertIsNotNone(used["redeemed_at"])
        self.assertNotIn("session_id", used)
        self.assertEqual(self.redeem(coupon["id"]).status_code, 409)
        self.assertEqual(self.redeem_code(coupon["code"], "demo-store-2").status_code, 409)
        init_db()
        self.assertEqual(self.coupons().json(), [used])

    def test_redeem_by_code_rejects_store_and_unknown_coupon(self):
        coupon = self.earn_coupon()
        for store_id, status, detail in [
            ("missing", 404, "store_not_found"),
            ("demo-store-3", 409, "store_not_accepting_coupon"),
        ]:
            response = self.redeem_code(coupon["code"], store_id)
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.json(), {"detail": detail})
            self.assertEqual(self.coupons().json()[0], coupon)
        unknown_code = "000000000000" if coupon["code"] != "000000000000" else "000000000001"
        response = self.redeem_code(unknown_code)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "coupon_not_found"})

    def test_redeem_by_code_validates_ascii_12_digit_string(self):
        coupon = self.earn_coupon()
        for code in [123456789012, "123", "1234567890123", "abcdefghijkl",
                     "１２３４５６７８９０１２", " 123456789012", None]:
            self.assertEqual(self.redeem_code(code).status_code, 422)
        for body in [{}, {"code": coupon["code"]}, {"code": coupon["code"], "store_id": ""}]:
            self.assertEqual(self.client.post("/api/v1/coupons/redeem-by-code", json=body).status_code, 422)
        self.assertEqual(self.coupons().json()[0], coupon)
        with connection() as db:
            db.execute("UPDATE coupons SET code = '000000000001' WHERE id = ?", (coupon["id"],))
        self.assertEqual(self.redeem_code("000000000001").status_code, 200)

    def test_both_redemption_routes_share_one_use(self):
        coupon = self.earn_coupon()
        actions = [
            lambda: self.redeem_code(coupon["code"], "demo-store-1"),
            lambda: self.redeem_code(coupon["code"], "demo-store-2"),
            lambda: self.redeem(coupon["id"]),
            lambda: self.redeem(coupon["id"]),
        ]
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda action: action(), actions))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409, 409, 409])
        winner = next(r.json() for r in responses if r.status_code == 200)
        self.assertEqual(self.coupons().json(), [winner])

    def test_v010_coupon_table_migration_preserves_data(self):
        coupon = self.earn_coupon()
        # v0.1.0 형식(store_id 없음)으로 실제 쿠폰을 보관한 뒤 초기화를 반복한다.
        with connection() as db:
            db.execute("CREATE TABLE coupon_templates (id TEXT PRIMARY KEY)")
            db.execute("INSERT INTO coupon_templates VALUES ('demo-cafe')")
            db.execute("""
                CREATE TABLE old_coupons (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES sessions(id),
                    template_id TEXT NOT NULL REFERENCES coupon_templates(id),
                    title TEXT NOT NULL, benefit TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL CHECK(status IN ('issued', 'redeemed')),
                    issued_at TEXT NOT NULL, redeemed_at TEXT,
                    UNIQUE(session_id, template_id)
                )
            """)
            db.execute("INSERT INTO old_coupons SELECT id, session_id, 'demo-cafe', title, "
                       "benefit, code, status, issued_at, redeemed_at FROM coupons")
            db.execute("DROP TABLE coupons")
            db.execute("ALTER TABLE old_coupons RENAME TO coupons")
        init_db()
        init_db()
        self.assertEqual(self.coupons().json(), [coupon])
        self.assertEqual(self.redeem_code(coupon["code"]).status_code, 200)

    def test_redeem_by_code_openapi(self):
        spec = self.client.get("/openapi.json").json()
        operation = spec["paths"]["/api/v1/coupons/redeem-by-code"]["post"]
        self.assertEqual(operation["requestBody"]["content"]["application/json"]["schema"]["$ref"],
                         "#/components/schemas/RedeemByCodeRequest")
        self.assertIn("404", operation["responses"])
        self.assertIn("409", operation["responses"])
        self.assertEqual(set(spec["components"]["schemas"]["RedeemByCodeRequest"]["required"]),
                         {"code", "store_id"})

    def test_expiry_from_issue_time_and_setting_changes(self):
        issued = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)
        with patch.dict("os.environ", {"DEMO_COUPON_VALID_DAYS": "2"}), \
                patch("app.coupons.utc_now", return_value=issued):
            coupon = self.earn_coupon()
        self.assertEqual(datetime.fromisoformat(coupon["expires_at"]), issued + timedelta(days=2))
        with patch.dict("os.environ", {"DEMO_COUPON_VALID_DAYS": "30"}):
            init_db()
        self.assertEqual(self.coupons().json()[0]["expires_at"], coupon["expires_at"])
        for invalid in ["0", "-1", "bad", "36501"]:
            with patch.dict("os.environ", {"DEMO_COUPON_VALID_DAYS": invalid}):
                with self.assertRaises(ValueError):
                    coupon_valid_days()
                with self.assertRaises(ValueError):
                    init_db()

    def test_expiry_boundary_and_both_redemption_routes(self):
        coupon = self.earn_coupon()
        expiry = datetime.fromisoformat(coupon["expires_at"])
        with patch("app.coupons.utc_now", return_value=expiry - timedelta(microseconds=1)):
            self.assertEqual(self.coupons().json()[0]["status"], "issued")
        for at in [expiry, expiry + timedelta(days=1)]:
            with patch("app.coupons.utc_now", return_value=at):
                expired = self.coupons().json()[0]
                self.assertEqual(expired["status"], "expired")
                self.assertIsNone(expired["redeemed_at"])
                self.assertIsNone(expired["store_id"])
                for response in [self.redeem(coupon["id"]), self.redeem_code(coupon["code"])]:
                    self.assertEqual(response.status_code, 410)
                    self.assertEqual(response.json(), {"detail": "coupon_expired"})
                self.assertFalse(self.complete("c", kind="escape").json()["coupon_issued"])
        with connection() as db:
            stored = db.execute("SELECT redeemed_at, store_id FROM coupons WHERE id = ?", (coupon["id"],)).fetchone()
            self.assertIsNone(stored["redeemed_at"])
            self.assertIsNone(stored["store_id"])

    def test_redeem_just_before_expiry_stays_redeemed_afterwards(self):
        coupon = self.earn_coupon()
        expiry = datetime.fromisoformat(coupon["expires_at"])
        with patch("app.coupons.utc_now", return_value=expiry - timedelta(microseconds=1)):
            response = self.redeem_code(coupon["code"])
            self.assertEqual(response.status_code, 200)
        with patch("app.coupons.utc_now", return_value=expiry + timedelta(days=1)):
            self.assertEqual(self.coupons().json(), [response.json()])
            self.assertEqual(self.redeem(coupon["id"]).status_code, 409)
            self.assertEqual(self.redeem_code(coupon["code"]).status_code, 409)

    def test_expired_concurrent_redemptions_never_succeed(self):
        coupon = self.earn_coupon()
        expiry = datetime.fromisoformat(coupon["expires_at"])
        with patch("app.coupons.utc_now", return_value=expiry):
            actions = [lambda: self.redeem_code(coupon["code"]), lambda: self.redeem(coupon["id"])]
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda action: action(), actions))
            self.assertTrue(all(r.status_code == 410 for r in responses))
            self.assertIsNone(self.coupons().json()[0]["redeemed_at"])

    def test_expiry_openapi_contract(self):
        spec = self.client.get("/openapi.json").json()
        schema = spec["components"]["schemas"]["CouponResponse"]
        self.assertIn("expires_at", schema["required"])
        self.assertEqual(schema["properties"]["expires_at"]["format"], "date-time")
        self.assertIn("expired", schema["properties"]["status"]["enum"])
        for path in ["/api/v1/coupons/redeem-by-code"]:
            self.assertIn("410", spec["paths"][path]["post"]["responses"])
