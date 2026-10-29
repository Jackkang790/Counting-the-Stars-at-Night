# 별 헤는 밤 — 프론트 ↔ 서버 API 약속

> 독자: FastAPI 서버를 만드는 팀원
> 프론트(React, `Frontend` 브랜치)가 부르는 API 모양입니다. 서버 코드는 프론트 쪽에서 만들지 않습니다.
> 프론트 코드: `src/lib/api.js` — `VITE_API_URL` 이 있으면 그 서버를 부르고, 없으면 이 문서의 **응답 예시와 똑같은 고정 데이터**로 동작합니다.
> 기준: 「별헤는밤_프로젝트_브리프_for_AI_Agent.md」 §7·§8. 다르게 하고 싶은 부분은 이 문서를 고쳐서 알려 주세요.

## 0. 서비스 흐름에서 서버가 하는 일

| 단계 | 화면 | 서버가 하는 일 | API |
|---|---|---|---|
| 1. 스팟 도착 | 02 지도 | (프론트가 GPS 로 스팟 반경 안내) | — |
| 1.1 포인트 도착 확인 | 03 포인트 | GPS 반경 + 가상 QR 검증 | `POST /checkin` |
| 3. AR 감상 · 별 | 04 영상 / 04-A 작품 | 별 지급 판정(영상 80% 이상, 포인트당 1회) | `POST /stars` |
| 4. 쿠폰 받기 | 05 별자리 | 별 6개면 쿠폰 자동 발급 | `POST /stars` 응답 / `GET /coupons/me` |
| 5. 카페에서 사용 | 06 쿠폰 · 07 카페 | 카페 리더기 스캔 → 사용 처리, 카페 목록 | (리더기) / `GET /stores` |

## 1. 공통

- Base URL: 프론트 `.env` 의 `VITE_API_URL` (예: `http://localhost:8000`)
- 사용자 구분: 비회원. 모든 요청 헤더에 `X-Device-Token: <uuid>` (프론트가 기기마다 한 번 만들어 저장)
- 형식: JSON, 시간은 ISO 8601 (`+09:00`)
- CORS: 프론트 개발 주소 `http://localhost:5173`, 폰 시연 `http://localhost:4173` 허용 필요
- 에러: `{ "detail": "사람이 읽을 메시지" }` + 아래 상태 코드

## 2. 스팟 · 포인트 (프론트에 고정, 참고용)

프론트 `src/lib/spots.js` 에 들어 있습니다. 서버 DB 의 `spots` / `points` 와 **id 를 맞춰 주세요.**

| spot_id | 스팟 | 막 | point_id | 종류 |
|---|---|---|---|---|
| `a` | 대전테미예술창작센터 (대흥동) | ACT 1 | `a-musical` · `a-art` | AR 뮤지컬 영상 · 별길 작품 |
| `b` | 협동조합 극단놀이터 (대흥동) | ACT 2 | `b-musical` · `b-art` | 〃 |
| `c` | 대전상상아트홀 (선화동) | 피날레 | `c-musical` · `c-art` | 〃 |

- 총 별 6개. 별자리 = 6개 모두.
- 스팟 반경 기본 40m (설정값), 영상 시청 기준 80% (설정값).
- 좌표는 아직 대략값입니다(현장 확인 후 교체).

## 3. API

### `POST /checkin` — 포인트 도착 확인 (기능 1.1)

건물 앞에 **앱 안에서 가상 QR** 이 떠 있고(실물 바닥 QR 없음), 사용자가 그걸 누르면 호출합니다.
서버는 **GPS 반경과 QR 을 둘 다** 확인합니다.

요청
```json
{ "point_id": "a-musical", "lat": 36.33245, "lng": 127.43695, "qr_payload": "a:a-musical", "demo": false }
```
- `qr_payload`: 지금은 `"<spot_id>:<point_id>"`. **서명값을 붙이는 형식은 서버에서 정해 알려 주세요**(예: `a:a-musical:<hmac>`). 정해지면 프론트가 맞춥니다.
- `demo: true`: 행사장 데모 모드(가상 위치). 데모일 때 GPS 를 통과시킬지는 서버 설정으로.
- 위치 권한 거부 시 `lat/lng` 가 `null` 로 옴 → 별 지급 정책은 미정(브리프 §13), 설정값으로.

응답 200
```json
{ "gps_ok": true, "qr_ok": true }
```
- 반경 밖: `{ "gps_ok": false, "qr_ok": true }` → 프론트가 "스팟 근처로 이동해 주세요" 표시, 다음 단계로 안 넘어감.

