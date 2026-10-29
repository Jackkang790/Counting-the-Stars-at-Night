# 앱 연동 API v1 — 별의 새싹 / 검정 교복

앱 개발용 현재 계약이다. 기존 `ar-api.md`는 초기 엔진 제안이며, 앱 연결은 이 문서와 생성된 JSON을 기준으로 한다. 원격 재생 제어/완료 콜백을 제공하는 것으로 해석하지 않는다.

현재 상태: 코드 구현·자동 검사 완료. 이 v1 조회 API는 기존 공연 서버와 별도로 아래 API 빌드 및 nginx 설정 배포가 필요하다. Git 푸시 자체가 서버 API 배포를 수행하지 않는다.

기준 서버: `https://ar.lobodoc.com`. 아래 API는 빌드 시 생성되는 읽기 전용 정적 JSON이다. 인증과 외부 유료 API 호출이 필요 없다. 배포에는 아래 전용 빌드 명령을 사용해야 한다.

| GET 경로 | 용도 |
| --- | --- |
| `/api/ar/v1/catalog.json` | 두 콘텐츠 ID, 제목, 버전, 실행 경로 |
| `/api/ar/v1/experiences/starseed.json` | 별의 새싹 GLB·매니페스트·애니메이션·플랫폼 정보 |
| `/api/ar/v1/experiences/black-uniform.json` | 4인 GLB·음원·건물·깊이 모델·10초 타임라인 |
| `/api/ar/v1/client.mjs` | 의존성 없는 웹 연동 클라이언트 |
| `/api/ar/v1/client.d.ts` | TypeScript 타입 |

`schemaVersion`은 계약 버전(현재 1), `revision`은 콘텐츠 해시다. `assets`의 각 항목은 `url`, `sha256`, `bytes`, `mimeType`을 가진다. 모델의 빌드 해시 경로를 앱에 직접 고정하지 말고 API 응답을 사용한다. 상대 URL은 **AR 서버 origin**을 기준으로 해석한다. v1 콘텐츠 식별자는 `starseed`, `black-uniform` 두 개다. 둘 다 GPS·보상·회원 상태를 저장하지 않는다.

## 웹/React 앱

```js
import {createARClient} from 'https://ar.lobodoc.com/api/ar/v1/client.mjs';
const ar=createARClient({baseUrl:'https://ar.lobodoc.com/'});
const catalog=await ar.getCatalog();
const show=await ar.getExperience('black-uniform');
const actor=ar.resolveAsset(show.assets['performer-01']);
// 화면 버튼의 href에 지정한다. 카메라나 음악을 자동 실행하지 않는다.
document.querySelector('#open-ar').href=ar.getLaunchUrl('black-uniform');
// 별의 새싹: ar.getLaunchUrl('starseed')
```

React에서는 SDK를 소스에 복사해 import하거나 지원되는 ESM 로더로 읽는다. SDK의 `getLaunchUrl()`은 동기 함수이며 URL만 반환한다. 별의 새싹 주소는 기존 선택 화면(`/`), 검정 교복은 `/?musical=1&show=quartet`다. 사용자가 실행 페이지에서 AR 버튼을 눌러야 한다. 서버가 앱의 카메라 권한을 대신 허용하지 않는다.

JSON/SDK 엔드포인트는 공개 읽기 CORS를 제공한다. GLB/음원의 `/assets/`, `/models/` 경로에는 별도 CORS 정책을 추가하지 않았다. 다른 origin의 Three.js 앱에 직접 모델을 로딩할 경우 앱 서버의 에셋 프록시 또는 동일 origin 배치를 사용한다. 네이티브 다운로드는 URLSession/HTTP 클라이언트로 처리한다. 제작 API의 쿠키/암호를 관객 앱에 넣지 않는다.

## iOS / Android 앱

가장 작은 연결은 앱의 체험 버튼에서 위 HTTPS 실행 주소를 외부 Safari/Chrome으로 여는 것이다. 내부 WKWebView/Android WebView에서 기존 AR이 동일하게 작동한다고 가정하지 않는다. 권한·카메라·모션 센서·WebXR 지원은 실제 앱/기기에서 따로 확인한다. 네이티브 ARKit/RealityKit/ARCore로 직접 렌더링하려면 JSON의 GLB·클립·무대 데이터를 소비하는 네이티브 로더/변환기가 별도로 필요하다. 이 API가 네이티브 렌더러를 제공하는 것은 아니다.

| 콘텐츠 | Android 경로 | iPhone 경로 | 주의 |
| --- | --- | --- | --- |
| 별의 새싹 | 기존 WebXR 엔진 | 기존 브라우저 USDZ 생성 → Quick Look | 생성 USDZ에 웹 AnimationMixer 제어/골격 애니메이션이 전달된다고 가정하지 않음 |
| 검정 교복 | 웹 공간 추적 또는 WebXR | 웹 공간 추적 | Quick Look 공연 아님. 4개 독립 3D 배우·공통 오디오 시계 |

