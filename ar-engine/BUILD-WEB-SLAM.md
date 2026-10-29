# AR-Backend 새 체크아웃에서 빌드

```sh
git clone --branch AR-Backend https://github.com/Jackkang790/Counting-the-Stars-at-Night.git
cd Counting-the-Stars-at-Night/ar-engine
npm ci
node scripts/stage-web-slam.mjs
npm run build
```

`dist/` 전체가 HTTPS 루트에 배포할 실행용 웹이다. 기본 공연 주소는 `?musical=1`이고 이미지 표적 없이 웹 SLAM으로 바닥을 탭해 배치한다. 기존 이미지 경로는 `?musical=1&tracking=image`, 기존 Quick Look/WebXR는 루트 화면이다.

기존 에셋 스테이저는 `feature/blender-assets` Git ref를 우선 사용하고 없으면 저장소의 `public/models`에 포함한 동일 모델 5개를 사용한다. 별도 Blender 작업 트리 없이 빌드할 수 있다. `.assets`, `dist`, `.tmp`는 생성물이고 Git에 올리지 않는다. 반면 `src/musical`, `musical-assets`, `vendor/xr8`, `public/models`, `scripts`, `tests`는 실행·빌드에 필요한 원본이므로 추적한다.

SDK 스테이징 명령을 생략하면 `dist/xr8/xr.js`가 빠질 수 있다. 기존 빌드·배포 설정을 바꾸지 않기 위해 별도 스테이징 도구를 사용한다. SDK 배포 원본은 [vendor/XR8-THIRD-PARTY.md](./vendor/XR8-THIRD-PARTY.md)에 기록했다.

검사:

```sh
npm run typecheck
node tests/musical-unit.mjs
node tests/spatial-volume-unit.mjs
```

브라우저 검사는 기존 패키지/잠금파일과 분리된 Playwright 설치를 사용한다. Node 20.11 이상이 필요하다. Mac에서는 Google Chrome 설치 후 아래 기본 경로를 사용하며, 필요하면 `CHROME_PATH`와 `PLAYWRIGHT_MODULE` 환경 변수로 바꾼다.

```sh
npm install --prefix ../.tmp/musical-qa --no-package-lock --no-audit --no-fund playwright@1.56.1
node tests/web-slam-adapter.mjs https://ar.lobodoc.com/
node tests/web-slam-runtime-probe.mjs 'https://ar.lobodoc.com/?musical=1'
```

어댑터 검사는 모의 SDK 계약 검사이고 런타임 검사는 합성 카메라로 실제 배포 엔진 시작을 검사한다. 실제 아이폰 이동·공간 고정·실제 사진 합격으로 해석하지 않는다. 최신 배포와 검증 경계는 [reports/web-slam/README.md](./reports/web-slam/README.md)에 기록했다. iOS 네이티브 소스는 선택적 프로토타입이며 현재 웹 실행의 필수 요소가 아니고 Mac/iPhone 컴파일·실행은 미검증이다.
