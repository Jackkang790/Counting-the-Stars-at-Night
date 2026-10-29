# 별 헤는 밤 · 테미오래 AR — Blender 에셋

첫 에셋 **별의 새싹 (starseed_sculpture v0.1.0)** 을 제작했다. 두 청동 잎과 금빛 궤도, 별자리로 구성한 창작 조형물이다. 빈 지면 중앙에서 3초 동안 자라난다.

프로젝트 대상은 **관사 16호**, **관사 42호(소제동)**, **헤레디움(인동)** 이다. AR 콘텐츠는 실제 건물 또는 지정 공간에 배치한다. 사용자가 설명한 PDF의 역할은 화면 흐름·기능 정의이며, 정밀 건축 도면이나 역사 고증 자료가 아니다. 현재 조형물은 특정 건물에 배치가 확정되지 않았다. 현장별 위치·방향은 엔진의 배치용 Group에서 설정한다.

**임시 콘셉트:** 이 작업에서 「별 헤는 밤 · 테미오래 AR 와이어프레임」 첨부를 확인하지 못했다. 와이어프레임의 세부 배치·작품 디자인에 부합한다는 검증은 하지 않았다. 실존 작품이나 역사 건축을 재현한 모델이 아니다. 관사·사라진 건물 부분·담장 전시·역사 인물·내부 공간은 이번 납품에 포함하지 않는다. 해당 작업은 사진·도면·시대 근거를 확인한 뒤 제작해야 한다.

## 산출물

| 파일 | 용도 |
|---|---|
| `public/models/starseed_sculpture.glb` | 배포용, 외부 리소스 없는 glTF 2.0 바이너리 |
| `public/models/asset-manifest.json` | 크기·축·기준점·클립·예산·SHA256·검증 상태 |
| `public/models/starseed_sculpture.manifest.json` | 엔진 계약 초안 필드에 대응하는 장면별 sidecar |
| `blender/scenes/starseed_sculpture.blend` | 편집 원본, NLA 애니메이션과 렌더용 스테이지 포함 |
| `blender/scripts/build_starseed.py` | bpy만으로 모델·재질·애니메이션·원본·GLB·렌더 재생성 |
| `blender/scripts/validate_starseed.py` | GLB 바이너리 검사, 새 장면 재수입, 클립·재질·렌더 검사 |
| `blender/scripts/validate_khronos.cjs` | Khronos 공식 glTF-Validator 실행 |
| `blender/scripts/finalize_manifest.py` | 원본/재수입 렌더 비교와 매니페스트 생성 |
| `blender/renders/` | 원본 4장, GLB 재수입 3장 |
| `blender/reports/` | 생성 통계, 공식 규격 검사, 재수입 검사, 이미지 비교 |
| `blender/ASSET_PLAN.md` | A~E 에셋 목록·난이도·건물별 필요 자료·계약 초안 대조 |
| `blender/CHANGELOG.md` | 모델별 변경 이력 |
| `blender/preview/` | 독립 Three.js WebGL 뷰어 (엔진 코드와 별도) |

코드와 에셋은 `blender/`, `public/models/`에만 둔다. `ar-engine/`을 편집하거나 엔진 의존성을 추가하지 않는다. `.tools/`는 프로젝트 내부의 로컬 도구이며 버전 관리에서 제외한다.

## 재생성

Windows PowerShell, Blender **4.5.15 LTS**, Node.js/npm을 사용했다. 전체 생성·검사 명령:

```powershell
# 최초 1회. 공식 포터블 ZIP의 고정 SHA256을 확인한 후 압축 해제한다.
.\blender\setup_blender.ps1

# 모델, 원본, 7개 렌더, 바이너리/재수입/공식 검사, 매니페스트 생성
.\blender\build.ps1

# 다른 Blender 4.5 LTS 실행 파일 사용
.\blender\build.ps1 -BlenderExe 'C:\path\to\blender.exe'
```

처음에는 Blender 다운로드 약 380MiB와 `gltf-validator@2.0.0-dev.3.10`, `three@0.186.1` npm 설치에 인터넷 연결이 필요하다. 도구는 `blender/.tools/`에 둔다. 설치된 Blender가 있다면 `setup_blender.ps1`을 생략할 수 있다. Blender GUI를 열지 않고 Cycles CPU에서 1000×1000, 32 samples로 렌더한다.

`-SkipRenders`는 빠른 모델 검사용이다. 이 경우 매니페스트의 `roundtrip_rendered`는 false가 되므로 최종 납품 검사에는 전체 명령을 사용한다. 검사 실패는 0이 아닌 종료 코드로 보고한다.

