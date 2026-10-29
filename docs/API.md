# 별 헤는 밤 — 통합 앱 계약

REST의 상세 스키마는 [backend/API.md](../backend/API.md), AR 콘텐츠·플랫폼 계약은
[app-integration.md](../ar-engine/contracts/app-integration.md)를 따른다.
과거 GPS+QR·X-Device-Token 계약은 현재 실행 코드에 적용하지 않는다.

## 주소와 실행

`npm run build` 후 `npm start`로 UI(`/`)·AR(`/ar/`)·REST(`/api/v1`)를 같은 origin에서 제공한다.
개발은 `npm run dev`를 사용한다. Vite가 REST와 AR을 통합 백엔드로 프록시한다.
`VITE_API_URL`을 비우면 같은 origin의 실제 API를 사용한다. 샘플 모드는 `VITE_SAMPLE_MODE=1`로 지정한다.

## 프론트 호출

| 앱 동작 | API | 계약 |
|---|---|---|
| 최초 접속 | POST `/api/v1/sessions` | session_id를 기기에 저장 |
| 진행 복구 | GET `/api/v1/stars?session_id=...` | 서버 별과 기기의 미전송 별을 합침 |
| 미션 완료 | POST `/api/v1/checkin`, POST `/api/v1/experiences/complete` | session_id, spot_id, kind 전송 |
| 쿠폰함 | GET `/api/v1/coupons?session_id=...` | 현재 회차와 지난 회차 쿠폰 조회 |
| 카페 지도 | GET `/api/v1/stores` | 공유 카페 ID의 상태·위치·시간을 표시 |
| 카페 쿠폰 사용 | POST `/api/v1/coupons/redeem-by-code` | code와 store_id, 손님 session_id 불필요 |
| AR 작품·공연 | GET `/ar/api/ar/v1/experiences/{id}.json` | starseed 또는 black-uniform 조회 후 iframe 실행 |

완료 요청은 미션마다 전송한다. a/b는 role·escape, c는 view·escape이며 총 별 6개다.
서버는 호환성을 위해 c/view를 기존 c/role 슬롯에 저장한다. 둘을 중복 전송해도 별은 하나다.
클라이언트는 c/role 조회를 h3:view로 표시한다. 동시 완료 요청은 직렬화해 체크인 장소가 섞이지 않게 한다.

연결 실패 시 별은 기기에 남고 저장 대기 메시지와 재시도 버튼을 표시한다.
세션이 서버에서 사라지면 새 세션을 받아 현재 로컬 진행을 복구한다.
다음 회차는 새 세션을 사용하고 지난 세션의 쿠폰은 쿠폰함에 유지한다.

## AR와 보상

AR 프레임 완료 메시지는 origin·contentWindow·일회용 token·콘텐츠 ID·실행 모드를 확인한다.
4인 공연은 실제 추적 경로에서 비테스트 공연을 끝까지 재생한 뒤 사용자가 확인한다.
프레임 닫기·미리보기·Quick Look 복귀는 공연 완료가 아니다.
전시 보기의 명시적 확인과 기존 데모 건너뛰기는 프론트 기획대로 유지한다.

`shared/tour.json`이 프론트·통합 백엔드의 스팟과 카페 ID 기준이다.
카페 좌표는 기존 프론트의 임시값이고 제휴·영업시간·혜택은 확정 전이다.
서버가 미확정 영업시간을 null로 반환하면 화면은 확인 필요로 표시한다.
