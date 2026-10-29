# 별 헤는 밤 — 원도심 근대건축 AR 야간 투어 (해커톤, 우송대 무박 2일)

주제: 원도심 근대문화유산 및 지역 예술인 협업 프로젝트 연계 문화 콘텐츠.
기준 문서: 「별헤는밤_프로젝트_브리프_for_AI_Agent.md」(2026-10-29). 예전 테미오래 와이어프레임(역할극·방탈출 도장)은 폐기.
시연: 안드로이드 크롬(WebXR). 앱 설치 없는 모바일 웹.

## 확정 기획 (이것만 만든다 — 기능/화면/설명 임의로 더하지 말 것)
- 스팟 3곳: 관사 16호(ACT 1) · 관사 42호(ACT 2) — 소제동 철도관사촌 / 헤레디움(피날레) — 인동.
- 별 6개 = 스팟마다 2개: ① 건물 외벽에 예술가의 **짧은** AR 뮤지컬 영상(80% 이상 보면 별) ② 근처 별길의 예술가 작품(땅에서 솟아남).
- 별 6개(별자리 완성) → 서버가 카페 쿠폰 자동 발급 + **이어진 이야기 전체 영상** 열림 → 카페에서 커피 마시며 감상.
- 도착 확인(기능 1.1): GPS 스팟 반경(기본 40m) 안일 때만 건물 앞에 **앱 안 가상 QR**이 뜸(실물 바닥 QR 없음) → 누르면 서버가 GPS+QR 확인.
  외벽 이미지 인식은 AR 타깃 준비되면 추가.
- 쿠폰 사용: 카페 리더기가 손님 폰 QR 스캔 → 실패 시 바코드 → 그래도 안 되면 직원이 12자리 번호 입력. 상태 issued/redeemed/expired.
- 카페: 원도심 소상공인 카페만(대기업·체인점 제외). 지도는 약도 + 목록(카카오 키 없이), 길찾기는 카카오맵 링크.
- 브리프 §13 미정 항목(관사 42호 사용 여부, 매장·혜택, 위치 거부 시 정책 등)은 `[대괄호]` 자리표시 / `CONFIG` 설정값. 임의로 확정 금지.

## 화면
01 home(나의 별자리) · 02 map(스팟·별 포인트 6곳, 데모 모드) · 03 point(GPS + 가상 QR) · 04 musical(짧은 영상) ·
04-A artwork(별길 작품) · 05 stars(별자리·완성 보상) · 06 coupons(QR·바코드·번호) · 07 stores(카페 약도+목록) · 08 story(전체 영상).

## 코드
- React 19 + Vite + three. `npm i && npm run dev`. 화면 이동은 `src/store.jsx`의 `go(name, pointId)` (라우터 없음).
- 레이아웃은 LoboDoc PWA(`C:\Dev\lobodoc_server-local\lobodoc-local\pwa`, style.css) 참조:
  얇은 상단바 · main 560px/20px · 52px 버튼. LoboDoc 파일은 수정 금지. 하단 탭바 없음(‹ 뒤로 가기로 이동).
  화면 틀은 37.5 보호자 앱(kwon9009/37.5 `frontend/src/guardian`) 규칙: `src/ui/Screen.jsx` 의 Screen · TopBar · StickyAction.
- `src/lib/`: spots.js(스팟·포인트·CONFIG) · api.js(서버 호출) · geo.js(GPS 반경, 데모 좌표) · ar.js(WebXR hit-test) · artwork3d.js · qr.js · barcode.js(Code 39).
- `src/ui/`: Clip.jsx(짧은 영상 — src 없으면 자리표시 장면, 본 시간만 셈) · Constellation.jsx · Camera.jsx · chrome.jsx(ArHead) · useFit.js(위치 맞추기).
- 폰 시연: `npm run build && npx vite preview --port 4173` → `adb reverse tcp:4173 tcp:4173` → 폰 크롬 `localhost:4173` (보안 컨텍스트라 카메라/WebXR 됨).

## 서버 (팀원 담당 — 여기서 만들지 않음)
- FastAPI + DB 는 팀원이 만든다. 프론트는 **서버 코드 금지**, 약속은 `docs/API.md` 로만 알린다.
- `src/lib/api.js`: `VITE_API_URL` 있으면 서버, 없으면 API.md 응답 예시와 같은 **고정 예시 데이터**(판정 로직 없음).

## 남은 일
- 영상(musical.src · STORY.src), 작품 glTF, 작가 소개·후원 링크, 스팟·포인트 좌표 확정본으로 교체.
- 외벽 기준점 이미지 인식(지금은 "위치 맞추기"로 수동 정렬).
- 서버 연결 후 QR 서명 형식 맞추기.

## 규칙
- 커밋은 `Frontend` 브랜치에만, 작성자 Coolguyzero 로만. 다른 멤버 브랜치·스택은 건드리지 않는다.
- 커밋에 Claude 공동작성자/서명 줄 넣지 말 것.
