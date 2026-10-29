# 독립 이미지 추적 비교 시연

실행 경로:

- AR.js NFT: `/?trackingLab=1&engine=nft`
- MindAR: `/?trackingLab=1&engine=mindar`
- 기존 공연: `/?musical=1&show=quartet`
- 홈페이지의 **⑤ 건물 사진 추적 비교**에서도 진입한다.

기존 외벽 정합·별의 새싹·Quick Look·4인 공연·제작실은 교체하지 않았다. 새 bootstrap 분기와 시연 코드/표적만 추가했다. 기존 엔진/모델/빌드 설정 보호 검사 38개를 유지한다.

## 실제 구현

제공된 첫 실내 사진에서 기존에 만든 원근 보정 외벽 `musical-assets/quartet/facade.jpg`를 RGB 960×428 이미지로 축소했다. NFT와 MindAR가 **바이트 단위로 같은 사진**을 사용한다. 다른 사진이나 별도 쉬운 마커를 한쪽에 대신 넣지 않았다. 원본·변환본·표적 파일 SHA와 GLB SHA는 `tracking-lab/target.json`에 제공한다. 등록 사진 폭 5.6m는 실측값이 아니다.

NFT는 AR.js 3.4.8의 실제 NFT worker를 독립 Worker로 실행한다. 공식 번들의 worker 문자열을 변경 없이 추출했으며 추출 재현 도구와 upstream SHA를 제공한다. Three.js 전체를 다른 버전으로 교체하지 않는다. `.iset/.fset/.fset3`은 공식 NFT-Marker-Creator WASM으로 실제 생성했다. MindAR 1.2.5는 기존에 보관한 정식 배포본을 재사용하며 동일 사진으로 `.mind`를 실제 컴파일했다. 런타임 CDN이나 유료 API를 사용하지 않는다.

두 경로 모두 `performer-01.glb`와 `UniformQuartet01` 동작을 사용한다. 영상 평면/스크린 오버레이 인물이 아닌 리깅된 GLB다. 원본 배우 얼굴 복원이나 볼류메트릭 촬영물은 아니다. 이미지 로컬 +X 오른쪽/+Y 위/+Z 카메라 방향으로 맞췄다. 배우 발 원점은 이미지 하단, 기본 키 1.65m, 벽에서 앞쪽 0.35m다. 키/거리/좌우/방향을 조절하고 실제 적용값을 결과에 기록한다.

`getUserMedia()`의 실제 카메라 비디오는 DOM에 계속 남고 투명 WebGL 캔버스만 위에 겹친다. `object-fit:contain`과 투영 행렬의 같은 맞춤 비율로 카메라의 가장자리를 자르지 않는다. 실제 사용자 경로에는 배경 사진 대체나 합성 카메라 코드가 없다. 합성 입력은 테스트 Chrome의 실행 옵션으로만 제공한다.

NFT 카메라 좌표(+Y 아래/+Z 전방)를 Three.js 카메라 공간으로 변환했다. 밀리미터/픽셀/미터 단위를 분리하고 가까운 클립 평면을 미터 기준으로 맞춰 피부/눈의 깊이 정밀도를 확보했다. MindAR는 비디오 **width/height 속성**을 실제 영상 크기로 지정한다. 속성이 0이면 input loader가 검은 입력을 처리하는 문제가 있어 이를 검사한다. NFT의 보정 데이터는 범용값이며 각 iPhone/Android 렌즈의 실측 보정값이 아니다.

## 추적 상실 정책

유효 포즈가 없다는 신호가 오면 배우를 즉시 숨기고 동작 시계를 멈춘다. 유효 포즈 갱신이 650ms 이상 없을 때도 숨긴다. 재인식하면 새 이미지 포즈에 배우를 다시 표시하고 같은 애니메이션 시각에서 이어 간다. 마지막 카메라 좌표를 남겨 놓고 월드 앵커가 유지되는 것처럼 표시하지 않는다. 추적 결과는 이미지가 보이는 동안 얻는 포즈이며, 이미지 밖에서 독립적으로 유지되는 공간 추적과 다르다.

MindAR는 warmup/miss tolerance 2 및 기존 One Euro 필터를 사용한다. NFT는 worker의 포즈에 추가적인 앱 평활화를 하지 않는다. NFT 처리 영상은 640×480으로 contain, MindAR는 실제 카메라 입력 크기를 사용한다. 각 결과 JSON에 이 차이와 실제 카메라 해상도를 기록한다. 해상도가 다른 휴대폰에서 동일 처리 비용/동일 튜닝의 우열이라고 해석하지 않는다.

## 측정과 현재 결과

