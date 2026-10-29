from pydantic import BaseModel, Field


class StoreResponse(BaseModel):
    id: str
    name: str
    description: str
    display_location: str
    accepts_coupon: bool
    is_demo: bool
    lat: float | None = Field(ge=-90, le=90)
    lng: float | None = Field(ge=-180, le=180)
    hours: str | None
    open_now: bool | None
    night: bool | None
