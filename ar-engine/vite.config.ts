import { defineConfig, type Plugin } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, normalize, sep } from "node:path";

// WebXR(immersive-ar)는 보안 컨텍스트(HTTPS)를 요구합니다.
// - PC localhost는 그 자체로 secure context지만, 실제 Android 기기로 접속하려면 HTTPS가 필요합니다.
// - basic-ssl 플러그인으로 개발용 자체 서명 인증서를 제공합니다(기기에서 "안전하지 않음" 경고 수락 필요).
//
// 에셋 공유: Codex 산출물은 레포 루트 `public/models/`에 있습니다.
// publicDir를 레포 루트 `public/`로 지정하여 `/models/*.glb`가 Codex 파일을 그대로 가리키게 합니다.
const REPO_ROOT = resolve(__dirname, "..");

// 일부 Codex 에셋(예: 정합 시험물)은 아직 공유 루트가 아닌 **Codex 전용 worktree**에만
// 있습니다(ALIGNMENT_HANDOFF.md). 개발 중 복사 없이 그 디렉터리를 /models/ 폴백으로
// 읽기 전용 제공합니다. Codex 파일은 읽기만 하며 수정/복사하지 않습니다.
// 경로는 AR_CODEX_MODELS 환경변수로 재정의 가능.
const CODEX_WORKTREE_MODELS =
  process.env.AR_CODEX_MODELS ??
  resolve(REPO_ROOT, "blender/.worktrees/feature-blender-assets/public/models");

const MIME: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
};

/** /models/* 요청 중 루트 public에 없는 파일을 Codex worktree에서 읽기 전용으로 폴백 제공(dev 전용). */
function codexWorktreeModels(): Plugin {
  return {
    name: "codex-worktree-models",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const m = url.match(/^\/models\/([^?#]+)/);
        if (!m) return next();
        const rel = normalize(decodeURIComponent(m[1]));
        const file = resolve(CODEX_WORKTREE_MODELS, rel);
        // 경로 이탈 방지
        if (!file.startsWith(CODEX_WORKTREE_MODELS + sep)) return next();
        if (!existsSync(file) || !statSync(file).isFile()) return next(); // 루트 publicDir가 처리하도록
        const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
        res.setHeader("Access-Control-Allow-Origin", "*");
        createReadStream(file).pipe(res);
      });
    },
  };
}

// USB 포트포워딩(chrome://inspect)으로 폰의 localhost에 연결할 때는 HTTP가 더 간단하다.
// localhost는 HTTP여도 secure context로 인정되어 WebXR이 동작하고 인증서 경고가 없다.
// AR_HTTP=1 이면 자체 서명 인증서(basic-ssl)를 끄고 평문 HTTP로 서빙한다.
const useHttp = process.env.AR_HTTP === "1";

export default defineConfig({
  root: ".",
  publicDir: resolve(REPO_ROOT, "public"),
  plugins: [...(useHttp ? [] : [basicSsl()]), codexWorktreeModels()],
  server: {
    host: true, // 같은 네트워크의 스마트폰에서 접속 허용
    port: 5173,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