**초기 인식**은 카메라 재생 준비→첫 포즈와 추적 엔진 준비→첫 포즈를 각각 기록한다. 첫 포즈가 없으면 `null`이며 0ms 성공으로 바꾸지 않는다. 이 시간에는 표적을 화면에 가져오는 사용자 동작이 포함될 수 있다. 표적 노출 시각을 외부 타이머/영상으로 함께 기록해야 순수 인식 지연을 비교할 수 있다.

**흔들림** 버튼은 카메라를 고정했을 때만 사용한다. 이미지 중심의 카메라 상대 위치 RMS와 첫 회전 대비 각도 RMS를 기록한다. 10개 미만 표본은 측정값을 내지 않는다. 표적 폭은 임시값이므로 m 수치는 실제 정확도의 검증값이 아니다. 카메라 이동·피사체 이동·필터 효과와 실제 정합 오차를 자동 분리하지 못한다. 추적 상실 횟수, 상실→새 포즈까지의 재인식 시간도 기록한다. 이 시간에는 표적이 가려진 시간도 포함된다. 재노출 후의 순수 인식 지연은 외부 영상의 재노출 시각을 기준으로 따로 측정한다.

동일 사진·모델·표적 폭의 결과 JSON만 비교 화면에 불러올 수 있다. 기기, 키/거리, 인식 시간, 상실, 재인식, RMS를 표로 확인한다. 기기/OS/거리/조도/각도/시험 번호를 입력해 보관한다. 로그의 `physicalPhoneARVerified:false`는 수동 증거 검토 전 자동 합격을 선언하지 않기 위한 값이다.

| 검증 | NFT | MindAR |
| --- | --- | --- |
| 실제 추적 엔진 + 합성 Y4M 카메라에서 사진 인식 | 통과 | 통과 |
| GLB draw call·애니메이션 변화·크기/거리 적용 | 통과 | 통과 |
| 표적 제거 시 숨김/일시정지, 재등장 시 재인식 | 통과 | 통과 |
| iPhone Safari의 실제 건물 | **미검증** | **미검증** |
| Android Chrome의 실제 건물 | **미검증** | **미검증** |

[브라우저 결과](./browser.json), [NFT 상세](./nft-synthetic.json), [MindAR 상세](./mindar-synthetic.json), [NFT 화면](./nft-synthetic-found.png), [MindAR 화면](./mindar-synthetic-found.png)을 참조한다. 이 사진들은 **합성 카메라 입력 화면**이며 실제 장소의 스마트폰 AR 촬영 사진이 아니다. 데스크톱 소프트웨어 GPU의 시간/흔들림 수치를 휴대폰 성능 순위로 옮기지 않는다. 초기 개발 중 발견한 축 변환/검은 입력 문제를 수정한 후 최종 경로를 재검사했다.

## iPhone / Android 실기기 절차

1. iPhone Safari와 Android Chrome에서 각각 위 HTTPS 링크를 직접 연다. 인앱 WebView는 별도 검증 대상이다. 기종/OS/브라우저 버전과 시험 배포 버전을 기록한다.
2. 실제 건물의 등록 사진 영역 전체가 화면에 들어오도록 시작한다. 창문/격자 외의 산수화와 비대칭 특징도 포함한다. 사진을 다른 화면에 띄워 비추는 시험은 실제 건물 시험과 구분한다.
3. 같은 카메라 렌즈, 화면 방향, 거리(예: 3/5/8m), 조도/각도 조건에서 NFT와 MindAR를 번갈아 5회씩 새로 시작한다. 허가 팝업 시간은 엔진 인식 시간과 구분한다.
4. 카메라를 고정해 10초 흔들림을 수집한다. 같은 조건에서 좌우 이동/접근/후퇴를 10초씩 별도로 녹화한다. 이동 데이터를 정지 RMS와 섞지 않는다.
5. 표적을 3초 가리고 다시 노출한다. 화면 밖 회전도 별도로 5회 반복한다. 숨김/재인식/동작 재개가 올바른지 녹화한다. 앱 전환과 종료 후 카메라 해제도 확인한다.
6. JSON을 저장하고 다른 방식의 결과를 가져와 비교한다. 조건과 키/거리 설정이 다르면 동일 조건의 우열로 판정하지 않는다. 인식 실패도 기록하며 성공 시도만 골라 평균내지 않는다.
7. 기존 WebXR는 표적 인식 시간이 아닌 **바닥 hit-test가 가능해진 시간/탭 배치 시간**을 기록한다. 같은 위치에 배치 후 30초 이동·정지·가림·재배치·드리프트를 관찰한다. 이미지 추적과 이벤트의 의미가 다르므로 초기 시간 하나로 순위를 정하지 않는다. iPhone 기존 Quick Look/웹 공간 추적도 별도로 기록한다.

