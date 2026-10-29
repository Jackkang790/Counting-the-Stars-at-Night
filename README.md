# 별 헤는 밤 — Backend v0.1.0

대전 원도심 야간 투어의 해커톤 시연용 FastAPI + SQLite 백엔드입니다.
`Rest-Backend` 브랜치의 백엔드 모듈이며 프론트엔드는 포함하지 않습니다.

## 실행

Python 3.10 이상이 필요하며 Python 3.12.3에서 검증했습니다.
아래 명령은 모두 **저장소 루트**에서 실행합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.demo:app --app-dir backend --reload --reload-dir backend --port 8000
```

Windows PowerShell 활성화: `.\.venv\Scripts\Activate.ps1`.
이미 `backend/.venv`에 설치했다면 `source backend/.venv/bin/activate`로 활성화해도 됩니다.
기존에 backend 폴더에서 실행한 서버 명령도 계속 동작합니다.

브라우저에서 [Swagger UI](http://localhost:8000/docs)를 열어 API를 실행합니다.
원격 포트 전달 주소를 사용한다면 그 주소에 `/docs`를 붙입니다.
Swagger는 상대 경로로 명세와 API를 요청해 전달 경로를 유지합니다.
기본 `/` 경로는 404입니다. 종료는 Ctrl+C입니다.

## 기능과 시연 순서

v0.1.0 이후 작업본에는 번호 기반 쿠폰 사용, 사용 매장 기록, 쿠폰 만료와 매장 위치·영업 정보가 추가되었습니다.

- 임시 체험 세션 발급, 스팟 3곳 조회와 가상 체크인
- 체크인 후 완료 신호 수신, 세션·스팟별 별 중복 지급 방지
- 조건 충족 시 쿠폰 자동 발급, 목록 조회와 1회 사용
- 가상 매장 좌표·영업시간 조회, 쿠폰 사용 가능·영업 중·야간 영업 필터
- SQLite 영속 저장과 Swagger/OpenAPI

Swagger에서 각 API를 펼친 뒤 **Try it out → Execute**로 실행합니다.

1. `POST /api/v1/sessions`로 session_id를 발급받아 복사합니다.
2. `GET /api/v1/spots`로 스팟 a(관사 16호), b(관사 42호), c(헤레디움)를 확인합니다.
3. `POST /api/v1/checkin`에 다음 본문을 입력합니다.
4. `POST /api/v1/experiences/complete`에 같은 본문을 입력해 별을 받습니다.
5. spot_id를 b, c로 바꿔 각각 체크인과 완료를 반복합니다.
6. `GET /api/v1/coupons`에 session_id를 넣어 발급된 쿠폰 ID를 확인합니다.
7. `POST /api/v1/coupons/{coupon_id}/redeem`에 쿠폰 ID와 session_id를 넣어 사용합니다.
   재사용은 409를 반환합니다.
8. `GET /api/v1/stars`, `GET /api/v1/stores`로 별과 가상 매장을 조회합니다.

체크인·완료 본문:

```json
{"session_id":"발급받은 UUID","spot_id":"a"}
```

쿠폰 사용 본문:

```json
{"session_id":"발급받은 UUID"}
```

카페 리더기 시연은 `POST /api/v1/coupons/redeem-by-code`를 사용합니다.
손님 session_id 없이 쿠폰함에서 확인한 실제 12자리 code와 매장 ID를 보냅니다.

```json
{"code":"123456789012","store_id":"demo-store-1"}
```

등록된 사용 가능 매장만 성공하며 사용 매장을 쿠폰의 store_id에 기록합니다.
가상 매장 demo-store-1/2는 사용 가능, demo-store-3은 사용 불가입니다.
기존 세션 기반 API와 함께 요청해도 최초 한 번만 사용됩니다.
매장 자격증명이나 QR 서명은 검증하지 않습니다.
기존 DB는 재시작 시 store_id·expires_at 열을 추가하며 저장된 쿠폰을 보존합니다.
만료된 쿠폰은 목록에서 expired로 표시하며 두 사용 API 모두 410 coupon_expired를 반환합니다.

매장 조회에는 lat/lng, hours, open_now, night가 포함됩니다. 좌표와 영업시간도
시연용 가상 데이터이며 실제 제휴 매장의 위치·일정이 아닙니다.
영업 중 여부는 한국 표준시(UTC+9)로 계산하며 자정을 넘는 영업을 지원합니다.
`GET /api/v1/stores?accepts_coupon=true&open_now=true&night=true`로 복합 필터를 확인할 수 있습니다.
기존 매장 DB는 재시작 시 필요한 열을 추가하고, 데모 매장의 비어 있는 정보를 채웁니다.
기존 수정값과 비데모 매장은 보존하며 알 수 없는 정보는 null로 반환합니다.

기본 데모는 스팟당 별 1개, 별 3개에 쿠폰 1장을 지급합니다.
이 값과 가상 매장·혜택은 실제 제휴 정책이 아닙니다.
실제 GPS·AR 완료 검증, QR·로그인·관리자·통계는 제공하지 않습니다.
특정 매장으로 한정하는 쿠폰 정책, Docker 패키징과 실제 배포는 아직 포함하지 않습니다.
세션 ID는 로그인 인증 수단이 아니며 클라이언트 완료 신호를 신뢰하는 시연용 API입니다.

## 설정과 데이터

환경변수 예시는 `backend/.env.example`에 있습니다. 앱은 .env 파일을 자동 로딩하지 않습니다.
셸 환경변수로 전달하세요. 다음은 저장소 루트에서의 실행 예시입니다.

```bash
DEMO_COUPON_REQUIRED_STARS=2 python -m uvicorn app.demo:app --app-dir backend --port 8000
```

| 환경변수 | 기본값 및 동작 |
|---|---|
| `DATABASE_PATH` | 기본 저장소의 `backend/data/starry-night.sqlite3`. 지정한 상대 경로는 실행 폴더 기준 |
| `CORS_ORIGINS` | HTTP localhost/127.0.0.1의 5173·4173 포트. 지정하면 기본 목록 대체(쉼표 구분) |
| `DEMO_STARS_PER_SPOT` | `1`, 양의 정수. 이후 최초 지급에만 적용 |
| `DEMO_COUPON_REQUIRED_STARS` | `3`, 양의 정수 |
| `DEMO_COUPON_VALID_DAYS` | `14`, 데모 유효기간(1~36500일). 실제 제휴 정책이 아님 |
| `DEMO_COUPON_TITLE` | `[데모] 카페 체험 쿠폰` |
| `DEMO_COUPON_BENEFIT` | `[가상 혜택] 음료 1,000원 할인` |

설정 변경 후 서버를 재시작합니다. 쿠폰 템플릿의 기준·제목·혜택은 시작 시 갱신하며
이미 발급한 쿠폰의 제목·혜택·만료일은 유지합니다. 기준 변경 전 수집한 별도 완료 API를
재요청하면 현재 기준으로 쿠폰 발급 여부를 확인합니다. 조회만으로는 발급하지 않습니다.

DB는 앱 재시작 후에도 유지됩니다. 스팟·매장 seed는 기존 행을 덮어쓰지 않습니다.
쿠폰은 세션·템플릿별 한 장이며 사용·만료 후에도 재발급하지 않습니다.
만료 시각은 발급 시각 + 유효기간이며 ISO 8601 UTC로 반환합니다.
만료 시각에 도달한 순간부터 사용할 수 없습니다. 기존 만료일 없는 쿠폰도 최초 이전 시
발급 시각 + 현재 데모 유효기간으로 채웁니다. 이미 지난 날짜라면 즉시 만료로 표시됩니다.
expired는 조회·사용 시 현재 시각으로 판정하며 별도 주기 작업은 없습니다.
이미 사용한 쿠폰은 날짜가 지나도 redeemed와 기존 사용 기록을 유지합니다.
로컬 DB·가상환경·개인 환경설정은 루트 `.gitignore`에서 제외합니다.

### 폰 시연과 CORS

`npm run dev`의 5173과 `vite preview`의 4173은 기본 허용합니다.
LAN IP나 배포 URL로 프론트를 열면 **브라우저 주소의 프로토콜·호스트·포트**를
CORS_ORIGINS에 지정하고 백엔드를 재시작합니다. 경로와 끝 슬래시는 넣지 않습니다.
지정한 목록이 기본 목록을 대체하므로 계속 사용할 로컬 주소도 함께 넣습니다.

```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:4173,https://demo.example.com \
  python -m uvicorn app.demo:app --app-dir backend --port 8000
