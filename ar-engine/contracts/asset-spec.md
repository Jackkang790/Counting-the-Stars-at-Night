# AR 에셋 규격 (Codex ↔ AR 엔진 합의)

> 상태: **초안(DRAFT) — 승인 대기**
> 이 문서는 Codex가 **이미 확립한** 규약(`blender/README.md` §Claude Code 인계 규약,
> `public/models/asset-manifest.json` schema v1.0.0)을 **기준으로 채택**하고, 아직
> 제작되지 않은 장면 타입(건물 무대·담장·역할극)으로 **확장**하는 합의서입니다.
> 상충 시 **Codex의 실제 산출물·매니페스트가 우선**하며, 본 문서를 맞춥니다.

---

## 0. 이미 확정된 규약 (Codex 산출물 기준 — 그대로 따름)

첫 에셋 `starseed_sculpture`(category `emergent-artwork`)에서 확립됨. 아래는 **실제 GLB
바이너리를 파싱해 확인한 값**입니다(2026-10-29):

- **단위**: 1 unit = 1 m. **Y-up, 오른손 좌표계, 정면은 `-Z`.**
  Blender `(x,y,z)` → GLB `(x,z,-y)`.
- **포맷**: glTF 2.0 Binary(`.glb`), 외부 리소스 없음. 현재 무압축(디코더 불필요).
- **기준점(anchor)**: 명명 노드 **`ANCHOR_*`**(현재 작품은 `ANCHOR_Ground`), 원점
  `(0,0,0)` = **바닥 접지 중심**, 지면은 **GLB `Y=0`**. 작품 메시들은 이 노드의 자식.
- **배치 규칙(중요)**: 엔진은 **GLB를 배치용 Group으로 감싸고, 그 Group에만
  AR hit-test 위치·회전을 적용**한다. 애니메이션 클립은 내부 `ANCHOR_*`의 로컬 TRS를
  제어하므로 배치 변환과 분리된다. 기본 크기에서 지면 높이·중심 재보정 안 함.
- **애니메이션 명명**: **`Emerge` / `Idle` / `Disappear`**. 모든 클립 **0초 시작**.
  `Emerge`(1회·끝유지, hidden→visible), `Idle`(반복, ±2° yaw), `Disappear`(1회·끝유지,
  visible→hidden). 세 클립 모두 `ANCHOR_*` 노드의 translation/rotation/scale을 구동.
  (`Emerge`는 지하 이동이 아니라 **원점 기준 스케일 성장**으로 솟아오름.)
  - **등장 전 `Emerge`를 t=0에서 평가 후 표시**(전체 크기 깜빡임 방지).
    완료 후 `Idle`로 **즉시 전환**(긴 crossfade 비권장). 클립 전환 시 이전 Action
    정지 + 다음 Action reset.
  - 🔧 **호환**: 엔진은 클립을 `AR_` 접두사 제거 + 대소문자 무시로 탐색하므로
    (`loaders/gltf.ts findClipLoose`) `Emerge`/`AR_Emerge` 양쪽 모두 동작. 신규 에셋은
    **접두사 없는** 이름(`Emerge`…)을 **표준**으로 한다.
- **배포 경로/URL**: 파일은 `public/models/<name>.glb`, URL은 `/models/<name>.glb`.
  에셋 카탈로그는 `public/models/asset-manifest.json`.
- **GLB에 포함하지 않는 것**: 지면 구멍 메시, depth occlusion, 그림자 수신 평면,
  렌더 전용 카메라/광원.

> 엔진 측 로더는 위 규약(특히 배치 Group 분리, AR_ 클립 의미, t=0 평가)을
> **그대로 구현**합니다.

---

## 1. 매니페스트 스키마 (`public/models/asset-manifest.json`, v1.0.0)

Codex가 쓰는 실제 스키마를 기준으로 합니다. 핵심 필드(발췌):

```jsonc
{
  "schema_version": "1.0.0",
  "project": "별 헤는 밤 · 테미오래 AR",
  "assets": [
    {
      "id": "starseed_sculpture",
      "version": "0.1.0",
      "category": "emergent-artwork",      // §2 카테고리 어휘(확장 가능)
      "status": "provisional_concept",     // 확정 전 표기
      "url": "/models/starseed_sculpture.glb",
      "units": "meters", "meters_per_unit": 1,
      "coordinates": { "gltf": "right-handed; +Y up; -Z front" },
      "anchor": { "node": "ANCHOR_Ground", "type": "ground_center",
                  "contact_plane": "Y=0", "placement": "horizontal surface" },
      "rest_state": "visible_full_size",
      "bounds_gltf_m": { "min": [..], "max": [..], "size": [..] },
      "recommended_scale": 1,
      "animations": [
        { "name": "Emerge", "duration_seconds": 3, "loop": "once",
          "clamp_when_finished": true, "next": "Idle",
          "start_state": "hidden", "end_state": "visible" },
        { "name": "Idle", "duration_seconds": 4, "loop": "repeat" },
        { "name": "Disappear", "duration_seconds": 1.5, "loop": "once",
          "clamp_when_finished": true, "start_state": "visible", "end_state": "hidden" }
      ],
      "performance": { "triangles": 8484, "textures": 0,
        "budgets": { "triangles_max": 12000, "vertices_max": 15000,
                     "glb_bytes_max": 1500000 } },
      "validation": { "khronos_errors": 0, "mobile_webxr_device_tested": false }
    }
  ]
}
```

