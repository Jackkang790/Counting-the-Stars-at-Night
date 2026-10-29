# ar-engine — 별 헤는 밤 · 테미오래 WebAR 엔진

WebXR 기반 AR 엔진. **AR 기능만** 담당합니다(지도·GPS·쿠폰·도장·게임 UI는 범위 밖).
계약 문서는 [`contracts/`](./contracts/) 참조.

## 현재 구현 상태 (1차 프로토타입)

> ⚠️ **실제 Android 기기 검증 전입니다. AR 세션 동작은 "완료"가 아닙니다.**
> 아래 WebXR 항목은 `IMPLEMENTED·UNVERIFIED`(구현됨, 미검증) 상태입니다.

- WebXR `immersive-ar` 세션 관리 + 지원 여부 감지/안내 (`checkSupport`)
- Hit Test 바닥 인식 + 레티클, 탭 배치(배치 Group 분리 — Codex 규약)
- "땅에서 솟아오름": Codex GLB의 `Emerge`(t=0 평가) → `Idle` → `Disappear`
  - 클립 이름은 `AR_` 접두사도 호환 수용(`findClipLoose`)
  - GLB 미로드 시 **임시 모델**로 동일 의미의 절차적 등장
- 작품 터치 상호작용(레이캐스트 → 펄스 + `hotspotSelected`)
- AR 실패 진단 로그(`runDiagnostics`) + 세션 오류 원인 해석
- 외부 연동 API 골격 (`createARExperience`) + 이벤트
- 독립 테스트 하네스(`index.html`)

### 헤드리스로 **검증된** 것 (실기기 불필요한 부분)
- ✅ 실제 Codex GLB(`starseed_sculpture.glb`) 파싱 + `Emerge→Idle→Disappear` 믹서 구동
  — `npm run verify:asset` (Emerge 스케일 0→1, Idle ±2° yaw, Disappear 1→0 측정)
- ✅ `tsc` 타입검사 · `vite build` 번들 · HTTPS로 GLB/매니페스트 200 서빙

## 실행 방법

```bash
cd ar-engine
npm install
npm run dev          # https://localhost:5173 (basic-ssl 자체 서명 인증서)
npm run verify:asset # 헤드리스 GLB 로드/애니메이션 검증
npm run typecheck
npm run build
```

## Android Chrome 실기기 테스트 절차 (필수 — WebXR은 실기기에서만 동작)

### 사전 조건
- **Android 기기** + **ARCore 지원**(대부분의 최신 기기). Play 스토어에서
  **"Google Play 서비스(AR)"** 설치/업데이트.
- **최신 Chrome for Android**. (iOS Safari는 WebXR AR **미지원** — `checkSupport`가 안내)
- PC와 폰이 **같은 Wi-Fi**.

### 단계
1. PC에서 `npm run dev` 실행. 출력의 **Network** 주소 확인: `https://<PC-IP>:5173`.
   - 방화벽이 5173 인바운드를 막으면 허용(사설 네트워크).
2. 폰 Chrome에서 `https://<PC-IP>:5173` 접속.
3. 자체 서명 인증서 경고 → **고급 → 계속 진행**(HTTPS 필수, WebXR은 보안 컨텍스트에서만).
4. 화면 상단 **지원 여부**가 "● AR 지원"인지 확인.
   - "미지원"이면 **[환경 진단 로그]** 버튼 → 로그/콘솔에서 원인 확인
     (`webxr`, `immersive-ar`, `secure` 값).
5. **[AR 시작]** → 카메라 권한 허용.
6. 바닥을 천천히 비추면 **레티클(링)** 표시 → 바닥을 **탭** → 작품 배치 →
   **Emerge(솟아오름) → Idle(대기)**.
7. 작품을 **탭** → 강조 펄스(상호작용).
8. **[작품 퇴장(Disappear)]** → 퇴장 재생 → 다시 바닥 탭 시 재배치/재등장.
9. **[AR 종료]** 로 세션 종료.

### 유선(USB) 대안 — 인증서/방화벽 이슈 회피
- 폰 USB 연결 + **chrome://inspect**(PC) → **Port forwarding**로 `5173`을 폰 `localhost:5173`에 매핑.
- 폰 Chrome에서 `https://localhost:5173` 접속(localhost는 보안 컨텍스트로 인정).

### 문제 발생 시 진단
- 하네스 **[환경 진단 로그]** 또는 콘솔(`chrome://inspect` 원격 디버깅)에서
  `[AR 진단 …]` 블록과 `세션 시작 실패 [code]` 메시지로 원인 파악.
- 흔한 원인: 비보안(HTTP) 접속, ARCore 미설치, 카메라 권한 거부, 구형 Chrome.

## 구조
```
src/
  index.ts              공개 API: createARExperience
  engine.ts             세션/루프/배치/이벤트/진단 오케스트레이션
  types.ts              ar-api.md 대응 타입
  events.ts             타입 이벤트 버스
  core/ support.ts      WebXR 지원 감지 + 안내
       diagnostics.ts   환경 진단 + 세션 오류 해석
       reticle.ts       hit-test 레티클
       placement.ts     배치 Group(Codex 규약)
  loaders/ manifest.ts  asset-manifest.json / catalog 로더
          gltf.ts       GLB + findClipLoose(AR_ 접두사 호환)
  scenes/ emergingArtwork.ts  04-A Emerge→Idle→Disappear
          placeholder.ts      임시 모델 폴백
scripts/ verify-asset.mjs     헤드리스 GLB/애니메이션 검증
index.html + src/main.ts      독립 테스트 하네스
```

## Codex 연동 (규약 — 실제 GLB 기준)
- 에셋은 레포 루트 `public/models/`(Codex 소유)에서 서빙. Vite `publicDir`를 `../public`로 지정.
- 좌표: **`-Z` 정면**, Y-up, 1 unit = 1 m. 기준점 노드 **`ANCHOR_*`**(현재 `ANCHOR_Ground`).
- 애니메이션: **`Emerge`/`Idle`/`Disappear`**(접두사 없음, 엔진은 `AR_`도 호환). 배치 Group 분리.
- category는 **확장 어휘**(현재 `emergent-artwork`, 향후 유형 추가). 상세
  [`contracts/asset-spec.md`](./contracts/asset-spec.md).
- **Codex의 `blender/`·`public/models/`는 수정/삭제하지 않습니다.**

## 미검증 / 다음 단계
- **실기기(Android Chrome) AR 세션·배치·성능·시인성 검증** (TV-06/07)
- 04-B 건물 정합/과거 복원, 04-C 담장 수직면, 06 역할극 (TV-02/03/04)
- WebXR anchors로 월드 고정 강화, light-estimation 적용
