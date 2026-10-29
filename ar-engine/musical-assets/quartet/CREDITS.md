# 검정 교복 4인 공연 — 출처와 검증 경계

사용자 제공 Higgsfield 영상:
https://d8j0ntlcm91z4.cloudfront.net/user_3ETi2otS08uO2BIumjWolKMuTgN/hf_20261029_183758_d7b18a50-1078-4c96-b1de-b85e264968c5.mp4

사용자가 이 프로젝트에 제공한 생성 영상만 분석했다. 임의의 다른 공연 영상을 수집하지 않았다. 원본은 1280×720 H.264, 24fps, 241프레임(10.041667초), AAC 48kHz stereo 오디오 10초다. 처음 240프레임의 배우별 포즈와 원본 10초 오디오를 사용한다. MP4 원본은 임시 분석 폴더에 보관하며 공개 시연은 동영상 평면이 아닌 별도 GLB 네 개를 재생한다. SHA256은 `analysis.json`과 `build-report.json`에 기록했다.

영상에는 검정 모자·치마형 교복·흰 칼라·흰 양말·검정 신발을 착용한 네 인물이 있다. 정지 프레임 및 0/2.5/5/7.5/9.5초 추적 오버레이를 확인했다. 네 인물은 서로 자리를 바꾸지 않지만 팔이 겹치고 치마가 골반·무릎을 가린다. 얼굴·손가락·발의 실제 3D 형상이나 립싱크는 추출하지 않았다.

무료 로컬 MediaPipe Pose Landmarker full을 사용했다. 전체 프레임에서 네 명이 검출된 경우는 7/240프레임이고, 배우별 영역 재검출로 네 트랙의 모든 프레임에서 포즈 결과를 확보했다. 이 수치는 관절 정확도 100%를 의미하지 않는다. 고정 카메라·좌우 순서 유지라는 이 영상의 조건에 맞춘 추적이다. 일반적인 인물 교차/재등장에서는 수동 검토나 다른 추적기가 필요하다. visibility 0.5 미만은 보간하고 5프레임으로 평활화했다. 이는 단안 추정 3D이며 볼류메트릭 캡처가 아니다.

3D 외형은 사용자 영상의 얼굴을 복원한 것이 아니다. MakeHuman core CC0 인체 메시와 공식 시스템 팩 CC0 young Asian female 피부, 여성 매크로 체형 및 피팅 에셋을 사용한다. 모자/단추는 자체 제작했다. 인물별 골격/메시/동작은 독립적이며 외형은 같은 일반 인체 기반이다. 고품질 디지털 배우나 특정 실존 인물의 정확한 복제물로 표시하지 않는다. 의상은 시연용 해석이며 역사적 고증의 확정 표현이 아니다. 사용한 추가 에셋은 아래 외형 수정 항목을 따른다.

- MakeHuman base: https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs
- CC0 범위: https://static.makehumancommunity.org/about/license.html
- 공식 CC0 시스템 팩: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- 사용 파일: `skins/young_asian_female/young_lightskinned_female_diffuse3.png`
- CC0 원문 및 출처 파일: `performer-service/assets/makehuman/`
- MediaPipe 문서: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python
- 추론 모델(빌드 도구용, 런타임에 배포하지 않음): https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task

건물은 사용자가 제공한 사진 두 장을 사용했다. 사진 1을 수동 원근 보정해 5개 표면으로 나누고, 사진 2의 산수화 패널을 별도로 배치했다. 5.6m×2.5m와 깊이는 임시값이다. AR 카메라에서는 불투명 외벽을 기본 숨김으로 유지한다. 깊이 프록시는 실물과 보정한 뒤에만 사용한다.

공연 연출은 0초 첫 배우, 3/3.2/3.4초 나머지 배우 등장, 6~9초 군무, 9.5초 추출 포즈를 끝까지 유지하는 방식이다. 늦게 등장하는 배우도 미디어 오프셋을 적용해 원본의 같은 음악 시각으로 재생한다. 말소리/노래의 정확한 가사·가창·립싱크 품질은 확인하지 않았다.

브라우저 테스트·빌드·모의 카메라 검사와 실제 스마트폰 공간 추적 검증은 다르다. 실제 iPhone/Android 이동·드리프트·발열·가림 정확도 검증은 아직 수행하지 않았다. Quick Look에 웹 타임라인을 전달하지 않는다. 유료 AI API 호출은 하지 않았다.


## 외형 수정 (2026-10-30)

공식 CC0 여성 매크로 형태와 인체 스킨 가중치를 적용하고, 같은 CC0 시스템 팩의 `female_elegantsuit01`, `shoes02`, `short02`, `high-poly` 눈, `brown_eye.png`, `eyebrow001`을 체형에 맞춰 사용했다. 피부는 원본 2048 해상도를 유지한다. 모자와 단추는 자체 제작했다. 이전의 구형 눈·타원체 신발·단순 두 뼈 가중치를 교체했다. 흰색 평면 칼라는 움직일 때 분리되어 제거하고 어두운 이너로 변경했다. 현재 네 배우는 같은 일반 인체 외형을 공유하며 독립된 골격/동작과 크기를 가진다. 원본 배우 얼굴 복원·역사 의상 고증·실사급 완성도를 주장하지 않는다. 원본 파일과 SHA256은 `performer-service/assets/makehuman/PROVENANCE.json`에 기록한다.
