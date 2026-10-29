# 임시 서버 배포

공개 웹: https://ar.lobodoc.com/?musical=1

제작실: https://ar.lobodoc.com/?studio=1

기존 `ar-docker/docker-compose.yml`과 Dockerfile은 유지한다. `deploy/compose.override.yml`을 함께 지정해 제작 API를 추가한다. nginx는 정적 AR 빌드를 제공하며 `/api/studio/`만 제작 컨테이너로 전달한다. 호스트 HTTPS 프록시도 업로드 크기 제한을 설정해야 한다. CDN 계정의 전송 제한은 별도로 적용될 수 있다.

서버 배치:

```text
/home/ubuntu/ar-docker/
  docker-compose.yml             # 기존 파일
  Dockerfile                     # 기존 nginx 이미지
  nginx.conf                     # deploy/nginx.conf를 반영
  dist/                          # 기존 엔진을 포함한 실행용 웹 빌드
  performer-service/
    package.json, package-lock.json
    src/, blender/, deploy/
    private.env                  # chmod 600, Git/Docker 빌드에서 제외
  performer-data/                 # 영속 DB/원본/결과; 정적 루트 밖
```

`private.env`에 관리자 암호 및 API 키를 설정한다. compose 환경변수는 내부 바인딩·데이터 경로·Secure 쿠키를 지정한다. 컨테이너는 root가 아닌 node 사용자로 실행하므로 데이터 폴더의 쓰기 권한을 UID 1000에 부여한다. 제작 API 포트는 호스트에 공개하지 않는다.

```sh
cd /home/ubuntu/ar-docker
sudo docker compose -f docker-compose.yml -f performer-service/deploy/compose.override.yml build
sudo docker compose -f docker-compose.yml -f performer-service/deploy/compose.override.yml up -d studio ar
sudo docker exec ar-site nginx -s reload
```

현재 이미지에는 Debian Bookworm의 Blender 및 NumPy를 설치한다. 로컬 검증용 Blender 4.5 LTS와 서버 버전은 다를 수 있으므로 서버의 실제 변환 검사를 별도로 기록한다. Tripo와 DeepMotion 키는 자동 포함하지 않는다. 서버 키 설정 후에도 각 유료 단계의 명시적 승인이 필요하다.

배포 전 기존 이미지를 별도 태그로 보존하고 nginx/dist를 백업한다. 장애 시 이전 ar-site 이미지로 태그를 복원하고 원래 compose로 ar 서비스만 재생성한다. 제작 데이터 볼륨은 삭제하지 않는다. `deploy/` 파일 및 비공개 환경변수도 운영 백업 대상으로 관리한다.