Blender만 직접 실행할 수도 있다:

```powershell
blender --background --factory-startup --python-exit-code 1 --python blender/scripts/build_starseed.py
blender --background --factory-startup --python-exit-code 1 --python blender/scripts/validate_starseed.py
node blender/scripts/validate_khronos.cjs
node blender/scripts/validate_three.mjs
blender --background --factory-startup --python-exit-code 1 --python blender/scripts/finalize_manifest.py
```

공식 다운로드: [Blender 4.5 LTS](https://www.blender.org/releases/4-5/), [배포 파일과 체크섬](https://download.blender.org/release/Blender4.5/). `setup_blender.ps1`의 고정 SHA256은 `blender-4.5.15.sha256`의 Windows x64 ZIP 항목과 일치한다.

## Claude Code 인계 규약

- URL: `/models/starseed_sculpture.glb`. 기본 상태는 완전히 펼쳐진 모습이다.
- 장면별 sidecar: `/models/starseed_sculpture.manifest.json`. `ar-engine/contracts/asset-spec.md`는 DRAFT이므로 그 기본 필드에 맞춰 작성했으며, 공통 계약 파일 자체는 변경하지 않았다. `idle`/`outro` 키와 최종 배포 경로의 엔진 수용 여부는 통합 시 확인한다.
- **1 unit = 1m**. Blender는 Z-up, GLB는 **Y-up**, 오른손 좌표계. Blender `(x,y,z)` → GLB `(x,z,-y)`. 정면은 GLB **-Z** (Blender +Y).
- 기준 노드 `ANCHOR_Ground`의 원점 `(0,0,0)`은 받침대 바닥 중앙이다. 지면은 GLB `Y=0`. 받침대 지름 **1.24m**, 전체 높이 약 **2.214m**. 정확한 AABB와 축별 크기는 매니페스트에 기록한다.
- GLB를 별도의 배치용 Group으로 감싸고 **그 Group**에 AR hit-test 위치·회전을 적용한다. 클립은 내부 Anchor의 로컬 TRS를 제어하므로 배치 변환과 분리한다. 기본 크기에서 다시 지면 높이나 모델 중심을 보정하지 않는다.
- 미터 크기로 로드한다. 모델 임의 정규화나 추가 축 회전은 필요 없다.

| 애니메이션 | 길이 | 재생 | 끝 상태 |
|---|---:|---|---|
| `Emerge` | 3.0초 | 1회, 끝 프레임 유지 | 전체 크기 |
| `Idle` | 4.0초 | 반복 | 전체 크기, 좌우 ±2° 회전 |
| `Disappear` | 1.5초 | 1회, 끝 프레임 유지 | 스케일 0, 보이지 않음 |

등장 전에 `Emerge`를 시간 0에서 평가하고 표시하면 초기 전체 크기 노출을 방지할 수 있다. 등장 완료 후 `Idle`로 바꾼다. 클립 전환 시 이전 Action을 중지하고 다음 Action을 reset해서 재생한다. 퇴장 후에도 LoopOnce와 clampWhenFinished를 유지하거나 배치 Group을 숨겨야 기본 크기로 되돌아오지 않는다. Idle로의 긴 crossfade는 등장 중 작은 크기와 섞일 수 있으므로 초기 인계에서는 즉시 전환을 권장한다.

모든 클립은 0초부터 시작한다. Blender 편집 타임라인에서는 겹치지 않는 NLA 트랙에 있다: 등장 1–91, 대기 121–241, 퇴장 301–346 (30fps). 정지 포즈를 볼 때는 frame 91을 사용한다. 높이를 바꾸려면 상위 배치 Group을 균일 스케일한다.

지하로 이동시키는 대신 원점 기준으로 수직·수평 스케일이 자라난다. 지면 가림 메시나 실세계 depth occlusion 없이도 빈 땅에서 나타난다. 별도의 구멍·흙 입자·그림자 수신 평면은 GLB에 포함하지 않는다.

## 모바일 예산과 검증 범위

- 삼각형 8,484개, 내보낸 정점 4,594개, 메시/재질/primitive 각각 4개.
- GLB 약 171KiB. 정확한 바이트 수와 해시는 매니페스트에서 확인한다.
- 텍스처 0개, OPAQUE PBR, backface culling 사용, 스킨·모프·필수 확장·압축 디코더 없음.
- 기본 메인 패스 예상 draw call 4개. 그림자·멀티패스 사용 시 추가된다.
- 렌더용 카메라·광원·바닥은 `.blend`의 `PREVIEW_ONLY_NOT_EXPORTED`에만 있다. GLB는 선택한 3D 에셋만 내보낸다.
- 금속 재질은 엔진의 중립 환경광/환경맵과 조명 아래서 확인한다. 발광 별은 bloom이나 실시간 발광 광원이 필요하지 않다. Blender의 스튜디오 조명은 엔진에 포함되지 않는다.
- Khronos 검사에서 오류·경고 0건을 요구한다. 바이너리 채널 길이·시작 시간·끝점·리소스·실제 Y-up 바운드를 검사하고, GLB를 새 장면으로 재수입하여 재질의 색상/금속/거칠기/발광과 애니메이션을 검증한다.
- 원본과 GLB 재수입의 완성·등장 중간·퇴장 중간 렌더를 비교한다. RGB RMSE 허용값은 0.025 (0–1)이다. 렌더는 육안 검토도 수행한다.
- Three.js **r186**의 실제 `GLTFLoader`와 `AnimationMixer`에서 클립별 0/25/50/100% 시점과 PBR/바운드를 검사한다. 결과는 `blender/reports/three-validation.json`에 기록한다.
- **실제 모바일 WebXR/Claude Code 엔진 통합, 기기별 FPS, 현장 스케일·시인성 검증은 미실시**다. 해당 엔진을 수정하지 않고 에셋 자체와 독립 Three.js 로더/뷰어까지 검증한다.

## 독립 3D 뷰어

```powershell
py -3.13 blender/scripts/preview_server.py
```

`http://127.0.0.1:8765/blender/preview/`를 브라우저에서 연다. 등장·대기·퇴장·완성 포즈 버튼과 회전/확대 조작을 제공한다. npm 의존성은 `build.ps1`로 먼저 준비한다. 서버는 localhost에만 바인딩하며 에셋/뷰어/Three.js 파일만 제공한다. 뷰어의 렌더 성공 관측값은 `blender/reports/viewer-validation.json`에 기록한다. 이 검사 후 `finalize_manifest.py`를 다시 실행하면 동일 GLB 해시에 대한 뷰어 통과 상태를 매니페스트에 반영한다.

이번 검수에서 Chrome의 WebGL2 렌더 보고를 수신했다(8,484 tris, 그리드 포함 draw call 5회). 브라우저 제어 연결 오류로 뷰어 스크린샷과 버튼 클릭의 육안 확인은 완료하지 못했다. Blender 원본/GLB 재수입 렌더는 직접 이미지로 확인했다. `desktop_webgl_viewer_passed`는 브라우저의 실제 렌더 보고를 뜻하며 전체 UI 수동 검사를 뜻하지 않는다.

## Git 작업 위치

사용자가 지정한 **feature/blender-assets** 브랜치는 `blender/.worktrees/feature-blender-assets`의 별도 worktree에서 관리한다. 공유 작업 폴더의 엔진 작업 브랜치를 전환하지 않는다. 첫 납품인 별의 새싹은 공유 루트에도 복사본이 있다. 이후 제작한 외벽 정합 시험물은 해당 worktree에서만 생성하며 공유 루트에 복사하지 않는다. `.tools/`·`.worktrees/`·로그는 커밋하지 않는다.

## 외벽 정합 시험물

두 번째 에셋 `alignment_test_facade`는 실존 건물의 형태나 치수가 아닌 **합성 정합 테스트용 외벽**이다. 문·창·기준점 11개·격자·반투명 건축 요소를 별도 그룹으로 제공한다. 정적 에셋으로 애니메이션은 없다.

먼저 작성한 [제작 계획](ALIGNMENT_TEST_PLAN.md)에 기준점 좌표와 시험 치수를, [Claude 인계 문서](ALIGNMENT_HANDOFF.md)에 실제 worktree 경로·배치 규칙·레이어 토글·검증 범위를 기록했다. GLB와 전용 매니페스트는 이 worktree의 `public/models/alignment_test_facade.*`에 있으며, 공통 카탈로그 `asset-manifest.json`에는 자동 추가하지 않는다.

```powershell
# feature/blender-assets worktree에서 실행. 경로는 사용 중인 Blender 실행 파일로 지정한다.
.\blender\build_alignment.ps1 -BlenderExe 'C:\path\to\blender.exe'
```

별의 새싹용 `build.ps1`과 별개 파이프라인이다. 독립 검수 렌더 5장과 `alignment_*.json` 검증 보고서를 생성한다. 실제 정합 알고리즘과 모바일 WebXR 검증은 포함하지 않는다.
