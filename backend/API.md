# REST API — v0.1.0

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
| POST | `/api/v1/experiences/complete` | JSON: `session_id`, `spot_id` | 200: `star_awarded`, `total_stars`, `coupon_issued` |
| GET | `/api/v1/stars` | 쿼리: `session_id` | 200: `stars`, `total_stars` |
| GET | `/api/v1/coupons` | 쿼리: `session_id` | 200: 쿠폰 배열 |
| POST | `/api/v1/coupons/{coupon_id}/redeem` | 경로: 쿠폰 ID, JSON: `session_id` | 200: 사용한 쿠폰 객체 |
| GET | `/api/v1/stores` | 선택 쿼리: `accepts_coupon=true/false` | 200: 매장 배열 |

## 응답 필드

- 스팟: `id`, `name`, `description`, `display_order`. ID는 a(관사 16호), b(관사 42호), c(헤레디움).
- 별 목록 항목: `spot_id`, `amount`, `created_at`. total_stars는 amount의 합이다.
- 쿠폰: `id`, `template_id`, `title`, `benefit`, `code`, `status`, `issued_at`, `redeemed_at`.
  code는 표시용 숫자 12자리 문자열, status는 issued/redeemed다.
  redeemed_at은 미사용 시 null, 사용 후 UTC 시각이다.
- 매장: `id`, `name`, `description`, `display_location`, `accepts_coupon`, `is_demo`.
  현재 모든 매장은 가상 데이터이며 is_demo는 true다. 실제 주소·좌표는 없다.

세션별 별·쿠폰이 없거나 필터에 맞는 매장이 없으면 빈 배열을 포함하는 정상 응답을 반환한다.
시간은 ISO 8601 UTC다. 서버에서 발급한 식별자를 그대로 사용한다.

## 처리 규칙

- 체크인은 선택한 스팟의 가상 방문 기록이다. 재요청은 200이며 중복 저장하지 않는다.
- 완료 API는 해당 세션의 체크인이 필요하다. 클라이언트 완료 신호를 신뢰하며 AR/시청 시간은 검증하지 않는다.
- 별은 세션·스팟별 최초 한 번 지급한다. 재요청에는 star_awarded=false다.
- 데모 쿠폰 기준 충족 시 별 지급과 같은 트랜잭션에서 쿠폰을 발급한다.
  coupon_issued는 해당 요청에서 새로 발급했을 때만 true다.
- 쿠폰은 세션·템플릿별 한 장이다. 사용 후에도 재발급하지 않는다.
- 쿠폰 사용은 해당 세션 ID로 요청하며 최초 한 번만 성공한다. 매장 인증·만료 처리는 없다.
- 매장의 accepts_coupon은 데모 표시·필터 값이다. 쿠폰 사용 API와 매장 연결은 아직 없다.

## 오류

| 상태 | detail | 의미 |
|---|---|---|
| 404 | `session_not_found` | 없는 세션 |
| 404 | `spot_not_found` | 없는 스팟 |
| 404 | `coupon_not_found` | 없는 쿠폰 또는 다른 세션의 쿠폰 |
| 409 | `checkin_required` | 완료 요청 전 체크인 필요 |
| 409 | `already_redeemed` | 이미 사용한 쿠폰 |
| 422 | 검증 오류 배열 | 필수 필드 누락, 빈 ID, 잘못된 필터 등 |

404/409 본문은 `{"detail":"오류 코드"}`다. 라우트 자체가 없으면 FastAPI의
`{"detail":"Not Found"}`가 반환된다.

## 프론트 연동

세션 발급 → 스팟 조회 → 체크인 → 완료 → 별/쿠폰 조회 → 쿠폰 사용 순서로 호출한다.
재접속 시 같은 session_id를 전달하면 저장된 기록을 조회할 수 있다.
로컬 데모 앱의 CORS 기본 허용 출처는 localhost:5173과 127.0.0.1:5173(HTTP)이며,
실제 프론트 주소는 CORS_ORIGINS 환경변수에 쉼표로 구분해 설정한다.
기존 앱에 라우터만 연결할 때는 해당 앱의 CORS 설정을 따른다.
예전 GPS+QR, X-Device-Token, `/stars`, `/coupons/me` 계약과는 다르다.
