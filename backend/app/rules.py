"""확정 수집 규칙. 환경변수나 발급 기준 테이블로 변경하지 않는다."""

SPOT_IDS = ("a", "b", "c")
KINDS = ("role", "escape")
REQUIRED_STARS = frozenset((spot, kind) for spot in SPOT_IDS for kind in KINDS)
