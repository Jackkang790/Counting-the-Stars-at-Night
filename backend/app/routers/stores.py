import sqlite3

from fastapi import APIRouter, Depends

from ..database import get_db
from ..schemas.store import StoreResponse

router = APIRouter(prefix="/api/v1", tags=["stores"])


@router.get("/stores", response_model=list[StoreResponse], summary="데모 매장 목록")
def list_stores(
    accepts_coupon: bool | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    """가상 매장을 반환한다. 위치는 표시용이며 실제 주소·좌표가 아니다.

    accepts_coupon을 생략하면 전체, 지정하면 해당 사용 가능 상태의 매장만 반환한다.
    """
    sql = "SELECT id, name, description, display_location, accepts_coupon, is_demo FROM stores"
    params = ()
    if accepts_coupon is not None:
        sql += " WHERE accepts_coupon = ?"
        params = (int(accepts_coupon),)
    rows = db.execute(sql + " ORDER BY id", params).fetchall()
    return [dict(row) for row in rows]
