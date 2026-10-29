# 별 헤는 밤 — 테미오래 AR 야간 투어 (해커톤, 우송대 무박 2일)

주제: 원도심 근대문화유산 및 지역 예술인 협업 프로젝트 연계 문화 콘텐츠.
장소: 테미오래(대전 관사촌). 행사 야간 개방(~22시) 관람. 시연: 안드로이드 크롬(WebXR).

## 확정 기획 (이것만 만든다 — 기능/화면/설명 임의로 더하지 말 것)
- 전체 틀 = 도장깨기. 관사마다 도장 2개: 역할극 · 방탈출.
- MVP: 실제 건물 = 작가의 무대. 작가가 연출한 옛 모습이 건물에 겹쳐짐.
  옛 시대 배경 작품이면 지금은 없는 부분이 **자동** 복원(탭 없음), 설명 말풍선은 유지.
- 인식 대상 3가지: 빈 땅 → 지역 작가 작품이 땅에서 솟아남(작가가 실물 안 옮겨도 됨) /
  건물 → 무대·옛 모습 / 담장 → 미술 전시관(걸으며 감상). 빈 전시 자리는 액자 없이 별무리.
- 역할극 = 스토리보드: 밖에서 비추면 벽이 비쳐 보이고 건물 안에서 그 시대 인물들이 이야기 진행.
  작가는 창작자(등장인물 아님). 장면이 모여 스토리보드 완성.
- 불필요한 버튼 금지. "사라진 건물 복원" 같은 요청 안 한 기능 금지.

## 화면 (와이어프레임과 1:1)
01 home · 02 map(도착한 관사만 열림, 데모 모드) · 03 scan(비추면 자동 인식 → "이야기로 들어가기") ·
04-A artwork(빈 땅) · 04-B stage(건물=무대, MVP) · 04-C wall(담장 전시관) · 05 sheet(건물 이야기·미션) ·
06 roleplay · 07 escape · 08 stamps(스토리보드).
와이어프레임: https://claude.ai/artifact/RpcBjUkxZdV5EucPci53fF (회색 = 실제 카메라, 흰/점선 = AR)

## 코드
- React 19 + Vite + three. `npm i && npm run dev`. 화면 이동은 `src/store.jsx`의 `go(name)` (라우터 없음).
- 레이아웃은 LoboDoc PWA(`C:\Dev\lobodoc_server-local\lobodoc-local\pwa`, style.css) 참조:
  얇은 상단바 · main 560px/20px · 52px 버튼. LoboDoc 파일은 수정 금지.
  하단 탭바 없음(와이어프레임대로 ‹ 뒤로 가기로 이동). 화면 틀은 37.5 보호자 앱(kwon9009/37.5 `frontend/src/guardian`) 규칙:
  `src/ui/Screen.jsx` 의 Screen · TopBar(뒤로·제목·오른쪽) · StickyAction(하단 고정 버튼, 가려진 내용 있으면 반투명) · Peek(AR 하단 시트).
- `src/lib/`: geo.js(GPS 해금, 데모 좌표) · ar.js(WebXR immersive-ar + hit-test, autoPlace) · artwork3d.js · qr.js · episodes.js(관사 데이터, [대괄호] = 확정 전).
- 폰 시연: `npm run build && npx vite preview --port 4173` → `adb reverse tcp:4173 tcp:4173` → 폰 크롬 `localhost:4173` (보안 컨텍스트라 카메라/WebXR 됨).

## 남은 일
- 인식 판별은 지금 관사 데이터 `target`으로 대체 → hit-test 평면 방향(바닥/세로면) + 건물 마커로 교체.
- 작가 옛 모습 이미지·작품 3D(glTF)·역할극 대본·방탈출 단서·관사 좌표 확정본으로 교체.
- 담장 전시관은 지금 스와이프 → 걸음에 맞춰 넘기기.
- 제안만 하고 미확정: 07 방탈출을 "별자리 퍼즐 → 퀴즈 → 자물쇠"로.

## 규칙
- 커밋에 Claude 공동작성자/서명 줄 넣지 말 것.
