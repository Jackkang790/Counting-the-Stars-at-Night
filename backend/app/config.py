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


def stars_per_spot() -> int:
    """스팟당 별 수의 데모 기본값은 1. 이미 지급한 별 수는 변경하지 않는다."""
    try:
        value = int(os.environ.get("DEMO_STARS_PER_SPOT", "1"))
    except ValueError as exc:
        raise ValueError("DEMO_STARS_PER_SPOT must be a positive integer") from exc
    if value < 1:
        raise ValueError("DEMO_STARS_PER_SPOT must be a positive integer")
    return value


def coupon_required_stars() -> int:
    """쿠폰 기준은 데모 기본값 3이며 실제 운영 정책이 아니다."""
    try:
        value = int(os.environ.get("DEMO_COUPON_REQUIRED_STARS", "3"))
    except ValueError as exc:
        raise ValueError("DEMO_COUPON_REQUIRED_STARS must be a positive integer") from exc
    if value < 1:
        raise ValueError("DEMO_COUPON_REQUIRED_STARS must be a positive integer")
    return value


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