### `POST /stars` — 별 받기

요청
```json
{ "point_id": "a-musical", "watched_ratio": 0.83 }
```
- 영상: 실제로 흐른 시간만 센 비율(건너뛰기 제외). 작품: `1`.
- 같은 사용자·같은 포인트는 1회만 (`unique(user_id, point_id)`). 이미 있으면 그냥 200.
- 별 지급 전에 그 포인트의 `/checkin` 통과 기록이 있는지 확인해 주세요(집에서 부정 사용 방지).

응답 200
```json
{ "stars": ["a-musical", "a-art"], "total": 2, "constellation_complete": false }
```
- `stars` 를 주면 프론트는 그 목록을 따릅니다(서버 판정 우선).
- `constellation_complete: true` 가 되는 순간 **서버가 쿠폰을 발급**해 주세요. 프론트는 이어서 `GET /coupons/me` 를 부릅니다.

### `GET /stars/me` — (선택) 내 별

다른 기기·재설치 후 복구용. 응답은 `/stars` 응답과 같은 모양.

### `GET /coupons/me` — 내 쿠폰함

응답 200
```json
[
  {
    "id": "cp_sample",
    "title": "[원도심 로컬 카페 · 음료 할인]",
    "code": "482915730264",
    "status": "issued",
    "issued_at": "2026-10-29T21:10:00+09:00",
    "expires_at": "2026-11-12T23:59:59+09:00",
    "redeemed_at": null,
    "store_id": null
  }
]
```
- `status`: `issued`(사용 가능) · `redeemed`(사용 완료) · `expired`(만료)
- `code`: **숫자 12자리**. 프론트가 이 값으로 QR · 바코드(Code 39) · 번호를 같이 그립니다.
- 쿠폰 화면이 열려 있는 동안 프론트가 **5초마다 다시 부릅니다**(리더기에서 사용 처리되면 화면이 "사용 완료"로 바뀌게).

### 카페 리더기 사용 처리 — 서버 ↔ 카페 쪽 (프론트 관여 없음)

정해진 것: **카페 리더기가 손님 폰의 QR 을 스캔**. 실패하면 **바코드**, 그것도 안 되면 **직원이 12자리 번호 입력**.

권장 모양(서버에서 정해 주세요):
```
POST /coupons/redeem   { "code": "482915730264", "store_id": "s1", "store_secret": "..." }
→ 200 { "status": "redeemed", "redeemed_at": "..." }
→ 409 { "detail": "already_redeemed" }   /  410 { "detail": "expired" }  /  404
```
- `issued → redeemed` 는 DB 트랜잭션으로 한 번만(중복 사용 차단).
- `store_id` 가 쿠폰 사용 가능 매장인지 확인.
- 매장 대시보드·정산·KPI 는 이 기록으로 집계(브리프 §9·§10).

### `GET /stores` — 사용 가능 카페

쿼리: `lat`, `lng` (선택, 내 위치), `open_now` (선택, `true`), `coupon_id` (선택)

응답 200
```json
[
  { "id": "s1", "name": "[대흥동 카페 1]", "area": "대흥동", "lat": 36.3298, "lng": 127.4228,
    "hours": "11:00–23:00", "open_now": true, "night": true, "benefit": "[음료 1,000원 할인]" }
]
```
- 대상: **원도심 소상공인 카페만** (대기업·체인점 제외).
- `night`: 21시 이후까지 영업하면 `true` (프론트 "야간 영업" 필터).
- `open_now`: 서버 시각 기준으로 계산해 주세요.
- 거리는 프론트가 내 위치로 계산하니 없어도 됩니다(있으면 `distance_m`).
- 실제 매장 목록·혜택·비용 부담 주체는 아직 미정(브리프 §13).

## 4. 아직 정해지지 않은 것 (서버 설정값으로)

- QR 서명 형식, 데모 모드에서 GPS 통과 여부
- 위치 권한 거부 시 별 지급 정책
- 쿠폰 혜택 · 유효기간(프론트 기본 14일 표시) · 매장 지정 여부
- 제휴 카페 목록, 세 곳 야간 사용 협조 여부

## 5. 프론트 연결 방법

```bash
# Frontend 브랜치 루트
echo VITE_API_URL=http://localhost:8000 > .env.local
npm run dev
```
`.env.local` 이 없으면 고정 예시 데이터로 돌아갑니다.
