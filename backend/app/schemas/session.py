from pydantic import BaseModel, Field


class SessionResponse(BaseModel):
    session_id: str


class CheckinRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    spot_id: str = Field(min_length=1, max_length=128)


class CheckinResponse(BaseModel):
    spot_id: str
    arrived: bool


class ErrorResponse(BaseModel):
    detail: str
