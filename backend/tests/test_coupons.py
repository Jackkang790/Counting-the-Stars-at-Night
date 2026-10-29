from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch

from app.config import coupon_required_stars
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

    def enable_coupon(self, required="2"):
        with patch.dict("os.environ", {"DEMO_COUPON_REQUIRED_STARS": required}):
            init_db()

    def coupons(self, session_id=None):
        return self.client.get("/api/v1/coupons", params={
            "session_id": session_id or self.session_id,
        })

    def earn_coupon(self):
        self.enable_coupon("1")
        self.checkin()
        self.assertTrue(self.complete().json()["coupon_issued"])
        return self.coupons().json()[0]

    def redeem(self, coupon_id, session_id=None):
        return self.client.post(f"/api/v1/coupons/{coupon_id}/redeem", json={
            "session_id": session_id or self.session_id,
        })

    def test_threshold_and_issuance_once(self):
        self.enable_coupon()
        self.assertEqual(self.coupons().json(), [])
        self.checkin("a")
        self.assertFalse(self.complete("a").json()["coupon_issued"])
        self.checkin("b")
        self.assertTrue(self.complete("b").json()["coupon_issued"])
        self.assertFalse(self.complete("b").json()["coupon_issued"])
        self.checkin("c")
        self.assertFalse(self.complete("c").json()["coupon_issued"])
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
        self.assertFalse(self.complete().json()["coupon_issued"])

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
        self.enable_coupon("1")
        self.checkin("a")
        self.checkin("b")
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(self.complete, ["a", "b", "a", "b"]))
        self.assertTrue(all(r.status_code == 200 for r in results))
        self.assertEqual(sum(r.json()["coupon_issued"] for r in results), 1)
        self.assertEqual(len(self.coupons().json()), 1)

    def test_concurrent_redeem_once(self):
        coupon = self.earn_coupon()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.redeem(coupon["id"]), range(4)))
        self.assertEqual(sorted(r.status_code for r in results), [200, 409, 409, 409])

    def test_issuance_failure_rolls_back_star(self):
        self.enable_coupon("1")
        self.checkin()
        with patch("app.routers.stars.issue_coupon", side_effect=RuntimeError("test failure")):
            with self.assertRaises(RuntimeError):
                self.complete()
        self.assertEqual(self.stars().json()["total_stars"], 0)
        self.assertEqual(self.coupons().json(), [])
        self.assertTrue(self.complete().json()["coupon_issued"])

    def test_config_change_preserves_issued_benefit(self):
        coupon = self.earn_coupon()
        with patch.dict("os.environ", {"DEMO_COUPON_TITLE": "changed", "DEMO_COUPON_REQUIRED_STARS": "3"}):
            init_db()
        self.assertEqual(self.coupons().json()[0], coupon)
        for value in ["0", "-1", "bad"]:
            with patch.dict("os.environ", {"DEMO_COUPON_REQUIRED_STARS": value}):
                with self.assertRaises(ValueError):
                    coupon_required_stars()

    def test_coupon_openapi(self):
        spec = self.client.get("/openapi.json").json()
        redeem = spec["paths"]["/api/v1/coupons/{coupon_id}/redeem"]["post"]
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
            db.execute("INSERT INTO old_coupons SELECT id, session_id, template_id, title, "
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
