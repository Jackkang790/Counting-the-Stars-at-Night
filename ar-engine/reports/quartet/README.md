# 검정 교복 4인 3D AR 공연

실행 경로: `?musical=1&show=quartet`. 기존 `?musical=1`의 30초 실사 영상 공연과 루트의 별의 새싹/외벽/Quick Look은 유지한다. 새 구현은 `feat/black-uniform-quartet` 브랜치에서 작업했다.

임시 서버 실행 주소: https://ar.lobodoc.com/?musical=1&show=quartet . 홈페이지의 ④ 버튼에서도 진입한다. 실행용 웹을 배포했으며 제작 API와 영속 업로드 DB는 그대로 유지했다. 배포 이미지 `ar-site:quartet-a79640d3`, 아카이브 SHA256 `a79640d32868e48ce4552be3d5f83166e6f4d70e862b3f1db84b5a357ff5df29` (58파일), 이전 이미지 `ar-site:rollback-20261029T193350Z`, 이전 dist `/home/ubuntu/ar-docker/backups/dist-20261029T193350Z`를 보존했다. 배포 방법은 기존 `ar-engine/BUILD-WEB-SLAM.md`와 `performer-service/deploy/README.md`를 따른다.

## 실제 구현

- 사용자 MP4를 다운로드·디코딩하고 프레임을 확인했다. 1280×720, 24fps, 영상 241프레임/10.041667초, 원본 오디오 10초다. [원본 프레임 모음](./source-contact.jpg).
- MediaPipe의 실제 로컬 추론을 실행했다. 전체 화면만으로는 240프레임 중 7프레임에서 네 명이 검출됐다. 좌우 위치 기반 Hungarian 매칭과 배우별 크롭 재검출로 240프레임×4트랙을 확보했다. [ID 오버레이](./tracked-contact.jpg). 이 영상에서만 확인한 고정 카메라·자리 교차 없음 조건을 사용한다. 100% 관절 정확도나 일반 영상의 ID 유지 성공을 의미하지 않는다.
- 실제 골격·메시가 있는 4개 GLB를 만들었다. 각각 독립 17본과 애니메이션 클립을 가진다. CC0 MakeHuman 기반 외형에 검정 교복·모자·고무신·흰 칼라/양말·단추·표식을 제작했다. 작은 얼굴/체형·표식 차이를 두었다. [Blender 렌더](./actor-blender.png). 원본 영상 인물의 얼굴·신체를 복원한 모델은 아니며 최고 품질의 실사 디지털 휴먼이라고 주장하지 않는다.
- visibility 0.5 미만 관절은 보간하고 5프레임 평활화했다. 가려진 관절의 추정 오차는 남는다. 17본 rest 방향과 영상의 hip-relative 추정 3D 관절을 연결해 베이크했다. 평가된 고무신 정점의 최저 높이를 기준으로 수직 바닥 접촉을 보정했다. 완전한 발 IK/수평 발 잠금, 손가락·표정·가창 립싱크는 구현하지 않았다.
- 네 배우를 각각 `BuildingAnchor → PerformerGroup → ANCHOR_stage → PERFORMER → rigged model`에 배치한다. 같은 앵커 아래 `BuildingGroup`, 별도 깊이 모델, `EffectsGroup`을 유지한다. 카메라 자식·영상 평면·빌보드가 아니다.
- 사진 1을 수동 원근 보정한 외벽과 사진 2의 산수화 패널을 사용한다. 외벽 표면을 5개로 나누고 기둥·프레임·패널 효과를 구분한다. 폭 5.6m/높이 2.5m/깊이는 임시값이다. AR 카메라에서 불투명 외벽은 기본 숨김, 개발 미리보기/정합 확인에서 표시한다. 깊이 가림은 별도 토글이며 실측 전까지 정확한 실물 가림이라고 주장하지 않는다.
- 오디오 마스터에 본 애니메이션·조명·파티클을 연결했다. 첫 배우 0초, 나머지 3/3.2/3.4초, 6~9초 군무, 9.5초 포즈를 마지막까지 유지한다. 각 배우의 `mediaOffset=start`로 늦은 등장도 원본 음악 시각에 맞춘다.

## 가까운 무대 문제 분석과 변경

기존 웹 SLAM은 카메라 앞 고정 거리 모델을 만드는 방식이 아니라 실제 hit-test 점을 사용한다. 다만 0.15m 거리 점까지 허용하고 있었다. 기존 door/panel 앵커의 높이가 지면 기준과 달라 발 원점도 혼동될 수 있었다. `camera.position.set(0,1.5,0)`은 추적 원점 초기화이고, 6m 이상 카메라 거리는 개발 미리보기의 화면 맞춤 코드다. 이들을 실제 AR 고정 거리 배치로 보고 제거하지 않았다.

새 공연은 지면 원점 `stage` 앵커, 미터 단위 인체, 별도 배우 위치로 정의했다. 새 경로의 Web SLAM/WebXR에만 가로 거리 2m 미만·12m 초과·눈높이 기준점 차단을 적용한다. 카메라를 따라 이동시키거나 유효한 hit가 없을 때 임의 거리로 대체하지 않는다. `바닥 다시 선택`은 공연을 멈추고 명시적인 새 hit를 기다린다. 재생/다시 보기로 배치를 초기화하지 않는다. 가까운 실제 기기 문제의 근본 원인은 실기기 로그 없이 단정하지 않으며 이 개선도 실제 장소에서 확인해야 한다. 네 사람 전체를 보려면 보통 더 먼 지점/가로 화면이 필요하다.

