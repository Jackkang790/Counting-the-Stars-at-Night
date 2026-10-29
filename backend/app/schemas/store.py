from pydantic import BaseModel


class StoreResponse(BaseModel):
    id: str
    name: str
    description: str
    display_location: str
    accepts_coupon: bool
    is_demo: bool
