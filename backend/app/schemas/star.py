from datetime import datetime

from pydantic import BaseModel, Field


class CompleteRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    spot_id: str = Field(min_length=1, max_length=128)


class CompleteResponse(BaseModel):
    star_awarded: bool
    total_stars: int
    coupon_issued: bool


class StarResponse(BaseModel):
    spot_id: str
    amount: int
    created_at: datetime


class StarsResponse(BaseModel):
    stars: list[StarResponse]
    total_stars: int
