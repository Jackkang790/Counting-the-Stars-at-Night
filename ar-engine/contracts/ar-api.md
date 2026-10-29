# AR 호출 인터페이스 (제안 — 외부 웹앱/게임 셸용)

> 상태: **초안(DRAFT) — 승인 대기**
> 대상: AR 엔진을 호출하는 외부 서비스(지도·쿠폰·GPS·도장은 외부 담당)
> 핵심 원칙: **AR 엔진은 상태를 소유하지 않는다.** 체험을 재생하고 결과 이벤트만 반환.

---

## 1. 진입점

```typescript
import { createARExperience } from "@temiore/ar-engine"; // 패키지명 제안

const arExperience = createARExperience({
  catalogUrl: "/assets/catalog.json",  // (building, spot, experience) → 에셋 매핑
  mode: "geo",                          // "geo"(실제 투어) | "demo"(행사장 가상 위치)
  container: document.getElementById("ar-root"), // (선택) 미지정 시 전체화면 오버레이
});
```

외부 서비스는 GPS 인증·도착 확인을 **자체적으로** 끝낸 뒤, 해금된 체험을 `start()`로 호출합니다.

---

## 2. 지원 여부 검증 (호출 전 필수)

```typescript
const report = await arExperience.checkSupport();
// report: ARSupportReport
if (!report.supported) {
  showGuide(report.guidanceMessage); // 미지원 안내 후 AR 미실행
}
```

```typescript
interface ARSupportReport {
  supported: boolean;
  webxr: boolean;              // navigator.xr 존재
  immersiveAR: boolean;        // isSessionSupported('immersive-ar')
  features: {
    hitTest: boolean;
    domOverlay: boolean;
    lightEstimation: boolean;  // 추정(보장 아님)
    anchors: boolean;
  };
  // 미지원 원인 코드: no-webxr | no-immersive-ar | insecure-context | no-hit-test | unknown
  reason?: SupportFailureReason;
  guidanceMessage: string;     // 사용자 안내용(한국어) — 예: "Android Chrome 최신 버전에서 실행해 주세요"
}
```

> 미지원·불확실 환경에서 **가짜 AR로 대체하지 않습니다.** 명확히 안내하고 중단합니다
> (프로젝트 원칙 및 [`tech-validation.md`](./tech-validation.md)).

---

## 3. 체험 시작 / 종료

와이어프레임과 요구사항에 맞춘 식별자 3종으로 체험을 지정합니다.

```typescript
await arExperience.start({
  buildingId: "residence-16",   // residence-16 | residence-42 | heredium
  spotId: "spot-01",            // 촬영 포인트
  experienceId: "historical-scene",
});

await arExperience.stop();      // 세션 종료·자원 해제
```

```typescript
interface StartRequest {
  buildingId: string;           // 대상 장소
  spotId: string;               // 촬영 포인트(정렬 기준이 달라질 수 있음)
  experienceId: string;         // 아래 체험 종류
  overrides?: {                 // (선택) 데모·디버그용
    manifestUrl?: string;       // 카탈로그 대신 직접 매니페스트 지정
    scale?: number;
  };
}
```

### 체험 종류(experienceId) → AR 장면 타입

| experienceId(예) | 장면 타입 | 와이어프레임 | 비고 |
| --- | --- | --- | --- |
| `emergent-artwork` | `emergent-artwork` | 04-A 빈 땅 | 바닥 히트테스트 배치 |
| `historical-scene` | `building-stage` | 04-B 건물 무대 | 과거↔현재, 요정렬 |
| `wall-gallery` | `wall-gallery` | 04-C 담장 | 수직면 배치 |
| `roleplay` | `roleplay` | 06 역할극 | 가상 실내 합성 |

> 실제 `experienceId` 목록은 `catalog.json`으로 확정합니다(와이어프레임 "확정 필요").

---

## 4. 이벤트 모델

요구된 이벤트(시작·종료·에셋 로딩·준비 완료·인식 실패·체험 완료·오류)를 모두 제공합니다.

