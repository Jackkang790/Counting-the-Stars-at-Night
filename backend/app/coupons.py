"""쿠폰 지급 서비스. 호출자의 별 지급 트랜잭션에 함께 참여한다."""

import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from .seed import DEMO_TEMPLATE_ID
from .config import coupon_valid_days


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_expired(coupon, now: datetime) -> bool:
    return now >= datetime.fromisoformat(coupon["expires_at"])


def coupon_response(coupon, now: datetime | None = None) -> dict:
    result = dict(coupon)
    if result["status"] == "issued" and is_expired(result, now or utc_now()):
        result["status"] = "expired"
    return result


def issue_coupon(db: sqlite3.Connection, session_id: str, total_stars: int) -> bool:
    template = db.execute(
        "SELECT * FROM coupon_templates WHERE id = ?", (DEMO_TEMPLATE_ID,),
    ).fetchone()
    if total_stars < template["required_stars"]:
        return False
    if db.execute(
        "SELECT 1 FROM coupons WHERE session_id = ? AND template_id = ?",
        (session_id, template["id"]),
    ).fetchone():
        return False
    # 12자리 표시용 번호. QR 인증이나 로그인 자격증명으로 사용하지 않는다.
    while True:
        code = f"{secrets.randbelow(10**12):012d}"
        if not db.execute("SELECT 1 FROM coupons WHERE code = ?", (code,)).fetchone():
            break
    issued_at = utc_now()
    expires_at = issued_at + timedelta(days=coupon_valid_days())
    db.execute(
        "INSERT INTO coupons "
        "(id, session_id, template_id, title, benefit, code, status, issued_at, expires_at) "
        "VALUES (?, ?, ?, ?, ?, ?, 'issued', ?, ?)",
        (str(uuid4()), session_id, template["id"], template["title"], template["benefit"],
         code, issued_at.isoformat(), expires_at.isoformat()),
    )
    return True
