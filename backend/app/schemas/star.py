from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CompleteRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    spot_id: str = Field(min_length=1, max_length=128)
    kind: Literal["role", "escape", "view"]


class CompleteResponse(BaseModel):
    star_awarded: bool
    total_stars: int
    coupon_issued: bool


class StarResponse(BaseModel):
    spot_id: str
    kind: Literal["role", "escape"]
    created_at: datetime


class StarsResponse(BaseModel):
    stars: list[StarResponse]
    total_stars: int
