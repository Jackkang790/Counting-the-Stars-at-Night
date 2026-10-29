# 별 헤는 밤 — Backend v0.2.0

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
현재처럼 **backend 폴더 안에서 실행**한다면 다음 명령을 사용합니다.

```bash
source .venv/bin/activate
python -m pip install -r ../requirements.txt
python -m uvicorn app.demo:app --host 0.0.0.0 --port 8000 --reload
```

이후 루트 기준 명령을 사용할 때는 저장소 루트로 이동합니다.

브라우저에서 [Swagger UI](http://localhost:8000/docs)를 열어 API를 실행합니다.
원격 포트 전달 주소를 사용한다면 그 주소에 `/docs`를 붙입니다.
Swagger는 상대 경로로 명세와 API를 요청해 전달 경로를 유지합니다.
기본 `/` 경로는 404입니다. 종료는 Ctrl+C입니다.

## 기능과 시연 순서

Swagger는 01~08 순서로 표시하며 투어·장소별 요청 예시를 제공합니다.
08의 번호는 실제 발급된 code로 바꿔야 합니다.
바로 따라 할 때는 01의 새 세션 발급을 건너뛰고 준비된 `tour-1`, `tour-2`, `tour-3` 중 하나를 선택하세요.
03·04·05·06에서 같은 투어 번호를 사용합니다.
각 장소에 03 체크인 후 04의 역할극(role)·방탈출(escape)을 각각 완료합니다.
다른 장소에 체크인하면 이전 도착 기록은 삭제됩니다. 현재 장소의 체험만 완료할 수 있으며,
이전 장소의 미완료 체험은 다시 체크인해야 합니다. 이미 받은 별·쿠폰은 유지됩니다.
a→b→c에서 별 6개를 모두 모은 뒤 06 쿠폰함에서 code를 확인하고
07 카페 선택 → 08 번호로 사용을 실행합니다.
쿠폰 발급 API를 따로 호출하지 않습니다. 마지막 완료 응답의 `coupon_issued: true`가
자동 발급을 뜻하며, 06 쿠폰함은 그 결과를 조회하는 단계입니다.

세 투어는 서로 독립적인 테스트 세션입니다.

| 세션 | 최초 상태 |
|---|---|
| `tour-1` | 도착·별·쿠폰 없음 |
| `tour-2` | 도착·별·쿠폰 없음 |
| `tour-3` | 도착·별·쿠폰 없음 |

예를 들어 03에서 `tour-1-a`, 04에서 `tour-1-a-role`·`tour-1-a-escape`를 실행하고,
05·06에서도 tour-1을 선택합니다. 다른 투어도 같은 방식으로 진행합니다.

샘플은 `app.demo` 시작 시 한 번 준비합니다. 새로고침이나 재시작으로 사용 이력을
초기화하지 않습니다. 반복 테스트는 01에서 새 session_id를 발급받아 이후 입력에 넣습니다.
기존 앱에 API 라우터만 통합하는 경우 이 샘플 생성과 Swagger 재구성은 적용되지 않습니다.

v0.2.0에는 번호 기반 쿠폰 사용, 사용 매장 기록, 쿠폰 만료와 매장 위치·영업 정보가 추가되었습니다.

- 임시 체험 세션 발급, 스팟 3곳 조회와 가상 체크인
- 체크인 후 완료 신호 수신, 세션·스팟·체험 종류별 별 중복 지급 방지
- 조건 충족 시 쿠폰 자동 발급, 목록 조회와 1회 사용
- 가상 매장 좌표·영업시간 조회, 쿠폰 사용 가능·영업 중·야간 영업 필터
- SQLite 영속 저장과 Swagger/OpenAPI

각 API는 **Try it out → 예시 선택 또는 값 입력 → Execute**로 실행합니다.

| 단계 | 실행 내용 |
|---|---|
| 01 시작 | 새 session_id 발급. 준비된 tour-1/2/3을 쓰면 생략 가능 |
| 02 장소 선택 | a 관사 16호, b 관사 42호, c 헤레디움 확인 |
| 03 도착 확인 | 선택한 투어와 장소로 체크인 |
| 04 체험 완료 | 현재 장소의 role·escape를 각각 완료. 장소마다 03→04 반복 |
| 05 모은 별 확인 | 진행한 투어의 별 기록·합계 조회 |
| 06 쿠폰함 | 별 6개 완료 후 같은 투어의 발급 code 조회 |
| 07 카페 선택 | 쿠폰 사용 가능한 매장의 id 확인 |
| 08 번호로 사용 | 06의 code와 07의 매장 id를 입력 |

체크인 본문:

```json
{"session_id":"tour-1","spot_id":"a"}
```

완료 본문(role·escape 각각 호출):

```json
{"session_id":"tour-1","spot_id":"a","kind":"role"}
```

08번 쿠폰 사용 본문(번호는 실제 발급값으로 변경):

```json
{"code":"123456789012","store_id":"demo-store-1"}
```

01에서 새 세션을 발급받았다면 03~06의 session_id를 모두 그 값으로 바꿉니다.
Swagger는 새 세션 응답을 다른 요청에 자동으로 채우지 않습니다.

등록된 사용 가능 매장만 성공하며 사용 매장을 쿠폰의 store_id에 기록합니다.
가상 매장 demo-store-1/2는 사용 가능, demo-store-3은 사용 불가입니다.
동시에 사용을 요청해도 최초 한 번만 성공합니다.
매장 자격증명이나 QR 서명은 검증하지 않습니다.
기존 DB는 시작 시 현재 쿠폰 구조로 이전하며 저장된 쿠폰을 보존합니다.
체험 종류를 구분할 수 없는 과거 별은 별도 보관하며 현재 수집 기록으로 환산하지 않습니다.
한 세션에 여러 쿠폰이 있는 DB는 자동 정리하지 않고 이전을 중단합니다.
도착 기록은 세션당 가장 최근 하나만 유지하며, 같은 시각은 나중에 삽입한 행을 유지합니다.
만료된 쿠폰은 목록에서 expired로 표시하며 사용 요청은 410 coupon_expired를 반환합니다.

매장 조회에는 lat/lng, hours, open_now, night가 포함됩니다. 좌표와 영업시간도
시연용 가상 데이터이며 실제 제휴 매장의 위치·일정이 아닙니다.
영업 중 여부는 한국 표준시(UTC+9)로 계산하며 자정을 넘는 영업을 지원합니다.
`GET /api/v1/stores?accepts_coupon=true&open_now=true&night=true`로 복합 필터를 확인할 수 있습니다.
기존 매장 DB는 재시작 시 필요한 열을 추가하고, 데모 매장의 비어 있는 좌표·영업시간 쌍을 채웁니다.
기존 수정값과 비데모 매장은 보존하며 알 수 없는 정보는 null로 반환합니다.

필수 수집 규칙은 세 장소의 역할극·방탈출 각 1개씩, 총 별 6개입니다.
모두 수집하면 세션당 쿠폰 1장을 발급합니다. 매장·혜택·유효기간은 데모 자료입니다.
실제 GPS·AR 완료 검증, QR·로그인·관리자·통계는 제공하지 않습니다.
특정 매장으로 한정하는 쿠폰 정책, Docker 패키징과 실제 배포는 아직 포함하지 않습니다.
세션 ID는 로그인 인증 수단이 아니며 클라이언트 완료 신호를 신뢰하는 시연용 API입니다.

## 설정과 데이터

환경변수 예시는 `backend/.env.example`에 있습니다. 앱은 .env 파일을 자동 로딩하지 않습니다.
셸 환경변수로 전달하세요. 다음은 저장소 루트에서의 실행 예시입니다.

```bash
DEMO_COUPON_VALID_DAYS=7 python -m uvicorn app.demo:app --app-dir backend --port 8000
```

| 환경변수 | 기본값 및 동작 |
|---|---|
| `DATABASE_PATH` | 기본 저장소의 `backend/data/starry-night.sqlite3`. 지정한 상대 경로는 실행 폴더 기준 |
| `CORS_ORIGINS` | HTTP localhost/127.0.0.1의 5173·4173 포트. 지정하면 기본 목록 대체(쉼표 구분) |
| `DEMO_COUPON_VALID_DAYS` | `14`, 데모 유효기간(1~36500일). 실제 제휴 정책이 아님 |
| `DEMO_COUPON_TITLE` | `[데모] 카페 체험 쿠폰` |
| `DEMO_COUPON_BENEFIT` | `[가상 혜택] 음료 1,000원 할인` |

설정 변경 후 서버를 재시작합니다. 쿠폰 제목·혜택·기간은 발급 시 읽어 저장하며
이미 발급한 쿠폰의 문구·만료일은 유지합니다. 수집 규칙은 코드 상수로 관리합니다.
쿠폰은 완료 API에서 자동 발급하며 조회만으로는 발급하지 않습니다.

DB는 앱 재시작 후에도 유지됩니다. 스팟·매장 seed는 기존 행을 덮어쓰지 않습니다.
쿠폰은 세션당 한 장이며 사용·만료 후에도 재발급하지 않습니다.
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

backend 폴더에서는 다음 명령을 사용합니다.

```bash
python -m pip install -r ../requirements-dev.txt
python -m unittest discover -s tests -v
python -m pip check
```

최종 코드 검증(2026-10-30): 전체 57개 테스트와 의존성 검사 통과.
실제 프론트·AR·별도 배포 환경의 연동 검증은 포함하지 않습니다.

Windows PowerShell에서는 `$env:PYTHONPATH="backend"` 설정 후
`python -m unittest discover -s backend/tests -v`를 실행합니다.
테스트는 임시 DB를 사용합니다. 동시 중복 지급·발급·사용 방지, 데이터 보존,
오류 처리, OpenAPI, CORS와 전체 시연 흐름을 검증합니다.
의존성 버전은 루트 `requirements*.txt`와 `constraints.txt`에서 관리합니다.

## 시연 중 확인할 사항

| 현상 | 확인할 내용 |
|---|---|
| 404 session_not_found | 03~06의 session_id를 실제 발급값 또는 tour-1/2/3으로 통일 |
| 409 checkin_required | 완료 요청의 장소에 먼저 체크인. 다른 장소로 이동했다면 다시 체크인 |
| 다른 장소의 별이 05에 표시됨 | 이미 받은 별은 유지됨. 현재 도착 기록과 수집 기록은 별개 |
| 422 검증 오류 | 완료 요청에 kind(role/escape) 포함, code는 숫자 12자리 문자열로 전달 |
| 404 coupon_not_found | 08의 예시 번호를 06에서 조회한 실제 code로 변경 |
| 새로고침 후 기존 예시가 보임 | Swagger 페이지를 새로고침하고 투어·입력값을 다시 선택 |

## 기존 FastAPI 앱에 연결

`backend/app/`의 database.py, migrations.py, rules.py, seed.py, config.py, coupons.py, stores.py와 schemas/routers를
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
├── DESIGN.md
├── app/
└── tests/
```

- [현재 REST API 계약](backend/API.md): 엔드포인트, 응답 필드와 오류 코드
- [현재 설계 기록](backend/DESIGN.md): DB 스키마·요구사항 출처·구현 판단·데모 값·미확정 사항
- [변경 내역](CHANGELOG.md)

기존 `docs/`의 기획·인수인계 자료는 로컬 참고 자료로 Git에서 제외됩니다.
