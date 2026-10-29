import sqlite3

from fastapi import APIRouter, Depends

from ..database import get_db
from ..schemas.store import StoreResponse
from .. import stores as store_service

router = APIRouter(prefix="/api/v1", tags=["stores"])


@router.get("/stores", response_model=list[StoreResponse], summary="데모 매장 목록")
def list_stores(
    accepts_coupon: bool | None = None,
    open_now: bool | None = None,
    night: bool | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    """좌표와 영업시간은 시연용 가상 값이다. 실제 매장 정보가 아니다.

    영업 중은 한국 시각 기준, 야간 영업은 21시 이후 또는 자정을 넘겨 영업할 때다.
    각 필터를 생략하면 전체를 반환하며 함께 지정하면 모두 만족하는 매장을 반환한다.
    """
    sql = "SELECT * FROM stores"
    params = ()
    if accepts_coupon is not None:
        sql += " WHERE accepts_coupon = ?"
        params = (int(accepts_coupon),)
    rows = db.execute(sql + " ORDER BY id", params).fetchall()
    now = store_service.utc_now()
    stores = [store_service.store_response(row, now) for row in rows]
    return [store for store in stores
            if (open_now is None or store["open_now"] is open_now)
            and (night is None or store["night"] is night)]
