# AR 테스트 사이트 컨테이너.
# dist/ 는 로컬(또는 CI)에서 `AR_BASE=/ npm run build` 로 생성한 자립 배포물을 그대로 담는다.
# (stage-assets 가 Codex GLB 를 dist/models/ 에 포함시키므로 워크트리 의존성 없음.)
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