- 엔진은 `assets[].id`로 에셋을 찾고, `url`을 로드하고, `anchor`/`animations`로 재생합니다.
- `validation.mobile_webxr_device_tested`는 **실기기 검증 전 false**(프로젝트 원칙과 일치).

---

## 2. 카테고리 어휘 (category) — **확장 가능**

`category`는 **고정 목록이 아니라 확장 어휘**입니다. 현재 확정값은 `emergent-artwork`
하나지만, 건물 복원·담장 전시·역할극 등 새 AR 유형을 계속 추가합니다. 엔진은 category를
**임의 문자열로 수용**(`AssetEntry.category: string`)하므로 새 값 추가에 엔진 변경이
필요 없습니다.

| category | 와이어프레임 | 상태 | 비고 |
| --- | --- | --- | --- |
| `emergent-artwork` | 04-A 빈 땅 | **제작됨(provisional)** | Codex 확정값 |
| `building_stage` | 04-B 건물 무대 | **제안(미제작, 명칭 미확정)** | 과거↔현재 포함 |
| `wall_artwork` | 04-C 담장 | **제안(미제작, 명칭 미확정)** | 수직면 패널 |
| `roleplay_scene` | 06 역할극 | **제안(미제작, 명칭 미확정)** | 실내 합성 |

> 미제작 유형의 category 문자열(하이픈/언더스코어 표기 포함)은 Codex가 실제 제작 시
> 확정합니다. 아래 §3 확장안은 그때 적용을 **제안**하는 내용이며, 접두사 없는 클립
> 이름을 표준으로 합니다.

---

## 3. 신규 카테고리 확장안 (제안 — Codex 검토 요청)

기존 규약(§0)을 그대로 이어가고, 아래만 추가합니다.

### 3.1 `building_stage` (04-B)
- **anchor.type**: `building_base` (건물 지면 접지 중심, `Y=0`).
- **과거↔현재**: 지오메트리를 **두 그룹으로 분리** — 현재 존재 `PRESENT_*`,
  복원 대상(지금 없음) `PAST_*`. 동일 원점·정렬 공유, Z-파이팅 회피.
  엔진이 `setTimePhase(0..1)`로 두 그룹 가시성/투명도 블렌딩.
  - 매니페스트 추가 필드: `"time_phase": { "enabled": true }`.
- **클립**(접두사 없는 표준): `Reveal`(등장), `RestoreIn`(복원 요소 등장, 선택), `Idle`(선택).
- **정합 데이터**: 스팟별 정렬 보조(기준 이미지/마커/상대 포즈)는
  [`tech-validation.md` TV-03](./tech-validation.md)에서 관리. 에셋은 **실척 1:1**로만 제공.

### 3.2 `wall_artwork` (04-C)
- **anchor.type**: `wall_center` (작품 **뒷면(벽 접촉면)** 중심, 패널은 +Z가 관람자 방향).
- 작품 1점 = `.glb` 1개. 순서·선택은 게임/카탈로그가 관리.
- **클립**: 보통 정적. 선택 `Highlight`.
- 엔진은 수직면에 뒷면을 밀착(수직 Hit Test, [TV-02](./tech-validation.md)).

### 3.3 `roleplay_scene` (06)
- **anchor.type**: `building_base`.
- **벽 투명화**: 투명 대상 벽 그룹 `WALL_*`, 클립 `WallDissolve` 또는 엔진 제어 머티리얼.
  (실제 투시 아님 — 가상 실내 합성, [TV-04](./tech-validation.md).)
- **장면 타임라인**: `Scene_01` … `Scene_NN`(순서대로). 인물별 `Idle` 가능.
- **대사/자막은 모델에 굽지 않음**. 매니페스트 `scenes[]`로 타이밍 전달:
  ```jsonc
  "scenes": [ { "clip": "Scene_01", "captions": [ { "t": 0.0, "text": "[대사]" } ] } ]
  ```

### 3.4 예산(제안)
- `emergent-artwork`/`wall_artwork`: Codex 기존 예산 유지(≤12k tris, ≤1.5 MB).
- `building_stage`/`roleplay_scene`: 규모상 상향 필요 가능 → **카테고리별 예산을
  Codex와 협의**(장면 총합 기준, KTX2/Draco 도입 여부 포함). 임의 상향 안 함.

---

## 4. 엔진이 매니페스트에서 소비하는 필드 (요약)

| 필드 | 용도 |
| --- | --- |
| `id`, `url` | 에셋 식별·GLB 로드 |
| `anchor.node`, `anchor.type` | 배치 Group 생성·정렬 기준 |
| `bounds_gltf_m` | 배치 미리보기·레티클 스케일 |
| `recommended_scale` | 기본 스케일(기본 1.0) |
| `animations[]` (`name/loop/clamp_when_finished/next/start_state`) | 클립 재생 규칙 |
| `time_phase` | building_stage 슬라이더 |
| `scenes[]` | roleplay 장면·자막 |
| `status`, `validation.mobile_webxr_device_tested` | 미검증 표기 |

---

## 5. 미확정(와이어프레임 "확정 필요")
- 에피소드 건물 3곳: `residence-16`, `residence-42`(소제동), `heredium`(인동) — 스팟·앵커 데이터.
- 협업 작가·작품 목록 → `wall_artwork` 패널 수, `credits`.
- 역할극 대본(장면 수, 대사) → `scenes[]`.
- 방탈출의 AR 관여 범위(현재 게임 로직으로 간주).
