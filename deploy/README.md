# 통합 서버 배포

기존 `ar.lobodoc.com` 호스트 nginx와 제작 서비스는 유지하고, AR nginx에 통합 정적 빌드를
읽기 전용으로 연결한다. 새 `tour-api` 서비스는 기존 DB 복사본을 호스트의
`/home/ubuntu/ar-docker/tour-data`에 영속 저장하며 자동 재시작한다.

`npm run build` 후 `npm run package:release`로 `.tmp/releases/latest.json`에 기록된 zip과 SHA256을 만든다.
zip과 `activate.sh`를 서버에 올린 뒤 다음 명령으로 활성화한다.

```bash
bash activate.sh /home/ubuntu/unified-COMMIT-HASH.zip ZIP_SHA256
```

스크립트는 모든 배포 파일의 해시와 경로를 확인하고, 기존 DB를 SQLite backup으로 보존한다.
API 준비와 nginx 설정 검증을 마친 뒤 웹 컨테이너만 교체한다. 실패하면 이전 웹 구성으로 복구하고
DB 백업은 별도 비공개 경로에 유지한다. 제작 컨테이너와 원본 데이터는 재생성하지 않는다.
기존 `/?musical=1`, `/?studio=1`, `/?trackingLab=1` 링크는 `/ar/`로 전달한다.

현재 배포는 서버의 `current-tour/release.json`과 `unified.env`로 확인한다.
이후 관리는 `/home/ubuntu/ar-docker/manage-tour.sh ps` 또는 `manage-tour.sh up -d`를 사용한다.
각 릴리스의 `www`, 배포 설정과 기존 이미지가 복구 자료다. 자동 검사는 실제 휴대폰 AR 검증과 구분한다.