```typescript
arExperience.on("sessionStarted", (e) => {});      // WebXR 세션 진입
arExperience.on("assetProgress",  (e) => {});      // GLB 로딩 진행률
arExperience.on("ready",          (e) => {});      // 배치 가능(레티클 표시) 상태
arExperience.on("placed",         (e) => {});      // 사용자가 장면 배치 완료
arExperience.on("trackingLost",   (e) => {});      // 평면/정렬 인식 실패·유실
arExperience.on("experienceCompleted", (e) => {}); // 체험 종료(도장 지급은 외부가 결정)
arExperience.on("error",          (e) => {});      // 오류
arExperience.on("sessionEnded",   (e) => {});      // 세션 해제
```

```typescript
interface AssetProgressEvent { sceneId: string; loaded: number; total: number; }
interface TrackingLostEvent   { reason: "no-plane" | "alignment-lost" | "low-light"; }
interface ExperienceCompletedEvent {
  buildingId: string; spotId: string; experienceId: string;
  durationMs: number;
  // 외부 서비스가 이 이벤트를 받아 쿠폰/도장 처리. 엔진은 지급하지 않음.
  payload?: Record<string, unknown>;
}
interface ARErrorEvent { code: string; message: string; recoverable: boolean; }
```

> **쿠폰/도장 발급 로직은 엔진에 없습니다.** 외부 서비스가 `experienceCompleted`를
> 수신해 처리합니다.

---

## 5. 체험 중 제어 (장면 타입별)

게임 UI 버튼 등이 호출하는 선택적 제어 API.

```typescript
// building-stage: 과거↔현재 슬라이더 (0 = 옛 모습, 1 = 현재)
arExperience.setTimePhase(0.0);

// roleplay: 장면 진행
arExperience.advanceScene();     // "다음 장면"
// → 마지막 장면 종료 시 experienceCompleted 발생

// wall-gallery: 작품 선택(상세 콘텐츠는 외부 UI가 표시)
arExperience.on("hotspotSelected", (e) => {}); // { hotspotId }

// 공통
arExperience.recenter();         // 배치 다시 하기
```

---

## 6. 모드

| mode | 동작 |
| --- | --- |
| `geo` | 실제 투어. 외부에서 GPS 해금 후 호출. 엔진은 평면인식/정렬로 배치 |
| `demo` | 행사장 시연. GPS 무관, 임의 바닥/가상 위치에 배치(와이어프레임 "데모 모드") |

---

## 7. 카탈로그 (`catalog.json`)

`(buildingId, spotId, experienceId)` → **Codex 에셋 `id`** 매핑. 엔진이 로드합니다.
에셋 자체의 규격·경로는 Codex의 `public/models/asset-manifest.json`이 소유하고,
이 카탈로그는 **체험 라우팅**만 담당합니다(관심사 분리).

```jsonc
{
  "buildings": {
    "residence-16": {
      "title": "관사 16호",
      "spots": {
        "spot-01": {
          "experiences": {
            "emergent-artwork": {
              "assetId": "starseed_sculpture",  // asset-manifest.json 의 id
              "alignment": "hit-test"            // hit-test | image-marker | manual (TV-03)
            }
            // "historical-scene": { "assetId": "[미제작]", "alignment": "image-marker" }
          }
        }
      }
    },
    "residence-42": { "title": "관사 42호(소제동)", "spots": {} },
    "heredium":     { "title": "헤레디움(인동)",     "spots": {} }
  }
}
```

> 에셋 매니페스트 구조·category·클립 규약은 [`asset-spec.md`](./asset-spec.md) 참조.
> 현재 실제 매핑 가능한 에셋은 `starseed_sculpture`(`emergent-artwork`) 1종뿐입니다.

---

## 8. 엔진이 **하지 않는** 것 (경계)

- GPS 도착 인증 / 쿠폰 발급·사용 / 가맹점 지도 / 회원가입 / 도장 관리 / 보상 시스템
- 위 항목은 모두 외부 서비스 담당. 엔진은 **체험 재생 + 결과 이벤트**만 제공.

---

## 9. 독립 테스트 페이지

AR 개발·검증을 위한 **최소 테스트 하네스**(`ar-engine/` 내부)를 제공합니다.
- 체험 종류/빌딩/스팟 선택 → `start()` 호출
- 지원 여부 리포트 표시, 이벤트 로그 패널
- `demo` 모드로 GPS 없이 실행
- 이 페이지는 전체 게임 UI가 아니며, 엔진 검증 용도입니다.
