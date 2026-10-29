# iPhone: 사진 표적 없는 ARKit 공연

이 프로젝트는 기존 Safari AR/Quick Look을 수정하지 않는 **별도 iOS 앱**이다. 앱 설치 후 ARKit 월드 추적으로 바닥을 탭해 실제 공간에 무대를 놓는다. 이미지 인식을 배치 조건으로 사용하지 않는다. 자동 건물 인식이나 GPS만으로 센티미터 단위 정합을 완료하는 기능은 아니다.

## Mac에서 설치

1. 전체 소스 ZIP을 풀고 `ar-engine/ios/StarStage/StarStage.xcodeproj`를 Xcode로 연다. 폴더 구조를 유지한다. `../../musical-assets`의 기존 JSON·실사 영상 2개를 프로젝트가 직접 참조한다.
2. TARGETS → StarStage → Signing & Capabilities에서 본인의 **Team**을 선택한다. 필요하면 Bundle Identifier를 고유한 값으로 바꾼다.
3. 아이폰을 USB로 연결하고 아이폰 설정에서 개발자 모드를 활성화한다. Xcode 실행 대상을 연결한 아이폰으로 선택해 **Run**한다. 최소 iOS 17, ARKit 지원 기기가 필요하다.
4. 카메라 권한을 허용한다. **카메라 시작 → 바닥을 천천히 비추고 무대 중심 탭 → 공연 시작** 순서로 진행한다. 산수화 사진이나 인식 표적은 필요 없다.
5. 두 배우는 5초·10초에 등장하며 30초에 종료된다. 좌우·전후로 이동해 발과 무대 위치가 유지되는지 확인한다. 무대 조정에서 방향·크기를 맞출 수 있다. 다시 배치하면 새 바닥 위치를 선택한다.

Mac에서 서명 없이 컴파일만 먼저 검사하려면:

```sh
xcodebuild -project ar-engine/ios/StarStage/StarStage.xcodeproj \
  -scheme StarStage -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO build
```

현재 Windows 작업 환경에서는 Xcode/iOS SDK 컴파일과 기기 실행을 수행하지 못했다. 프로젝트·리소스 정합 검사는 iOS 컴파일 성공을 의미하지 않는다. Xcode 빌드 오류가 있으면 전체 오류 메시지를 전달해 수정해야 한다. Safari 주소 새로고침만으로 이 네이티브 경로가 실행되지는 않는다.

## 공유 데이터와 장소 연결

기존 `musical-assets/show.json`을 그대로 읽는다. 미터·Y-up·정면 -Z, door/panel 앵커 및 배우별 위치·회전·등장/퇴장 정보를 공유한다. 두 스톡 영상도 웹 MVP와 동일하며 사용 조건은 함께 포함한 `MEDIA-CREDITS.md`를 따른다. 최종 지역 공연자·역사 인물 촬영본은 아직 없다.

GPS 도착 확인은 기존 계약대로 외부 지도/게임 셸 담당이다. 이 앱이 GPS를 이미 받고 있다고 표시하지 않는다. 외부에서 장소를 선택한 뒤 다음 딥링크로 연결할 수 있다.

```text
starstage://show?venue=photo-room-provisional
```

현재 등록된 장소는 위 임시 시연 장소 하나다. 다른 ID는 거부한다. 딥링크는 장소 선택 전달이며 GPS 인증 자체를 수행하지 않는다. 초기 실내 시연은 GPS 수신 실패로 차단하지 않는다. 실제 장소 카탈로그와 좌표가 제공되면 외부 셸의 장소 ID를 제작자가 미리 만든 무대 데이터에 매핑한다. 세션 간 영속 앵커는 구현하지 않아 새 실행에서 다시 배치한다.

## 구현과 한계

- ARKit horizontal raycast 결과에 `ARAnchor`를 생성한다. 바닥을 찾지 못하면 배치를 거부한다. 화면 고정 오버레이나 임의 카메라 앞 위치를 공간 고정 성공으로 처리하지 않는다.
- 두 실사 객체는 anchor → building root → door/panel → performer → plane 계층이다. 카메라 이동에 맞춰 배우 방향을 돌리지 않는다. ARKit의 월드 추적이 앵커 포즈를 갱신한다.
- 네이티브 MVP 렌더러는 SceneKit이다. packed H.264의 좌측 컬러·우측 흑백 알파를 AVPlayerItemVideoOutput/Core Image로 합성한 뒤 3D 평면 재질에 적용한다. 24fps 갱신과 두 영상 디코딩 성능·열·배터리는 실제 폰에서 측정해야 한다. SceneKit은 최신 SDK에서 deprecated 경고가 있을 수 있어 장기 렌더러는 RealityKit/Metal로 이관할 수 있다.
- 음원 하나의 재생 위치를 공연 시계로 사용하고 배우 영상은 150ms 이상 드리프트 시 보정한다. 합성 시연 음악이며 최종 안무에 맞춘 음원은 아니다. 영상 평면은 완전한 입체 인물/볼류메트릭 캡처가 아니다. 웹의 GLB 시퀀스 로더는 이 앱에 아직 포팅하지 않았다.
- 추적 제한·인터럽트·백그라운드 전환에서 공연을 정지하고 숨긴다. 추적이 정상으로 돌아와도 자동 재생하지 않는다. 인터럽트 종료 시 다시 배치한다.
- 임시 건물 모델은 기본 숨김이다. 가림 모델은 별도 노드로 생성하지만 실측 전에는 활성화하지 않는다. 자동 현실 깊이 가림은 없다.
- 사진은 ARSCNView snapshot을 공유 시트로 보낸다. 실제 카메라 포함 여부·회전·알파를 기기에서 확인해야 한다. 서버로 자동 전송하지 않는다.

## 실제 기기 합격 조건 — 현재 모두 미실행

카메라/바닥 탐지, 탭 배치, 두 실사 움직임, 전체 30초, 일시정지·다시 보기, 1m 좌우·전후 이동 후 위치 유지, 추적 상실·복구, 회전·크기 조절, 사진, 오디오 인터럽트·백그라운드 복귀를 확인한다. 기존 Safari Quick Look과 Android WebXR도 별도로 회귀 확인한다.

Apple 근거: [월드 추적과 평면](https://developer.apple.com/documentation/arkit/tracking-and-visualizing-planes), [배치와 추적 중단 처리](https://developer.apple.com/documentation/arkit/placing-objects-and-handling-3d-interaction).
