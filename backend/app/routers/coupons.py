import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_db
from .. import coupons as coupon_service
from ..schemas.coupon import CouponResponse, RedeemByCodeRequest, RedeemRequest
from ..schemas.session import ErrorResponse

router = APIRouter(prefix="/api/v1", tags=["coupons"])


def require_session(db: sqlite3.Connection, session_id: str) -> None:
    if not db.execute("SELECT 1 FROM sessions WHERE id = ?", (session_id,)).fetchone():
        raise HTTPException(status_code=404, detail="session_not_found")


def mark_redeemed(db: sqlite3.Connection, coupon_id: str, store_id: str | None = None):
    """호출자의 트랜잭션에서 두 사용 경로 모두 한 번만 처리한다."""
    now = coupon_service.utc_now()
    coupon = db.execute("SELECT * FROM coupons WHERE id = ?", (coupon_id,)).fetchone()
    # 사용 완료 이력을 만료로 바꾸지 않는다. 재사용은 계속 409다.
    if coupon["status"] == "redeemed":
        raise HTTPException(status_code=409, detail="already_redeemed")
    if coupon_service.is_expired(coupon, now):
        raise HTTPException(status_code=410, detail="coupon_expired")
    cursor = db.execute(
        "UPDATE coupons SET status = 'redeemed', redeemed_at = ?, store_id = ? "
        "WHERE id = ? AND status = 'issued'",
        (now.isoformat(), store_id, coupon_id),
    )
    if cursor.rowcount != 1:
        raise HTTPException(status_code=409, detail="already_redeemed")
    result = dict(db.execute("SELECT * FROM coupons WHERE id = ?", (coupon_id,)).fetchone())
    db.commit()
    return result


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
    now = coupon_service.utc_now()
    return [coupon_service.coupon_response(row, now) for row in rows]


@router.post(
    "/coupons/redeem-by-code", response_model=CouponResponse,
    responses={
        404: {"model": ErrorResponse, "description": "매장 또는 쿠폰 없음"},
        409: {"model": ErrorResponse, "description": "사용 불가 매장 또는 이미 사용한 쿠폰"},
        410: {"model": ErrorResponse, "description": "만료된 쿠폰"},
    },
    summary="쿠폰 번호로 데모 매장 사용 처리",
)
def redeem_by_code(body: RedeemByCodeRequest, db: sqlite3.Connection = Depends(get_db)):
    """손님 session_id 없이 12자리 번호로 사용한다. 매장 자격증명은 검증하지 않는다.

    매장 등록과 accepts_coupon 상태를 확인한다. QR 서명 인증은 제공하지 않는다.
    """
    db.execute("BEGIN IMMEDIATE")
    store = db.execute("SELECT accepts_coupon FROM stores WHERE id = ?", (body.store_id,)).fetchone()
    if store is None:
        raise HTTPException(status_code=404, detail="store_not_found")
    if not store["accepts_coupon"]:
        raise HTTPException(status_code=409, detail="store_not_accepting_coupon")
    coupon = db.execute("SELECT id FROM coupons WHERE code = ?", (body.code,)).fetchone()
    if coupon is None:
        raise HTTPException(status_code=404, detail="coupon_not_found")
    return mark_redeemed(db, coupon["id"], body.store_id)


@router.post(
    "/coupons/{coupon_id}/redeem", response_model=CouponResponse,
    include_in_schema=False,
    responses={
        404: {"model": ErrorResponse, "description": "세션 또는 해당 세션의 쿠폰 없음"},
        409: {"model": ErrorResponse, "description": "이미 사용한 쿠폰"},
        410: {"model": ErrorResponse, "description": "만료된 쿠폰"},
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
    return mark_redeemed(db, row["id"])
