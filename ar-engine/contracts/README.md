# 별 헤는 밤 · 테미오래 — AR 엔진 계약(Contracts)

> 상태: **초안(DRAFT) — 승인 대기**
> 흑백 저충실도 와이어프레임(`docs/별헤는밤.proj-와이어프레임.pdf`)을 기준으로 작성.
> `[대괄호]` 표기는 와이어프레임과 동일하게 **확정 전 자리**를 의미합니다.

이 폴더는 AR 엔진과 주변 담당(에셋 제작·게임 셸) 사이의 **인터페이스 합의서**입니다.
코드 구현 전에 이 문서들을 먼저 확정합니다.

| 문서 | 대상 | 내용 |
| --- | --- | --- |
| [`asset-spec.md`](./asset-spec.md) | Codex(Blender 에셋) | 3D 모델·애니메이션·매니페스트 규격 |
| [`ar-api.md`](./ar-api.md) | 게임 셸(외부 호출자) | AR 엔진 호출 인터페이스(TypeScript) |
| [`tech-validation.md`](./tech-validation.md) | AR 담당(나) | WebXR 기본 기능으로 보장되지 않는 항목의 검증 관리 |
| [`building-alignment.md`](./building-alignment.md) | AR 담당 / Codex | 04-B 건물 정합 기술 설계 + 정합 검증용 임시 에셋 규격 |

---

## 역할 경계

| 영역 | 담당 | 비고 |
| --- | --- | --- |
| WebXR 세션·평면인식·모델 배치·장면 재생 | **AR 엔진(나)** | 본 저장소 `ar-engine/`만 수정 |
| 3D 모델·애니메이션·텍스처(.glb) | **Codex (Blender)** | `asset-spec.md` 준수 |
| 지도·도장판·퀘스트·방탈출 로직·전체 게임 UI | **게임 셸** | AR 엔진을 `ar-api.md`로 호출 |
| GPS 해금 판정 | **게임 셸** | AR 엔진은 "해금된 장면"만 받아 표시 |

> AR 엔진은 **게임 상태를 소유하지 않습니다.** 장면을 재생하고, 끝나면
> `sceneCompleted` 이벤트만 알립니다. 도장 지급·스탬프·진행도는 게임 셸이 결정합니다.

---

## 와이어프레임 화면 → AR 장면 타입 매핑

| 화면 | 에셋 category | 내 담당 범위 | 필요 에셋 | Codex 상태 |
| --- | --- | --- | --- | --- |
| 03 자동 인식 | (세션/평면 공통) | ① 세션 ② 히트테스트 | 레티클(엔진 내장) | — |
| 04-A 빈 땅 작품 | `emergent-artwork` | ③ 솟아오름 | 작품 모델 + `Emerge`/`Idle`/`Disappear` | **제작됨** (`starseed_sculpture`) |
| 04-B 건물 무대 | `building_stage`* | ④ 건물 정합 ⑥ 과거 복원 | 무대 + 과거/현재 + `RestoreIn` | 미제작 |
| 04-C 담장 전시관 | `wall_artwork`* | ⑤ 담장 배치 | 작품 패널(수직면) | 미제작 |
| 06 역할극 | `roleplay_scene`* | ⑦ 역할극 재생 | 실내 + 인물 + `Scene_NN` | 미제작 |
| 외부 호출 | — | ⑧ API | — | — |

> \* 미제작 유형의 category 문자열은 **확정 전**(확장 가능). category는 하나로 고정하지
> 않습니다. 애니메이션은 **접두사 없는** `Emerge`/`Idle`/`Disappear`(실제 GLB 기준, 정면 `-Z`,
> 기준점 `ANCHOR_*`)를 표준으로 하며, 엔진은 `AR_` 접두사도 호환 수용합니다.
> 자세한 합의는 [`asset-spec.md`](./asset-spec.md).

> 03의 "건물/빈 땅/담장 **자동** 판별"은 WebXR 기본 기능이 아닙니다 →
> [`tech-validation.md` TV-01](./tech-validation.md) 참조. 현재 설계는 **평면 방향(수평/수직)
> 힌트 + 사용자/게임 확정** 방식을 기본으로 합니다.

---

## 우선 지원 환경

- **Android Chrome + WebXR `immersive-ar`** 를 1순위로 지원.
- WebXR 미지원 환경은 **감지하여 안내**(`checkSupport()`), AR 세션을 시작하지 않음.
- 행사장 시연은 **데모 모드**(GPS 없이 가상 위치/임의 평면 배치).

---

## 검증 원칙 (중요)

- **실제 스마트폰에서 검증하지 않은 기능은 "완료"로 표시하지 않습니다.**
- 각 기능의 상태는 다음 중 하나로만 표기합니다.
  `구상(PLANNED)` · `구현됨·미검증(IMPLEMENTED, UNVERIFIED)` · `실기기 검증됨(VERIFIED)`
- WebXR 기본 기능으로 보장되지 않는 항목은 `tech-validation.md`에서 별도 관리합니다.

---

## 승인 체크리스트

- [ ] 장면 타입 5종(`emergent-artwork` / `building-stage` / `wall-gallery` / `roleplay` + 공통 세션) 범위 동의
- [ ] `asset-spec.md`의 좌표·단위·애니메이션 클립 명명 규칙 동의 (→ Codex 전달 가능)
- [ ] `ar-api.md`의 호출 인터페이스·이벤트 모델 동의 (→ 게임 셸 전달 가능)
- [ ] `tech-validation.md`의 리스크 항목 범위 동의
- [ ] `contracts/` 위치(`ar-engine/contracts/` vs 최상위 `contracts/`) 확정

> 위 항목 승인 후 **첫 번째 바닥 인식(hit-test) AR**부터 구현에 착수합니다.
