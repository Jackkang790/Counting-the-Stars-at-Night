import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { resolve } from "node:path";

// 에셋 공급: scripts/stage-assets.mjs 가 Codex 모델(두 GLB + 매니페스트)을
// feature/blender-assets git ref 에서 ar-engine/.assets/models/ 로 스테이징한다.
// 이 디렉터리를 publicDir 로 사용 → dev 서빙과 `vite build`(dist/models/)에 모두 포함.
// 결과적으로 dist/ 는 worktree 경로에 의존하지 않는 자립 배포물이 된다.
// (npm 의 predev/prebuild 훅이 스테이징을 자동 실행한다.)
const STAGED_PUBLIC = resolve(__dirname, ".assets");

// WebXR(immersive-ar)은 보안 컨텍스트(HTTPS)를 요구한다. basic-ssl 로 개발용 자체 서명
// 인증서를 제공한다. USB 포트포워딩(localhost)에서는 AR_HTTP=1 로 평문 HTTP 서빙이 가능하다.
const useHttp = process.env.AR_HTTP === "1";

export default defineConfig({
  root: ".",
  publicDir: STAGED_PUBLIC,
  base: process.env.AR_BASE ?? "/", // GitHub Pages 서브경로 배포 시 AR_BASE 로 지정
  plugins: [...(useHttp ? [] : [basicSsl()])],
  server: {
    host: true, // 같은 네트워크의 스마트폰에서 접속 허용
    port: 5173,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
