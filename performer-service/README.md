# 지역 공연자 제작 파이프라인

기존 AR 엔진을 보존하는 별도 Node 24 서비스다. `?studio=1`에서 자료를 등록하고 검수한 배우를 `?musical=1`의 두 슬롯에 배치한다. 사진 기반 생성 인물은 **볼류메트릭 촬영본이 아니며 실제 사람의 얼굴·신체를 정확히 재현한다는 보장이 없다**.

## 실행

저장소 루트에서:

```powershell
npm ci --prefix ar-engine
node ar-engine/scripts/stage-web-slam.mjs
npm run build --prefix ar-engine
npm ci --prefix performer-service
cd performer-service
Copy-Item .env.example .env
# .env를 열어 PERFORMER_ADMIN_TOKEN을 24자 이상으로 설정한다.
node --env-file=.env src/server.mjs
```

`http://localhost:8091/?studio=1` → 제작실 암호로 로그인한다. 동일 서버의 `?musical=1` → 등록 공연자 목록 새로고침 → 배우 A/B를 각각 선택한다. HTTPS가 필요한 스마트폰에서는 동일 출처의 HTTPS 프록시로 서비스한다. `WEB_DIST`는 기존 빌드 폴더, `PERFORMER_DATA_DIR`은 SQLite와 비공개 원본·결과의 영속 폴더다. 둘을 Git/정적 웹 루트에 넣지 않는다. HTTPS 배포에서는 `COOKIE_SECURE=1`, 프록시 업로드 제한은 380MiB 이상으로 맞춘다. 기본 바인딩은 로컬호스트다.

기존 Vite 서버만 실행하면 AR/로컬 GLB는 사용할 수 있지만 제작 API는 없다. 제작 화면과 API를 함께 사용하려면 이 서비스를 실행한다. 기존 패키지·잠금파일·빌드·배포 설정은 변경하지 않았다.

## API 설정 및 비용 승인

키를 클라이언트, `VITE_*`, URL 또는 채팅에 넣지 않는다. `.env`는 무시된다.

| 변수 | 설정 |
| --- | --- |
| `TRIPO_API_KEY` | Tripo OpenAPI 키 |
| `TRIPO_UPLOAD_PATH` | 기본 `/upload/sts` (문서화된 multipart/image_token 방식) |
| `TRIPO_MODEL_VERSION` | 기본 `v2.5-20250123`, v2 H 시리즈·리깅 호환 모델을 명시적으로 고정 |
| `DEEP_MOTION_CLIENT_ID`, `DEEP_MOTION_CLIENT_SECRET` | DeepMotion이 별도 발급한 REST API 자격 증명 |
| `DEEP_MOTION_BASE_URL` | 업체가 실제 발급한 프로덕션 HTTPS 주소. 임의 기본값 없음 |
| `BLENDER_PATH` | Blender 4.5 LTS 실행 파일의 절대 경로 (Windows/Mac/Linux) |
| `ARTIFACT_HOSTS` | 제공자 결과 파일의 추가 신뢰 호스트. 관리자만 설정 |

현 환경의 Blender 예: `Z:/sjb/Counting-the-Stars-at-Night/blender/.tools/blender-4.5.15-windows-x64/blender.exe`. 설치본 자체는 이 기능 브랜치에 포함하지 않는다.

Tripo 생성, 리깅, DeepMotion 추출은 각각 별도 비용 확인 창을 거친다. 리깅 승인은 사전 리깅 검사와 리깅 두 작업을 포함한다. 실제 요금은 계정별이므로 금액을 지어내지 않고 제공자 콘솔 확인을 요구한다. 승인 토큰은 5분 유효·1회용이며 작업·승인·작업 ID를 SQLite에 저장한다. 원본은 해당 단계를 승인한 뒤에만 외부 제공자로 전송한다.

