import sqlite3

from fastapi import APIRouter, Depends

from ..database import get_db
from ..schemas.spot import SpotResponse

router = APIRouter(prefix="/api/v1", tags=["spots"])


@router.get("/spots", response_model=list[SpotResponse], summary="투어 스팟 목록")
def list_spots(db: sqlite3.Connection = Depends(get_db)):
    """투어 순서대로 스팟을 반환한다. 실제 GPS나 도착 판정을 수행하지 않는다."""
    rows = db.execute(
        "SELECT id, name, description, display_order FROM spots ORDER BY display_order"
    ).fetchall()
    return [dict(row) for row in rows]
