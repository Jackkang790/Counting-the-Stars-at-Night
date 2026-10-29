from pydantic import BaseModel


class SpotResponse(BaseModel):
    id: str
    name: str
    description: str
    display_order: int