제출 응답이 끊기면 `needs_reconciliation`에서 멈춘다. 제공자 콘솔의 실제 작업 ID를 연결하고 **같은 작업을 조회**한다. 자동 신규 제출·재결제하지 않는다. 명확히 실패한 작업의 신규 재시도는 새 비용 승인이 필요하다. 알려진 작업 ID는 재시작 후 이어서 조회한다. 서비스는 단일 워커 DB 임대로 중복 처리를 막으며 비정상 종료 후 임대 만료는 최대 60초다.

## 실제 구현과 대체 경로

1. 사진 1~8장, 영상 1개, 이름/제목, 촬영·초상·디지털 복제·공연 사용 동의 네 항목을 서버에서 검증한다. 업로드 진행률은 실제 전송량, 생성 진행률은 제공자 응답값이다. 사진 방향을 지정하며 정면 필수다. Tripo 다중 시점은 정면·왼쪽·뒤·오른쪽 순서의 네 슬롯 중 제공된 시점을 사용한다. 추가 사진은 보관하며 8장을 한꺼번에 처리한다고 표시하지 않는다. 사진 업로드는 장당 20MiB, Tripo 전송은 문서상 보수적으로 10MiB 제한이다.
2. Tripo v2 실제 HTTP 어댑터: 이미지 업로드 → image/multiview task → 결과 GLB → 외형 검수 → prerigcheck → biped rig GLB. v3도 현재 제공되지만 이 구현은 v2 계약을 명시적으로 사용한다. 임의 버전 자동 변경은 하지 않는다.
3. DeepMotion 실제 HTTP 어댑터: Basic 인증 → 세션 쿠키 → 서명 URL에 영상 PUT → video2anim → 상태 조회 → BVH/FBX 다운로드. 권한이 없으면 모션 파일을 직접 입력한다. **어댑터는 구현했으나 계정 실호출은 미검증**이다.
4. 자동 리깅은 Tripo 생성 task ID가 있는 모델에만 호출한다. 로컬 모델은 이미 리깅한 GLB로 입력한다. 모션은 BVH/FBX/GLB, 완성 결과는 본 애니메이션 GLB로 입력할 수 있다. 완성 GLB 입력도 두 번의 검수와 동의를 우회하지 않는다.
5. Blender 워커는 17개 주요 humanoid 본을 이름/별칭으로 대응시키고 rest-pose 회전 차이를 적용해 24fps·최대 30초로 베이크한다. 지원하지 않는 본 이름/다중 armature/동작 없는 파일은 오류 처리한다. 수평 root 이동을 잠그고 수직 움직임을 유지하며 최대 15cm의 발 접지 보정을 한다. 이는 범용 상용 리타기팅·발 IK 품질 보장이 아니다. 손가락·표정·복잡한 체형·서로 다른 리그의 추가 프로필/IK 보완이 필요하다. 현재 입력은 단일 배우 모션이다. 완성 GLB의 본 동작은 내장된 일반 float32 버퍼로 내보내야 하며 sparse/압축 애니메이션은 일반 버퍼로 변환 후 입력한다. 시간에 따라 변하지 않는 본 채널은 거부한다.
6. self-contained GLB의 스킨·본 동작 채널을 검사하고 외형(얼굴/신체/의상), 동작(움직임/발/방향·크기)을 각각 파일 SHA에 묶어 수동 승인한다. 승인 결과만 불변 URL로 공개 등록한다. 원본·중간 결과는 로그인 필요, 공개 등록 GLB는 관객에게 제공된다. 공개 동의가 없다면 등록하면 안 된다.

API 없는 전체 시험: 자료 업로드 → `완성된 애니메이션 GLB 입력`에 `tests/fixtures/retargeted.glb` 선택 → 외형 검수 → 동작 검수 → 공연 등록 → 무대 A/B 슬롯 선택. 이 파일은 직접 만든 **합성 테스트 배우**로, 실제 사람 재구성 성공으로 취급하지 않는다. 일반 공연 시작은 합성 모델을 차단하며 `개발 무대 미리보기`와 `기술 테스트`로만 재생한다.

## AR 호환성