## 재생성

저장소 루트, Blender 4.5 LTS와 Python 환경에서:

```powershell
py -3 -m venv .tmp/quartet-pose-env
.tmp/quartet-pose-env/Scripts/python.exe -m pip install -r performer-service/tools/requirements-quartet.txt
# 사용자 원본 MP4와 MediaPipe full.task를 로컬에 내려받은 뒤:
.tmp/quartet-pose-env/Scripts/python.exe performer-service/tools/extract_quartet.py --video .tmp/quartet-analysis/source.mp4 --model .tmp/quartet-analysis/pose_landmarker_full.task --out .tmp/quartet-analysis
# poses.json/analysis.json을 musical-assets/quartet에 반영하고:
blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python performer-service/blender/build_uniform_quartet.py -- --mesh performer-service/assets/makehuman/base.obj --skin performer-service/assets/makehuman/young-asian-female.png --poses ar-engine/musical-assets/quartet/poses.json --out ar-engine/musical-assets/quartet
py -3 performer-service/tools/prepare_quartet_stage.py --photo "public/ㅇ/ChatGPT 이미지 2026년 10월 29일 오후 10_06_36.jpg" --out ar-engine/musical-assets/quartet
blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python performer-service/blender/build_photo_facade.py -- --photo ar-engine/musical-assets/quartet/facade.jpg --data ar-engine/musical-assets/quartet/facade.json --out ar-engine/musical-assets/quartet
node ar-engine/scripts/stage-web-slam.mjs
npm run build --prefix ar-engine
```

원본 오디오는 FFmpeg로 첫 10초를 `performance.m4a`에 추출했다. 코드·데이터·출처·영상 SHA는 [에셋 출처](../../musical-assets/quartet/CREDITS.md), [추출 분석](../../musical-assets/quartet/analysis.json), [GLB 빌드 기록](../../musical-assets/quartet/build-report.json)에 있다. 무대와 배우 배치/클립/타임라인은 [show.json](../../musical-assets/quartet/show.json)이다. 작업 도구는 이 24fps·10초·4인 영상에 맞춘 검토 절차이며, 다른 영상은 교차·크롭·FPS를 다시 검증해야 한다.

## 자동 검사와 검증 경계

`npm run build --prefix ar-engine`, `quartet-unit.mjs`, `quartet-browser.mjs`를 사용한다. 기존 `musical-unit.mjs` 보호 대상 38개, `rigged-performer-unit.mjs`, `spatial-volume-unit.mjs`, `musical-browser.mjs`, `web-slam-adapter.mjs`로 회귀를 확인한다. 브라우저 테스트용 Playwright 설치/Chrome 설정은 `ar-engine/BUILD-WEB-SLAM.md`를 따른다.

[브라우저 기록](./browser.json), [스킨 정점/그리기 기록](./geometry.json), [4인 모의 추적](./four-models-mock-tracker.png), [사진 외벽 리허설](./photo-facade-rehearsal.png)을 참조한다. 이 화면들은 **실제 카메라 AR 시연 사진이 아니다**. 소프트웨어 GPU의 FPS는 스마트폰 성능으로 해석하지 않는다. 실제 iPhone Safari/Android Chrome의 추적·발열·드리프트·공연 시 가림은 미검증이다. Quick Look은 기존 USDZ 경로를 보존하며 새 웹 타임라인을 실행한다고 가정하지 않는다. 새 공연은 기존 웹 SLAM 또는 Android WebXR를 사용한다. 유료 AI API를 호출하지 않았다.

실기기에서는 HTTPS에서 카메라→실제 건물 앞 바닥 탭→위치·방향·크기 보정→공연을 실행한다. 좌우 이동/접근/후퇴·정지/재생/다시 보기·추적 소실·앱 전환·바닥 재선택을 녹화하고 기기/OS/브라우저/배포 버전을 기록한다. 사진의 비실측 치수와 가림 프록시는 현장에서 맞춰야 한다.

플랫폼 확인: [Apple Quick Look 공식 예제](https://developer.apple.com/quick-look-gallery/)는 USDZ 내부의 애니메이션·내장 동작·오디오를 지원한다고 명시한다. 따라서 Quick Look에 애니메이션 자체가 없다고 단정하지 않는다. 다만 이 저장소의 Three.js 0.169 USDZExporter는 메시 기하와 재질을 내보내며 스킨 애니메이션 클립/웹 AudioContext 타임라인을 직렬화하지 않는다. 신규 4인 공연의 애니메이션 USDZ 및 네이티브 동기 제어는 별도 미완료 항목이며, 현재는 기존 웹 SLAM(iPhone/Android)과 Android WebXR에서 같은 GLB·오디오 타임라인을 실행한다.

향후 등록 경로는 기존 `performer-service`의 동의·비용 승인·3D 생성·모션 입력·리타기팅·검수·GLB 공개 등록을 재사용한다. 공연의 건물/배우/타임라인 데이터는 분리돼 있고, 로컬 또는 등록된 GLB로 배우별 교체가 가능하다. 다른 리그는 기존 retarget 도구로 변환하거나 별도 프로필이 필요하다. 실제 고품질 배우 외형과 움직임 검수·실기기 합격은 추가 작업이다.
