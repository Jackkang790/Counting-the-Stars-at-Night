import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// WebXR(immersive-ar)는 보안 컨텍스트(HTTPS)를 요구합니다.
// - PC localhost는 그 자체로 secure context지만, 실제 Android 기기로 접속하려면 HTTPS가 필요합니다.
// - basic-ssl 플러그인으로 개발용 자체 서명 인증서를 제공합니다(기기에서 "안전하지 않음" 경고 수락 필요).
//
// 에셋 공유: Codex 산출물은 레포 루트 `public/models/`에 있습니다.
// publicDir를 레포 루트 `public/`로 지정하여 `/models/*.glb`가 Codex 파일을 그대로 가리키게 합니다.
// (복사/중복 없음. Codex 파일은 읽기만 합니다.)
export default defineConfig({
  root: ".",
  publicDir: "../public",
  plugins: [basicSsl()],
  server: {
    host: true, // 같은 네트워크의 스마트폰에서 접속 허용
    port: 5173,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