새 `RiggedGLBPerformer`는 원래 `PerformerSlot` 외부 Group을 유지한다. `building → door/panel anchor → slot → skinned model` 구조라 렌더러를 바꿔도 정합값은 보존된다. `AnimationMixer.setTime`은 기존 오디오 마스터 30초 타임라인을 사용한다. 독립 RAF·카메라 자식·빌보드가 아니다. 배우별 위치·회전·크기·등장 시각, 기존 조명·파티클·음악·재시작·사진 기능을 재사용한다. 임시 깊이 모델은 개발자 가림 토글로 사용하며 실측하지 않았으므로 기본 꺼짐이다.

| 경로 | 지원 범위와 검증 경계 |
| --- | --- |
| 기존 Android WebXR | hit-test로 배치한 PlacementGroup에 배우 연결. XRAnchor 영속 저장은 아님 |
| 기본 iPhone/Android 웹 SLAM | 기존 자체 호스팅 엔진의 유효 pose/hit 결과로 배치. 실제 모바일 추적·성능 검증은 미실시 |
| 기존 이미지 추적 | 표적 좌표계에 연결. 표적 소실 시 숨김·정지 |
| 기존 iPhone Quick Look | 원래 모델/USDZ 경로 보존. 웹 본 애니메이션·타임라인·영상 텍스처를 지원한다고 가정하거나 새 공연을 넘기지 않음 |
| iOS 네이티브 | 기존 ARKit 프로토타입 소스 유지. 신규 생성 파이프라인과 네이티브 연동·Xcode 빌드는 미완료 |

GPS는 공연 선택·대략적 위치 안내에 사용할 수 있으나 벽면의 cm 단위 6DoF 정합을 대체하지 않는다. 현재 무대는 사용자 배치·보정이며 건물 자동 인식 성공으로 표시하지 않는다. 기존 영상 평면/시간별 3D 메시 렌더러도 유지해 향후 실제 볼류메트릭 데이터를 별도로 사용할 수 있다.

## 검사

```powershell
npm test --prefix performer-service
node ar-engine/tests/rigged-performer-unit.mjs
node ar-engine/tests/musical-unit.mjs
node ar-engine/tests/spatial-volume-unit.mjs
node performer-service/tests/blender-integration.mjs "<Blender 실행 파일 절대 경로>"
node performer-service/tests/studio-browser.mjs
```

브라우저 검사는 `ar-engine/BUILD-WEB-SLAM.md`의 별도 Playwright/Chrome 설치를 사용한다. `CHROME_PATH`, `PLAYWRIGHT_MODULE`로 경로를 지정할 수 있다. 새 서버 브라우저 검사는 임시 DB·로컬 포트를 사용하고 종료 시 제거한다. 유료 API를 호출하지 않는다. 테스트 배우 생성 원본은 `blender/make_test_actor.py`, BVH/FBX 시험 자료 생성기는 `tests/export-motion-fixtures.py`다. 시험 결과와 실기기 체크리스트는 [검증 기록](../ar-engine/reports/performer-pipeline/README.md)을 참조한다.

## 운영 범위

현재는 한 조직용 제작실 MVP다. 계정별 격리·권한 관리·보관 기간/삭제 UI·대규모 동영상 처리·워커 샌드박스는 후속 작업이다. `.env`, SQLite와 업로드 폴더를 백업·접근 통제하고 기존 정적 서버에 폴더를 그대로 공개하지 않는다. 서명 URL 다운로드는 HTTPS·호스트 허용 목록·사설 주소 차단·크기 제한을 적용하지만, 파일 제공자의 계정 및 결과 형식은 실제 키로 검증해야 한다.

공식 계약 참고: [Tripo 업로드](https://platform.tripo3d.ai/docs/upload), [이미지 생성 v2](https://docs.tripo3d.ai/model-generation/image-to-model-v2-0-v2-5.html), [다중 시점 v2](https://docs.tripo3d.ai/model-generation/multiview-to-model-v2-0-v2-5.html), [리깅 v2](https://docs.tripo3d.ai/animation/rig-v2-0-20250506.html), [DeepMotion REST API](https://github.com/DeepMotion/Animate-3D-REST-API).