Quick Look 자체의 애니메이션 지원 여부와 이 프로젝트의 USDZExporter가 내보내는 데이터는 구분한다. 고정된 USDZ 다운로드 REST 엔드포인트는 현재 없다. 기존 `exportExperienceUSDZ()`가 브라우저에서 생성한다.

## 좌표와 타임라인

미터, +Y 위, 회전은 라디안이다. 검정 교복 `scene.actors[]`의 위치/회전/키/클립/등장·퇴장·`mediaOffset`을 함께 사용한다. `model`은 API에서 실제 빌드 URL로 치환된다. `scene.audio`는 공통 시계의 음원이다. `BuildingAnchor` 아래에 `BuildingGroup`, `PerformerGroup`, `EffectsGroup`을 둔다. 카메라 아래에 모델을 붙이지 않는다. 건물 폭/높이/깊이는 임시값이며 현장 보정이 필요하다. GPS는 장소 접근 조건이고 6DoF 정합 좌표가 아니다.

검정 교복은 10초이며 첫 배우 0초, 나머지 3/3.2/3.4초 등장이다. 네 모델은 CC0 인체와 원본 영상에서 추정한 동작을 사용한다. 실제 배우 얼굴 복원이나 볼류메트릭 촬영물이 아니다. 사진 촬영은 현재 웹 공간 추적 경로에서 로컬 다운로드로 제공하며 WebXR 경로/네이티브 업로드 API는 제공하지 않는다.

## 기존 TypeScript 엔진 API

저장소를 같은 웹 앱에 통합할 때 별의 새싹은 실제 공개 엔트리 `ar-engine/src/index.ts`를 사용한다. `@temiore/ar-engine`이라는 npm 배포 패키지는 아직 없다.

```ts
import {createARExperience} from '../ar-engine/src/index';
const engine=createARExperience({assetManifestUrl:'/models/asset-manifest.json'});
const request={buildingId:'residence-16',spotId:'spot-01',
  experienceId:'emergent-artwork',overrides:{assetId:'starseed_sculpture'}};
const support=await engine.checkSupport();
// WebXR 지원이면 실제 클릭 핸들러에서 engine.start(request).
// iPhone은 기존 Quick Look UI 또는 exportExperienceUSDZ(request) 사용.
engine.on('placed',()=>{/* 배치 UI */});
engine.on('error',error=>{/* 오류 UI */});
// 종료: await engine.stop()
```

이 이벤트 API는 같은 JavaScript 런타임의 엔진에만 해당한다. 외부 브라우저 창이나 네이티브 앱으로 자동 전달되지 않는다. 검정 교복에는 원격 `start/pause/replay` REST API나 공통 postMessage 브리지가 없다. 현재 공연 화면의 버튼이 제어한다. 외부 브라우저에서 돌아온 사실, Quick Look을 연 사실, JSON 다운로드를 공연 완료나 스탬프 지급의 근거로 사용하지 않는다.

## 제작 API와 분리

`/api/studio/health`, `/api/studio/registry`, `/api/studio/published/{id}.glb`는 기존 제작 서비스다. 로그인·사진/영상 업로드·비용 승인·검수·등록은 기존 `performer-service/README.md`의 인증 계약을 따른다. 일반 앱의 관객용 조회는 `/api/ar/v1/`을 사용한다. Tripo/DeepMotion은 키와 권한이 없으면 실제 생성 완료로 처리하지 않는다.

## 빌드/배포/검증

```powershell
node ar-engine/scripts/stage-web-slam.mjs
node ar-engine/scripts/build-app-api.mjs
node ar-engine/tests/app-api.mjs
node ar-engine/tests/musical-unit.mjs
```

기존 `npm run build --prefix ar-engine`는 원래대로 유지하며 이것만 실행하면 API 파일이 생성되지 않는다. 이미 웹을 빌드했다면 `node ar-engine/scripts/build-app-api.mjs --skip-build`로 JSON/SDK를 추가할 수 있다. `ar-engine/dist` 전체와 `performer-service/deploy/nginx.conf`를 함께 배포한다. nginx의 `/api/ar/v1/`은 없는 파일에 404를 반환하며 SPA HTML로 대체하지 않는다. 다른 제작/백엔드 컨테이너는 재생성하지 않는다.

자동 검사는 조회 데이터의 실제 파일/해시·네 배우 모델 경로·타임라인·SDK 입력 오류를 검증한다. 빌드 성공은 스마트폰 AR 검증 완료를 뜻하지 않는다. 신규 연동 경로의 iPhone/Android 앱 실기기 검증은 별도로 수행한다.
