# Claude Code 전달 — 외벽 정합 시험물 0.1.0

이 문서와 실제 GLB는 **feature/blender-assets 전용 worktree**에 있다. 이번 새 파일을 공유 루트의 `public/models/`나 `ar-engine/`에 복사하지 않았다.

## 위치

```text
WORKTREE = Z:\sjb\Counting-the-Stars-at-Night\blender\.worktrees\feature-blender-assets

WORKTREE\public\models\alignment_test_facade.glb
WORKTREE\public\models\alignment_test_facade.manifest.json
WORKTREE\blender\scenes\alignment_test_facade.blend
WORKTREE\blender\scripts\build_alignment_facade.py
WORKTREE\blender\ALIGNMENT_TEST_PLAN.md
```

URL `/models/alignment_test_facade.glb`는 **이 worktree의 public/** 을 정적 루트로 제공할 때의 경로다. Claude의 현재 서버에서 자동 제공되는 것으로 간주하지 않는다. 엔진 담당자가 해당 파일을 읽어 개발 서버에서 제공하는 단계는 별도다. 공통 카탈로그 `asset-manifest.json`은 변경하지 않았다. 전용 `.manifest.json`은 `id`/`url`/`anchor`/`animations`와 추가 `calibration`/`layers`를 가진 단일 에셋 메타데이터다.

## 핵심 계약

| 항목 | 값 |
|---|---|
| ID / category | `alignment_test_facade` / `alignment-test` |
| 상태 | `synthetic_alignment_fixture`; 실제 관사·헤레디움 재현 아님 |
| 포맷 | GLB 2.0, 외부 리소스 없음, 무압축 |
| 단위 / 방향 | 1 unit=1m, Y-up, -Z 정면, 오른손 좌표계 |
| 원점 | `ANCHOR_Facade`, 외벽 정면 바닥 중앙 `(0,0,0)` |
| 기준면 / 법선 | GLB `Z=0`, `[0,0,-1]` |
| 합성 외벽 치수 | 6.00 × 3.60 × 0.20m (XYZ) |
| 실제 전체 AABB 크기 | 약 6.160 × 3.755 × 0.254m (디버그 마커/오버레이 포함) |
| 기준점 | `POINTS_Facade` 아래 PT_* 빈 노드 11개; 전체 좌표는 계획/매니페스트 |
| 격자 | 0.50m 간격, 1m 주눈금, 0.20m 길이의 0.01m 보조 눈금 |
| 반투명 | `ALIGN_OverlayCyan`, alpha 0.28, BLEND, front-face culling |
| 애니메이션 | 없음. 정합 기준점은 정적 |
| 예산 관측값 | 1,812 tris / 3,624 exported vertices / 11 primitives / 8 materials / 108,412 bytes |

## 정합 시험 절차

1. GLTFLoader로 읽고 별도 배치 Group의 자식으로 둔다. 배치 Group에만 회전·이동을 적용한다. 정합에 실제 축척을 쓸 때는 scale=1을 유지하고 모델을 자동 정규화하지 않는다.
2. `PT_P01_WallBL` ↔ `PT_P02_WallBR` 거리는 6m, `PT_P01_WallBL` ↔ `PT_P03_WallTL`은 3.6m다. 이 값은 합성 기준물의 값이며 실제 건물 치수로 적용하지 않는다.
3. GLB 로컬 기준점과 카메라/월드 공간 관측점의 좌표계를 구분한다. GLB 노드의 월드 좌표를 읽기 전에 배치 Group의 world matrix를 갱신한다.
4. 기준물 자체를 볼 때는 모든 레이어를 켠다. 실제 카메라 위에 합성할 때는 **REFERENCE_Facade를 숨긴다**. `CALIBRATION_Grid`/`CALIBRATION_Markers`/`OVERLAY_Architecture`는 개별 토글할 수 있다.
5. 모서리·창·문 대응점으로 정렬을 시도하고 격자/반투명 테두리의 겹침을 확인한다. 실제 치수가 다른 건물에 이 템플릿을 강제로 맞춘 결과를 정합 정확도 측정으로 해석하지 않는다.

시각 마커 전면 Z=-0.024m, 격자 전면 Z=-0.034m, 오버레이 전면 Z=-0.054m는 겹침 방지 간격이다. 보조 눈금 전면은 Z=-0.036m다. **정합에는 Z=0의 PT_* 원점**을 사용한다. 실제 기준면에서 시각 요소가 약간 앞으로 떠 있는 것은 이 설계값 때문이다.

모든 기준점은 평면 위에 있다. 한 장의 사진/이 점들만으로 깊이·절대 축척·추적 안정성을 보장하지 않는다. 마커는 사람이 보는 표시이며 자동 검출용 QR/AprilTag/ArUco가 아니다.

## 재생성

worktree에서 아래 명령을 실행한다. `-BlenderExe`는 기존 Blender 실행 파일을 읽기 전용으로 재사용한다. 캐시와 모든 출력은 이 worktree에 생성한다. 또는 worktree 내부에서 `setup_blender.ps1`로 로컬 도구를 준비할 수 있다.

```powershell
.\blender\build_alignment.ps1 -BlenderExe 'Z:\sjb\Counting-the-Stars-at-Night\blender\.tools\blender-4.5.15-windows-x64\blender.exe'
```

새 환경에서는 Node.js/npm과 Blender 4.5 LTS가 필요하다. 검사 의존성은 `blender/.tools/qa/`의 `three@0.186.1`, `gltf-validator@2.0.0-dev.3.10`이다. 최초 설치 시 인터넷 연결이 필요하다. `-SkipRenders`는 임시 구조 검사에만 사용하고 최종 납품에는 전체 명령을 사용한다.

## 미리보기와 증거

- `blender/renders/alignment_front.png`: 정면 전체 레이어
- `blender/renders/alignment_oblique.png`: 사선 전체 레이어
- `blender/renders/alignment_overlay_only.png`: 불투명 기준물 숨김
- `blender/renders/alignment_glb_front.png`: GLB 재수입 정면
- `blender/renders/alignment_glb_overlay_only.png`: GLB 재수입 오버레이
- `blender/reports/alignment_validation.json`: BLEND 재열기, GLB 재수입, 기준점 11개, BLEND 재질, AABB, 이미지 비교
- `blender/reports/alignment_khronos.json`: glTF 규격 검사
- `blender/reports/alignment_three.json`: Three.js 로더·재질·그룹·11개 기준점의 배치 Group 변환 검사
- `blender/reports/alignment_scope.json`: 전용 worktree, 공유 루트 미복사, 기존 별의 새싹/공통 카탈로그 불변 확인

Blender/GLB 검사 **111건**, Three.js r186 검사 **38건** 통과. Khronos **오류 0건 / 경고 0건**. 원본/재수입 렌더의 정면 및 오버레이 비교도 통과했다. 실행 증거는 위 JSON과 재생성 시 기록되는 로그를 확인한다.

Cycles CPU 1280×900, 24 samples로 원본 3장과 재수입 2장을 렌더한다. GLB에는 렌더 카메라와 조명이 없다. Three.js Node 로더 검사는 실제 WebGL GPU 렌더 시험과 구분한다.

## 아직 미검증

Claude 엔진 통합, 브라우저/모바일 GPU의 반투명 정렬, 실기기 WebXR, 실제 외벽 대응점 측정·정합 오차·카메라 추적·FPS·발열은 미검증이다. 사진·도면·현장 치수가 없으므로 실존 건물 모델이나 복원 결과로 승인하지 않는다.