## 잠정 추천

실제 기기 결과가 없으므로 NFT/MindAR 중 현장 승자를 확정하지 않는다. **이동하면서 보는 공연의 운영 경로는 기존 WebXR/웹 공간 추적을 유지**하는 것을 권한다. 표적이 화면을 벗어나면 이번 두 이미지 추적 경로는 공연을 숨기도록 구현했기 때문이다. Android의 환경 hit-test/추적과 이미지의 특징점 재검출은 역할이 다르다. iPhone에 Android WebXR 지원을 가정하지 않으며 기존 플랫폼별 경로를 유지한다.

두 이미지 방식은 자동 초기 정합 후보로 비교한다. 향후 이미지 포즈로 시작 위치를 구한 후 공간 추적에 넘기는 방식은 별도 구현/검증이 필요하며 이번에 완료한 기능으로 표시하지 않는다. MindAR는 현재 Three.js 구성과 `.mind` 단일 파일 관리 측면에서 통합 부담이 작다. 이것이 실제 장소에서 더 안정적이라는 실측 결론은 아니다. 반복 격자·반사·조도 변화·비평면 구조와 일반 카메라 보정 오차 때문에 두 방식 모두 실제 건물 인식이 어려울 수 있다.

근거: [AR.js 이미지 추적](https://ar-js-org.github.io/AR.js-Docs/image-tracking/), [MindAR 추적 설정](https://hiukim.github.io/mind-ar-js-doc/quick-start/tracking-config/), [WebXR hit-test 표준](https://www.w3.org/TR/webxr-hit-test-1/). 공식 기능 정의와 코드 구조에 따른 잠정 판단이며 실기기 안정성 순위가 아니다.

## 실행·재현

이미 등록된 표적과 GLB는 저장소에 포함한다. 저장소 루트에서:

```powershell
node ar-engine/scripts/stage-web-slam.mjs
node ar-engine/scripts/stage-tracking-lab.mjs
node ar-engine/scripts/build-app-api.mjs
node ar-engine/tests/tracking-lab-unit.mjs
node ar-engine/tests/musical-unit.mjs
# 브라우저 추적 테스트는 .tmp/nft-tools/camera.y4m 합성 입력을 별도로 준비한 뒤:
node ar-engine/tests/tracking-lab-browser.mjs https://localhost:5187/
```

기존 package/Vite 설정은 변경하지 않았다. 단순 `npm run build --prefix ar-engine`도 이미 스테이징한 lab 파일을 포함하지만, 깨끗한 checkout에서는 반드시 `stage-tracking-lab.mjs`를 먼저 실행한다. `npm run dev --prefix ar-engine`로 실행한 Vite HTTPS 개발 서버에서도 같은 경로를 연다. 기본 포트는 5173이며 테스트 도구의 기본 5187과 다르면 URL 인자를 전달한다.

다른 사진으로 등록하려면 로컬에서 양쪽 표적을 함께 재생성한다. 외부 업로드/유료 작업은 없다:

```powershell
py -3 ar-engine/tools/prepare-image-target.py --image ar-engine/musical-assets/quartet/facade.jpg --width-meters 5.6
# 공식 고정 버전 NFT 도구를 .tmp/nft-tools/에 다운로드:
# https://raw.githubusercontent.com/AR-js-org/NFT-Marker-Creator/9a09b213d063123fa87f95e815cb2c099e4ab2c1/libs/NftMarkerCreator_wasm.js
# 저장 이름: NftMarkerCreator_wasm.cjs
# 같은 경로의 NftMarkerCreator_wasm.wasm도 함께 저장한다.
node ar-engine/tools/generate-nft.cjs
# Vite 개발 서버가 실행 중인 주소를 사용한다:
node ar-engine/tools/compile-mind-target.mjs https://localhost:5173/
node ar-engine/scripts/stage-tracking-lab.mjs
node ar-engine/scripts/build-app-api.mjs
```

사진 업로드 후 휴대폰에서 대형 NFT 표적을 자동 생성하는 UI는 추가하지 않았다. 제공된 사진은 사전 등록된 실제 표적으로 바로 실행된다. 생성 도구는 Python Pillow와 테스트용 Playwright/Chrome이 필요하다. NFT runtime/라이선스/해당 source 링크는 시연 화면과 `src/tracking-lab/vendor/THIRD_PARTY.md`에 보관한다. 합성 입력 생성기는 [make-synthetic-camera.py](../../tools/make-synthetic-camera.py)를 사용한다.
