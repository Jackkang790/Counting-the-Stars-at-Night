"""미확정 정책은 데모 환경설정으로 분리한다."""

import os


DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
)


def cors_origins() -> list[str]:
    """환경변수 지정 시 기본 목록을 대체한다. 빈 값은 교차 출처 허용 없음."""
    raw = os.environ.get("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS))
    return list(dict.fromkeys(origin.strip() for origin in raw.split(",") if origin.strip()))


def coupon_valid_days() -> int:
    """실제 운영 정책과 분리한 데모 유효기간. 기본 14일."""
    message = "DEMO_COUPON_VALID_DAYS must be an integer between 1 and 36500"
    try:
        value = int(os.environ.get("DEMO_COUPON_VALID_DAYS", "14"))
    except ValueError as exc:
        raise ValueError(message) from exc
    if not 1 <= value <= 36500:
        raise ValueError(message)
    return value
