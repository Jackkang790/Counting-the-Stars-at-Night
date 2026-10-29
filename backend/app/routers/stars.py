import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from ..rules import REQUIRED_STARS
from ..coupons import issue_coupon
from ..database import get_db
from ..schemas.session import ErrorResponse
from ..schemas.star import CompleteRequest, CompleteResponse, StarsResponse

router = APIRouter(prefix="/api/v1", tags=["stars"])


def require_session(db: sqlite3.Connection, session_id: str) -> None:
    if db.execute("SELECT 1 FROM sessions WHERE id = ?", (session_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="session_not_found")


def total_stars(db: sqlite3.Connection, session_id: str) -> int:
    return db.execute(
        "SELECT COUNT(*) FROM stars WHERE session_id = ?", (session_id,),
    ).fetchone()[0]


@router.post(
    "/experiences/complete", response_model=CompleteResponse,
    responses={
        404: {"model": ErrorResponse, "description": "세션 또는 스팟 없음"},
        409: {"model": ErrorResponse, "description": "체크인 필요"},
    },
    summary="체험 완료 수신 및 별 지급",
)
def complete(body: CompleteRequest, db: sqlite3.Connection = Depends(get_db)):
    """체크인한 스팟의 클라이언트 완료 신호를 시연용으로 신뢰한다.

    실제 AR 완료·시청 시간을 검증하지 않는다. 재요청에는 별을 추가 지급하지 않는다.
    조건을 충족하면 같은 트랜잭션에서 쿠폰을 한 번만 발급한다.
    """
    # 동시 완료 요청의 판정과 지급을 직렬화한다. UNIQUE 제약도 중복을 방지한다.
    db.execute("BEGIN IMMEDIATE")
    require_session(db, body.session_id)
    if db.execute("SELECT 1 FROM spots WHERE id = ?", (body.spot_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="spot_not_found")
    if (body.spot_id, body.kind) not in REQUIRED_STARS:
        raise HTTPException(status_code=422, detail="unsupported_experience")
    if db.execute(
        "SELECT 1 FROM visits WHERE session_id = ? AND spot_id = ?",
        (body.session_id, body.spot_id),
    ).fetchone() is None:
        raise HTTPException(status_code=409, detail="checkin_required")
    cursor = db.execute(
        "INSERT INTO stars (id, session_id, spot_id, kind, created_at) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(session_id, spot_id, kind) DO NOTHING",
        (str(uuid4()), body.session_id, body.spot_id, body.kind, datetime.now(timezone.utc).isoformat()),
    )
    total = total_stars(db, body.session_id)
    coupon_issued = issue_coupon(db, body.session_id)
    result = {
        "star_awarded": cursor.rowcount == 1,
        "total_stars": total,
        "coupon_issued": coupon_issued,
    }
    db.commit()
    return result


@router.get(
    "/stars", response_model=StarsResponse,
    responses={404: {"model": ErrorResponse, "description": "세션 없음"}},
    summary="세션의 수집 별 조회",
)
def list_stars(
    session_id: str = Query(min_length=1, max_length=128),
    db: sqlite3.Connection = Depends(get_db),
):
    require_session(db, session_id)
    rows = db.execute(
        "SELECT stars.spot_id, stars.kind, stars.created_at FROM stars "
        "JOIN spots ON spots.id = stars.spot_id "
        "WHERE stars.session_id = ? ORDER BY spots.display_order, "
        "CASE stars.kind WHEN 'role' THEN 0 ELSE 1 END", (session_id,),
    ).fetchall()
    stars = [dict(row) for row in rows]
    return {"stars": stars, "total_stars": len(stars)}