```

예시 도메인은 실제 프론트 출처로 바꿉니다. `.env.example`은 자동으로 읽지 않습니다.
CORS는 브라우저 출처 허용 설정이며 폰에서 서버까지의 연결을 제공하지는 않습니다.
폰의 localhost는 폰 자체를 가리키므로 포트 전달 등 실제 연결 주소도 맞아야 합니다.
환경변수를 빈 문자열로 지정하면 교차 출처를 허용하지 않습니다.

## 테스트

루트에서 가상환경을 활성화한 뒤 실행합니다.

```bash
python -m pip install -r requirements-dev.txt
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
```

Windows PowerShell에서는 `$env:PYTHONPATH="backend"` 설정 후
`python -m unittest discover -s backend/tests -v`를 실행합니다.
테스트는 임시 DB를 사용합니다. 동시 중복 지급·발급·사용 방지, 데이터 보존,
오류 처리, OpenAPI, CORS와 전체 시연 흐름을 검증합니다.
의존성 버전은 루트 `requirements*.txt`와 `constraints.txt`에서 관리합니다.

## 기존 FastAPI 앱에 연결

`backend/app/`의 database.py, seed.py, config.py, coupons.py, stores.py와 schemas/routers를
기존 프로젝트의 app 패키지에 병합합니다. 같은 이름의 기존 파일은 필요한 정의를 합칩니다.
기존 앱의 lifespan에 init_db()를 추가하고 아래 라우터를 등록합니다.
별도 로컬 실행 앱인 demo.py를 옮길 필요는 없습니다.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import init_db
from app.routers.spots import router as spots_router
from app.routers.sessions import router as sessions_router
from app.routers.stars import router as stars_router
from app.routers.coupons import router as coupons_router
from app.routers.stores import router as stores_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
for router in (spots_router, sessions_router, stars_router, coupons_router, stores_router):
    app.include_router(router)
```

기존 lifespan이 있다면 초기화 호출을 그 안에 합칩니다. 기존 앱의 title/version,
health와 CORS 설정을 유지하고 실제 프론트 출처를 허용 목록에 반영합니다.
라우터에 `/api/v1`이 포함되어 있으므로 등록 시 접두사를 추가하지 않습니다.
의존성 파일을 복사한다면 requirements.txt가 참조하는 constraints.txt도 함께 복사합니다.

## 문서와 구조

```text
README.md
.gitignore
requirements.txt
requirements-dev.txt
constraints.txt
CHANGELOG.md
backend/
├── .env.example
├── API.md
├── app/
└── tests/
```

- [현재 REST API 계약](backend/API.md): 엔드포인트, 응답 필드와 오류 코드
- [변경 내역](CHANGELOG.md)

기존 `docs/`의 기획·인수인계 자료는 로컬 참고 자료로 Git에서 제외됩니다.
