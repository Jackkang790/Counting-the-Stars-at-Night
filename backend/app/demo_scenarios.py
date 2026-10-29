"""로컬 Swagger 전용 안내·예시 데이터. 실제 API 라우터와 분리한다."""

from datetime import datetime, timezone

from .database import connection

TOUR_IDS = ("tour-1", "tour-2", "tour-3")

TAGS = [
    {"name": "01 · 시작", "description": "새 세션을 발급합니다. 준비된 tour-1, tour-2, tour-3을 사용하면 이 단계는 건너뛰어도 됩니다."},
    {"name": "02 · 장소 선택", "description": "a 관사 16호 → b 관사 42호 → c 헤레디움 순서입니다."},
    {"name": "03 · 도착 확인", "description": "현재 도착 장소를 지정합니다. 다른 장소에 체크인하면 이전 도착 기록이 삭제됩니다. 실제 이동·GPS는 필요 없습니다."},
    {"name": "04 · 체험 완료", "description": "체크인한 장소의 role(역할극)·escape(방탈출)를 각각 완료합니다. a/b/c의 별 6개를 모두 모으면 쿠폰을 받습니다."},
    {"name": "05 · 모은 별 확인", "description": "현재까지 완료한 장소와 별 합계를 확인합니다."},
    {"name": "06 · 쿠폰함", "description": "진행한 투어의 session_id를 선택해 발급된 쿠폰의 id와 code를 확인합니다."},
    {"name": "07 · 카페 선택", "description": "demo-store-1/2는 사용 가능, demo-store-3은 사용 불가입니다. 위치·시간은 가상 데이터입니다."},
    {"name": "08 · 카페에서 번호로 사용", "description": "06에서 받은 실제 code로 예시 번호를 바꿔 실행합니다. 같은 쿠폰 재사용은 409, 만료는 410입니다."},
    {"name": "참고 · 서버 상태", "description": "서버가 실행 중인지 확인합니다."},
]

GUIDE = """
## 처음부터 따라 하기

**`tour-1`, `tour-2`, `tour-3`은 서로 독립된 체험 세션이며 DB에 준비되어 있습니다.**
세 세션 모두 처음 생성할 때 별·쿠폰·도착 기록 없이 시작합니다.
03~06에서는 같은 투어를 선택하세요. 예를 들어 tour-1을 진행하면 조회도 tour-1로 합니다.

1. **02 장소 선택**에서 a/b/c를 확인합니다.
2. **03 도착 확인**에서 `tour-1-a` 예시를 실행합니다.
3. **04 체험 완료**에서 `tour-1-a-role`, `tour-1-a-escape` 예시를 각각 실행합니다. 체험별 별 1개를 받습니다.
4. `b`, `c`도 체크인 후 역할극·방탈출을 각각 완료합니다. 별 6개를 모두 모으면 쿠폰이 발급됩니다.
5. **05 별 확인 → 06 쿠폰함**에서 결과와 발급된 12자리 `code`를 확인합니다.
6. **07 카페 선택 → 08 번호로 사용**에서 받은 code와 `demo-store-1`을 입력합니다.
7. **06 쿠폰함**을 다시 조회하면 `redeemed`로 바뀝니다.

**쿠폰 발급 버튼이나 별도 발급 API는 없습니다.** 04의 마지막 완료 응답에서
`coupon_issued: true`가 되면 서버가 자동 발급한 것입니다. 06은 발급된 쿠폰을 조회합니다.

각 항목은 **Try it out → 예시 선택 → Execute**로 실행합니다.
이 화면은 백엔드 테스트용이며 AR 감상 대신 완료 요청을 직접 보냅니다.
프론트는 장소별 역할극·방탈출 완료를 `kind: role` 또는 `kind: escape`로 각각 전송합니다.
**세 장소 × 두 체험 = 별 6개 = 세션당 쿠폰 1장**입니다.
다른 장소에 체크인하면 이전 도착 기록은 삭제됩니다. 현재 도착한 장소의 체험만 완료할 수 있습니다.
이미 받은 별·쿠폰은 유지되며, 이전 장소의 미완료 체험은 그 장소에 다시 체크인한 뒤 진행하세요.

투어 세션은 로컬 데모 앱 시작 시 한 번만 준비하며, 실행 결과는 DB에 저장됩니다.
새로고침·서버 재시작으로 진행 상태나 사용 기록을 되돌리지 않습니다.
새 체험은 **01 시작**에서 발급받은 session_id를 03~06의 예시 값 대신 넣으세요.
투어 세션은 테스트용이며 실제 고객 데이터가 아닙니다.
"""


def seed_demo_scenarios() -> None:
    now = datetime.now(timezone.utc).isoformat()
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        for session_id in TOUR_IDS:
            db.execute(
                "INSERT INTO sessions (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
                (session_id, now),
            )


def walkthrough_schema(schema: dict) -> dict:
    """실제 계약은 유지하며 Swagger 정렬·설명·입력 예시만 꾸민다."""
    steps = {
        ("/api/v1/sessions", "post"): 0, ("/api/v1/spots", "get"): 1,
        ("/api/v1/checkin", "post"): 2, ("/api/v1/experiences/complete", "post"): 3,
        ("/api/v1/stars", "get"): 4, ("/api/v1/coupons", "get"): 5,
        ("/api/v1/stores", "get"): 6, ("/api/v1/coupons/redeem-by-code", "post"): 7,
        ("/api/v1/health", "get"): 8,
    }
    for (path, method), index in steps.items():
        operation = schema["paths"][path][method]
        operation["tags"] = [TAGS[index]["name"]]
        if path == "/api/v1/experiences/complete":
            operation["summary"] = "체험 완료 → 별 지급 → 조건 충족 시 쿠폰 자동 발급"
        for parameter in operation.get("parameters", []):
            if parameter["name"] == "session_id":
                parameter["examples"] = {
                    key: {"summary": key, "value": key} for key in TOUR_IDS
                }
        if path == "/api/v1/checkin":
            operation["requestBody"]["content"]["application/json"]["examples"] = {
                f"{tour}-{spot}": {"summary": f"{tour} · {label}", "value": {"session_id": tour, "spot_id": spot}}
                for tour in TOUR_IDS
                for spot, label in [("a", "a · 관사 16호"), ("b", "b · 관사 42호"), ("c", "c · 헤레디움")]
            }
        if path == "/api/v1/experiences/complete":
            operation["requestBody"]["content"]["application/json"]["examples"] = {
                f"{tour}-{spot}-{kind}": {
                    "summary": f"{tour} · {label} · {kind_label}",
                    "value": {"session_id": tour, "spot_id": spot, "kind": kind},
                }
                for tour in TOUR_IDS
                for spot, label in [("a", "a · 관사 16호"), ("b", "b · 관사 42호"), ("c", "c · 헤레디움")]
                for kind, kind_label in [("role", "역할극"), ("escape", "방탈출")]
            }
        if path == "/api/v1/coupons/redeem-by-code":
            operation["requestBody"]["content"]["application/json"]["example"] = {
                "code": "123456789012", "store_id": "demo-store-1",
            }
    return schema
