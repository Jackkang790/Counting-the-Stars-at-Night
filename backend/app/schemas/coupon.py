from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RedeemRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)


class RedeemByCodeRequest(BaseModel):
    code: str = Field(pattern=r"^[0-9]{12}$", min_length=12, max_length=12)
    store_id: str = Field(min_length=1, max_length=128)


class CouponResponse(BaseModel):
    id: str
    template_id: str
    title: str
    benefit: str
    code: str
    status: Literal["issued", "redeemed"]
    issued_at: datetime
    redeemed_at: datetime | None
    store_id: str | None
