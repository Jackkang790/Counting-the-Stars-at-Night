# 별 헤는 밤 — 프론트 · AR · REST 통합 앱

`Frontend_V1`의 모바일 UI, `AR-Backend`의 별의 새싹·검정 교복 AR,
`Rest-Backend`의 FastAPI·SQLite를 연결한 앱입니다.

운영 주소: **https://ar.lobodoc.com/**. [배포 절차](deploy/README.md)와
[현재 배포 기록](deploy/deployment.json)을 참고합니다.

## 설치와 실행

Node.js 24 이상, Python 3.10 이상이 필요합니다. 저장소 루트에서 실행합니다.

```powershell
npm ci
npm ci --prefix ar-engine
py -3 -m pip install -r requirements-dev.txt
npm run build
npm start
```

`http://localhost:8000`에서 UI·AR·API를 함께 제공합니다. API 명세는 `/docs`입니다.
8000번 포트가 사용 중이면 `npm start -- --port 8190`으로 실행합니다.
Linux/macOS는 `py -3` 대신 `python3`를 사용합니다. 실행 스크립트의 Python은
`PYTHON` 환경변수로 지정할 수 있습니다.

프론트를 수정할 때는 `npm run dev`를 사용합니다. REST·AR 서버와 Vite를 함께 실행하고
`http://localhost:5173`에서 확인합니다. 포트는 `BACKEND_PORT`, `FRONTEND_PORT`로 변경합니다.
AR 소스를 수정하면 `npm run build:ar`로 다시 빌드합니다.
휴대폰의 실제 카메라·WebXR은 HTTPS 또는 USB 포트 전달의 localhost에서 검증합니다.

## 연결 방식

- 프론트는 기본으로 같은 origin의 `/api/v1`을 사용합니다. 외부 REST 주소는
  `VITE_API_URL`, 샘플 데이터만 쓰는 모드는 `VITE_SAMPLE_MODE=1`로 지정합니다.
- 별의 새싹과 4인 공연은 `/ar/`에서 독립 빌드로 실행합니다. 프론트의 작품·역할극 화면에서
  열 수 있으며 Three.js 버전은 각 프로젝트의 lockfile을 유지합니다.
- 각 미션 완료는 서버에 즉시 저장합니다. 연결이 끊기면 별을 기기에 보관하고 재시도합니다.
  재접속 시 서버 별을 합치며 중복 지급하지 않습니다. 다음 회차는 새 세션을 사용합니다.
- 헤레디움의 `view`는 기존 서버 `c/role` 별의 별칭입니다. 기존 DB와 role 클라이언트를
  보존하면서 전시·단서 얻기 포함 별 6개로 쿠폰 한 장을 발급합니다.
- AR 창을 닫거나 Quick Look에서 돌아오는 것만으로 별을 주지 않습니다.
  공연 완료 메시지는 같은 origin·실제 iframe·일회용 토큰과 실제 추적 실행을 확인합니다.
  기존 데모 건너뛰기와 전시 확인 버튼은 유지합니다.
- `shared/tour.json`이 스팟 ID·미션·카페 지도 데이터의 기준입니다. 통합 앱은 이 파일의
  키코·우시아·오시우커피 ID를 서버에 등록하고 화면은 서버의 쿠폰 사용 상태를 따릅니다.
  좌표는 기존 프론트의 임시값이며 실제 제휴·혜택·영업시간은 확정 전입니다.
  기존 Swagger용 데모 매장과 저장된 쿠폰은 삭제하지 않습니다.

통합 실행 진입점은 `backend/app/integrated.py`입니다. 기존 백엔드 단독 실행
`app.demo:app`과 AR 단독 빌드는 그대로 사용할 수 있습니다.
최신 AR 브랜치의 이미지 추적 비교 화면도 `/ar/?trackingLab=1&engine=mindar`
또는 `/ar/?trackingLab=1&engine=nft`에서 실행합니다.

## 검증

```powershell
npm run lint
npm run test:backend
npm run test:integration
```

통합 브라우저 검사는 빌드 후 `npm start`로 서버를 띄운 상태에서 실행합니다.
`CHROME_PATH`로 Chrome 실행 파일을 지정할 수 있습니다.
브라우저 자동 검사는 실제 휴대폰 공간 추적·발열·현장 정합 검증을 대신하지 않습니다.

REST 계약은 [backend/API.md](backend/API.md), AR 계약은
[ar-engine/contracts/app-integration.md](ar-engine/contracts/app-integration.md)를 참고합니다.
