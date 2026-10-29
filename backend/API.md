# REST API — v0.2.0

통합 앱에서는 `app.integrated:app`으로 실행한다. `/`은 프론트, `/ar/`는 AR이며
REST 경로는 그대로 `/api/v1`이다. 헤레디움(c)의 전시 완료는 `kind: "view"`로도
전송할 수 있다. 이는 기존 c/role 별과 같은 수집 슬롯이며 중복 지급하지 않는다.
조회 응답의 c/role은 프론트에서 전시 보기로 표시한다. a/b의 view는 422다.
통합 앱의 스팟·카페 기준은 `shared/tour.json`이며 기존 Swagger 데모 매장도 유지한다.
실제 제휴·영업시간·혜택은 확정 전이고 세 카페는 시연 데이터로 등록된다.

기본 주소: `http://localhost:8000`. 모든 API는 `/api/v1` 접두사를 사용한다.
실행 앱의 `/openapi.json`과 `/docs`가 실제 스키마를 제공한다.
별도 로그인·헤더 토큰 없이 발급받은 session_id를 본문 또는 쿼리로 전달한다.
이는 체험 식별자이며 사용자 인증을 제공하지 않는다.

| 메서드 | 경로 | 입력 | 성공 응답 |
|---|---|---|---|
| GET | `/api/v1/health` | 없음 | 200: `status`, `service` |
| POST | `/api/v1/sessions` | 없음 | 201: `session_id` |
| GET | `/api/v1/spots` | 없음 | 200: 스팟 배열 |
| POST | `/api/v1/checkin` | JSON: `session_id`, `spot_id` | 200: `spot_id`, `arrived` |
| POST | `/api/v1/experiences/complete` | JSON: `session_id`, `spot_id`, `kind` (`role`/`escape`, c는 `view`도 허용) | 200: `star_awarded`, `total_stars`, `coupon_issued` |
| GET | `/api/v1/stars` | 쿼리: `session_id` | 200: `stars`, `total_stars` |
| GET | `/api/v1/coupons` | 쿼리: `session_id` | 200: 쿠폰 배열 |
| POST | `/api/v1/coupons/redeem-by-code` | JSON: `code`, `store_id` | 200: 사용한 쿠폰 객체 |
| GET | `/api/v1/stores` | 선택 쿼리: `accepts_coupon`, `open_now`, `night` (각 true/false) | 200: 매장 배열 |

## 응답 필드

- 스팟: `id`, `name`, `description`, `display_order`. ID는 a(관사 16호), b(관사 42호), c(헤레디움).
- 별 목록 항목: `spot_id`, `kind`, `created_at`. total_stars는 수집한 별 기록 수다.
- 쿠폰: `id`, `title`, `benefit`, `code`, `status`, `issued_at`, `expires_at`, `redeemed_at`, `store_id`.
  code는 ASCII 숫자 12자리 문자열, status는 issued/redeemed/expired다.
  expires_at은 ISO 8601 UTC 만료 시각이며 발급 시각 + DEMO_COUPON_VALID_DAYS(데모 기본 14일)다.
  redeemed_at은 미사용 시 null, 사용 후 UTC 시각이다.
  store_id는 사용 매장 ID이며 미사용·매장 기록이 없는 쿠폰은 null이다.
- 매장: `id`, `name`, `description`, `display_location`, `accepts_coupon`, `is_demo`,
  `lat`, `lng`, `hours`, `open_now`, `night`.
  초기 매장은 모두 가상 데이터이며 is_demo는 true다. 좌표·영업시간도 시연용 가상 값이다.
  lat/lng는 숫자, hours는 `11:00–22:00` 형식, open_now/night는 bool이다.
  좌표나 영업시간이 없는 비데모 매장은 해당 필드를 null로 반환한다.

세션별 별·쿠폰이 없거나 필터에 맞는 매장이 없으면 빈 배열을 포함하는 정상 응답을 반환한다.
시간은 ISO 8601 UTC다. 서버에서 발급한 식별자를 그대로 사용한다.

## 처리 규칙

- 체크인은 세션의 현재 도착 장소를 저장한다. 다른 장소로 바꾸면 이전 도착 기록을 삭제한다.
  같은 장소의 재요청은 200이며 기존 기록을 유지한다. 세션당 도착 기록은 최대 1개다.
