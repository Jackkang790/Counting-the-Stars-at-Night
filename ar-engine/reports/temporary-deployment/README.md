# 기존 임시 서버 배포

후속 [카메라 잘림 수정](../camera-fit/README.md)이 같은 주소에 반영되었다. 아래 내용은 최초 정상 경로 배포 기록이다.

- 공연: https://ar.lobodoc.com/?musical=1
- 기존 AR 화면: https://ar.lobodoc.com/
- 실행 순서: 실사 샘플 배우 2명 불러오기 → AR 카메라 시작 → 정합 확정 → 공연 시작.

기존 서버의 AR Docker 서비스에 검증된 `spatial-volume/demo-root.zip` 루트 빌드를 배포했다. 이전 배포에 Windows Git 설치 경로가 웹 파일 주소로 들어간 문제를 확인하고 정상 `/assets/` 경로 빌드로 교체했다. 호스트 HTTPS·nginx와 Docker 구성 파일은 수정하지 않았다. 로컬 `ar-engine/dist`도 배포본과 맞췄다.

## 검증

- 공인 HTTPS 주소 정상 접속.
- [배포 파일 32개](./file-verification.json): 검증된 빌드와 SHA-256 전부 일치.
- [공개 경로 검사](./route-report.json): 기존 화면·새 공연 진입·표적·배우 영상 로드 통과.
- [공개 서버 브라우저 통합 검사](./browser-report.json): 실사 영상 2명, 전체 30초·다시 보기·일시정지, 합성 카메라 포즈 변화·상실·복구, 사진 출력, 기존 iPhone UA의 GLB→USDZ 링크 생성 통과.
- [공개 페이지 스크립트 진단](./public-browser-diagnostic.json).

브라우저 검증은 Windows Chrome headless/SwiftShader이며 실제 휴대폰 시험이 아니다. 실제 iPhone·Android의 AR 고정·정합·동기·촬영 검증은 여전히 미실행이다. 이미지 표적은 충분히 크게 보여야 하며 표적을 놓치면 무대가 숨고 정지한다. 영상 평면은 완전한 입체 인물이 아니다.

## 배포 식별과 복구

- 배포 이미지: `ar-site:musical-a8a4e7ed` (현재 서비스 태그 `ar-site:latest`).
- 복구 이미지: `ar-site:rollback-20261029T160650Z`.
- 이전 빌드 디렉터리: `/home/ubuntu/ar-docker/backups/dist-20261029T160650Z`.
- 배포 디렉터리: `/home/ubuntu/ar-docker/releases/musical-a8a4e7ed`.
- ZIP SHA-256: `a8a4e7ed9c5a225c953bea0b5d85e6bc3dd3c07b439a7af275bb0aa79539348f`.
- index.html SHA-256: `4f595bb585f90d5fecf96967e7c6fdffe074524061166fdfae57e86f89ff68e7`.

`before-deployment-*` 파일은 잘못된 경로가 들어 있던 배포의 진단 기록이다. 새 빌드는 Git Bash의 경로 자동 변환을 피하도록 PowerShell에서 기본 `/` 값으로 빌드하고 HTML·JS에 Windows 경로가 없는지 확인한다. 기존 Vite 설정 변경은 필요하지 않다.
