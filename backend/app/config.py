"""미확정 정책은 데모 환경설정으로 분리한다."""

import os


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