- 완료 API는 해당 세션의 현재 도착 장소와 spot_id가 같아야 한다. 다르면 409 checkin_required다.
  이전 장소의 미완료 체험은 다시 체크인한 뒤 진행한다. 이미 받은 별·쿠폰은 유지한다.
  클라이언트 완료 신호를 신뢰하며 AR/시청 시간은 검증하지 않는다.
- 별은 세션·스팟·체험 종류별 최초 한 번 지급한다. 재요청에는 star_awarded=false다.
- a/b/c 각각 role(역할극)·escape(방탈출)를 완료해 필수 별 6개를 모두 모으면
  별 지급과 같은 트랜잭션에서 쿠폰을 발급한다.
  coupon_issued는 해당 요청에서 새로 발급했을 때만 true다.
- 쿠폰은 세션당 한 장이다. 사용·만료 후에도 재발급하지 않는다.
- 번호 기반 쿠폰 사용은 code와 store_id만 요청한다. 등록된 매장의 accepts_coupon을 확인하고
  사용 매장을 저장한다. 손님 session_id는 필요 없다. 매장 자격증명·QR 서명은 검증하지 않는다.
- 사용 요청이 동시에 들어와도 한 번만 성공한다.
- 현재 시각이 expires_at 이상이면 미사용 쿠폰은 목록에서 expired로 반환한다.
  사용 API는 410 coupon_expired로 거절하며 사용 시각·매장을 기록하지 않는다.
  만료 여부는 조회·사용 시 계산한다. DB의 issued 기록을 별도 주기 작업으로 변경하지 않는다.
  이미 사용한 쿠폰은 날짜가 지나도 redeemed를 유지하고 재사용 요청은 409다.

## 오류

| 상태 | detail | 의미 |
|---|---|---|
| 404 | `session_not_found` | 없는 세션 |
| 404 | `spot_not_found` | 없는 스팟 |
| 404 | `coupon_not_found` | 발급된 쿠폰 번호를 찾을 수 없음 |
| 404 | `store_not_found` | 등록되지 않은 매장 |
| 409 | `checkin_required` | 완료 요청 장소가 현재 도착 장소가 아님 |
| 409 | `already_redeemed` | 이미 사용한 쿠폰 |
| 409 | `store_not_accepting_coupon` | 쿠폰을 받지 않는 매장 |
| 410 | `coupon_expired` | 만료된 미사용 쿠폰 |
| 422 | `unsupported_experience` | 등록된 장소지만 수집 대상 a/b/c에 포함되지 않음 |
| 422 | 검증 오류 배열 | 필수 필드 누락, 빈 ID, 잘못된 필터 등 |

404/409/410과 unsupported_experience 본문은 `{"detail":"오류 코드"}`다. 라우트 자체가 없으면 FastAPI의
`{"detail":"Not Found"}`가 반환된다.

## 프론트 연동

세션 발급 → 스팟 조회 → 장소별 체크인 → role/escape 각각 완료 → 별/쿠폰 조회 → 쿠폰 사용 순서로 호출한다.
완료 요청 예: `{"session_id":"발급된 세션 ID","spot_id":"a","kind":"role"}`.
session_id는 실제 발급값을 사용한다. 쿠폰 사용은 08번 번호 기반 API에
쿠폰 조회 응답의 code와 사용 매장 store_id를 넣는다.
재접속 시 같은 session_id를 전달하면 저장된 기록을 조회할 수 있다.
로컬 데모 앱의 CORS 기본 허용 출처는 localhost/127.0.0.1의 5173·4173 포트(HTTP)다.
실제 프론트 주소는 CORS_ORIGINS 환경변수에 쉼표로 구분해 설정한다.
지정하면 기본 목록을 대체하며 빈 문자열이면 교차 출처를 허용하지 않는다.
프로토콜·호스트·포트를 정확히 맞추고 경로·끝 슬래시는 제외한다. 변경 후 서버를 재시작한다.
기존 앱에 라우터만 연결할 때는 해당 앱의 CORS 설정을 따른다.

## Swagger 세션 선택

로컬 데모 앱은 `tour-1`, `tour-2`, `tour-3`을 준비한다. 세 세션은 처음 생성될 때
도착·별·쿠폰 기록이 없으며 서로 독립적으로 진행한다. 03·04·05·06에서 같은 투어를 선택한다.
예를 들어 tour-1을 사용하면 03의 `tour-1-a`로 체크인하고,
04의 `tour-1-a-role`, `tour-1-a-escape`를 실행한 뒤 05·06에서도 tour-1을 조회한다.

