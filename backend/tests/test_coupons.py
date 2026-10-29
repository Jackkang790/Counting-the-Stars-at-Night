from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch

from app.config import coupon_required_stars
from app.database import init_db
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
