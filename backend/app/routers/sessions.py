import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..schemas.session import (
    CheckinRequest, CheckinResponse, ErrorResponse, SessionResponse,
)

router = APIRouter(prefix="/api/v1", tags=["sessions"])


@router.post("/sessions", response_model=SessionResponse, status_code=201,
             summary="임시 체험 세션 발급")
def create_session(db: sqlite3.Connection = Depends(get_db)):
    """로그인 없이 체험 식별자를 발급한다. 사용자 인증을 제공하지 않는다."""
    session_id = str(uuid4())
    db.execute(
        "INSERT INTO sessions (id, created_at) VALUES (?, ?)",
        (session_id, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return {"session_id": session_id}


@router.post("/checkin", response_model=CheckinResponse,
             responses={404: {"model": ErrorResponse, "description": "세션 또는 스팟 없음"}},
             summary="가상 위치 기반 도착 기록")
def checkin(body: CheckinRequest, db: sqlite3.Connection = Depends(get_db)):
    """선택한 스팟에 도착한 것으로 간주한다. 실제 위치를 검증하지 않는다.

    같은 세션·스팟의 재요청은 기존 방문을 유지하고 동일하게 성공한다.
    """
    if db.execute("SELECT 1 FROM sessions WHERE id = ?", (body.session_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    if db.execute("SELECT 1 FROM spots WHERE id = ?", (body.spot_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="spot_not_found")
    db.execute(
        "INSERT INTO visits (id, session_id, spot_id, created_at) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(session_id, spot_id) DO NOTHING",
        (str(uuid4()), body.session_id, body.spot_id, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return {"spot_id": body.spot_id, "arrived": True}
