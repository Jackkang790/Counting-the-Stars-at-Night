import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_db
from ..schemas.coupon import CouponResponse, RedeemRequest
from ..schemas.session import ErrorResponse

router = APIRouter(prefix="/api/v1", tags=["coupons"])


def require_session(db: sqlite3.Connection, session_id: str) -> None:
    if not db.execute("SELECT 1 FROM sessions WHERE id = ?", (session_id,)).fetchone():
        raise HTTPException(status_code=404, detail="session_not_found")


@router.get(
    "/coupons", response_model=list[CouponResponse],
    responses={404: {"model": ErrorResponse, "description": "세션 없음"}},
    summary="세션별 쿠폰 목록",
)
def list_coupons(
    session_id: str = Query(min_length=1, max_length=128),
    db: sqlite3.Connection = Depends(get_db),
):
    require_session(db, session_id)
    rows = db.execute(
        "SELECT * FROM coupons WHERE session_id = ? ORDER BY issued_at, id", (session_id,),
    ).fetchall()
    return [dict(row) for row in rows]


@router.post(
    "/coupons/{coupon_id}/redeem", response_model=CouponResponse,
    responses={
        404: {"model": ErrorResponse, "description": "세션 또는 해당 세션의 쿠폰 없음"},
        409: {"model": ErrorResponse, "description": "이미 사용한 쿠폰"},
    },
    summary="데모 쿠폰 1회 사용",
)
def redeem(coupon_id: str, body: RedeemRequest, db: sqlite3.Connection = Depends(get_db)):
    """세션 소유 쿠폰을 사용 처리한다. 매장 인증·QR 검증은 제공하지 않는다."""
    db.execute("BEGIN IMMEDIATE")
    require_session(db, body.session_id)
    row = db.execute(
        "SELECT * FROM coupons WHERE id = ? AND session_id = ?", (coupon_id, body.session_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="coupon_not_found")
    cursor = db.execute(
        "UPDATE coupons SET status = 'redeemed', redeemed_at = ? "
        "WHERE id = ? AND session_id = ? AND status = 'issued'",
        (datetime.now(timezone.utc).isoformat(), coupon_id, body.session_id),
    )
    if cursor.rowcount != 1:
        raise HTTPException(status_code=409, detail="already_redeemed")
    result = dict(db.execute("SELECT * FROM coupons WHERE id = ?", (coupon_id,)).fetchone())
    db.commit()
    return result