재시작·새로고침은 진행 상태를 초기화하지 않는다. 이전에 받은 별은 현재 도착 장소와
관계없이 05 목록에 남는다. 새로 시작하려면 아직 사용하지 않은 투어나 01에서 발급받은
session_id를 사용한다. 01의 응답은 다른 요청의 예시 값을 자동으로 바꾸지 않는다.

06에서 받은 code를 08에 복사하고 07에서 고른 store_id를 넣는다.
08의 `123456789012`는 형식을 보여주는 예시이며 실제 발급 번호로 바꿔야 한다.

체크인·완료의 session_id와 spot_id는 1~128자 문자열이다. 완료의 kind는 role/escape 중 하나다.
쿠폰 번호는 숫자형이 아닌 ASCII 숫자 12자리 문자열로 보내야 앞자리 0이 보존된다.

## 번호 기반 사용 예시

카페 리더기에서 받은 QR·바코드의 12자리 번호 또는 직접 입력한 번호를 전달한다.
현재는 code 자체를 사용하며 별도 QR 서명 형식을 추가하지 않았다.

```bash
curl -X POST http://localhost:8000/api/v1/coupons/redeem-by-code \
  -H 'Content-Type: application/json' \
  -d '{"code":"123456789012","store_id":"demo-store-1"}'
```

code는 실제 발급된 번호로 바꾼다. 성공 시 200과 쿠폰 객체를 반환하고
status=redeemed, store_id=demo-store-1, redeemed_at=사용 시각이 된다.
세션별 쿠폰 조회에서도 동일한 사용 결과를 확인할 수 있다.
매장 존재 → 사용 가능 여부 → 쿠폰 존재 → 사용 상태 순으로 확인한다.
실패 시 쿠폰 사용 상태와 사용 매장을 변경하지 않는다.
기존 DB는 시작 시 현재 쿠폰 구조로 이전하며 번호·문구·사용 기록을 보존한다.
만료일이 없는 쿠폰은 발급 시각 + 이전 당시 데모 유효기간으로 한 번 채운다.
이후 설정 변경이나 재시작으로 이미 저장한 만료일을 변경하지 않는다.
한 세션에 여러 쿠폰이 있는 DB는 임의로 정리하지 않고 이전을 중단한다.
체험 종류가 구분되지 않는 과거 별은 별도 보관하며 현재 수집 기록으로 환산하지 않는다.
기존 도착 기록이 여러 개인 세션은 시작 시 가장 최근 기록 하나만 유지한다.
같은 시각이면 나중에 삽입한 기록을 유지한다. 별·쿠폰 기록에는 영향을 주지 않는다.

## 매장 위치와 영업시간

```bash
curl http://localhost:8000/api/v1/stores
curl 'http://localhost:8000/api/v1/stores?accepts_coupon=true&open_now=true&night=true'
```

각 매장 응답 예시(영업 중 여부는 조회 시각에 따라 변함):

```json
{
  "id":"demo-store-1",
  "name":"[가상] 별빛 카페",
  "description":"시연용 가상 매장. 실제 제휴 매장이 아닙니다.",
  "display_location":"[데모] 소제동 구역 A",
  "accepts_coupon":true,
  "is_demo":true,
  "lat":36.3328,
  "lng":127.4376,
  "hours":"11:00–22:00",
  "open_now":true,
  "night":true
}
```

영업시간은 매일 동일한 한국 표준시(UTC+9) 데모 일정이며 휴일·휴게시간은 반영하지 않는다.
open_now는 개점 시각 이상·폐점 시각 미만일 때 true다. `12:00–02:00`처럼
폐점이 개점보다 이르면 자정을 넘는 영업으로 계산한다. 개점과 폐점이 같으면 휴무로 처리한다.
night는 21:00 이후까지 영업하거나 자정을 넘겨 영업하면 true다.
정보가 없어 null인 상태는 true/false 필터 결과 모두에서 제외한다.
여러 필터는 AND로 적용하며 생략하면 해당 조건으로 제한하지 않는다. 잘못된 값은 422다.

기존 stores 테이블에 lat/lng/opens_at/closes_at을 자동 추가한다.
알려진 데모 매장 3곳만 비어 있는 좌표·영업시간 쌍을 채우며,
기존 이름·사용 가능 여부·수정된 위치·시간과 비데모 매장 정보는 보존한다.
좌표는 지도 표시 시연용이며 실제 제휴 매장이나 방문 목적지를 의미하지 않는다.
거리·지도·길찾기 UI는 프론트 담당이며 서버는 위치 정보만 반환한다.
