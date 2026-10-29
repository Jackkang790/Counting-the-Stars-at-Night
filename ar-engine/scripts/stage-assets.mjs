// 빌드/개발용 에셋 스테이징 — Codex 모델을 재현 가능하게 수집한다.
// 소스 우선순위: (1) git ref(feature/blender-assets) → (2) 루트 public/models → (3) Codex worktree.
// 결과를 ar-engine/.assets/models/ 로 복사하고, Vite가 이 디렉터리를 publicDir로 사용한다.
// → dist/ 가 자립적(self-contained)이 되어 worktree 경로에 의존하지 않는다.
// Codex 파일은 읽기만 하며 수정하지 않는다.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../..");
const OUT = resolve(__dirname, "../.assets/models");
const REF = process.env.AR_ASSET_REF ?? "feature/blender-assets";

// 배포에 필요한 모델 파일 목록(두 에셋 + 매니페스트).
const FILES = [
  "starseed_sculpture.glb",
  "starseed_sculpture.manifest.json",
  "asset-manifest.json",
  "alignment_test_facade.glb",
  "alignment_test_facade.manifest.json",
];

const FS_FALLBACKS = [
  resolve(REPO, "public/models"),
  resolve(REPO, "blender/.worktrees/feature-blender-assets/public/models"),
];

function fromGit(name) {
  try {
    return execFileSync("git", ["show", `${REF}:public/models/${name}`], {
      cwd: REPO,
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}
function fromFs(name) {
  for (const d of FS_FALLBACKS) {
    const p = resolve(d, name);
    if (existsSync(p)) return readFileSync(p);
  }
  return null;
}

mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const f of FILES) {
  const git = fromGit(f);
  const buf = git ?? fromFs(f);
  if (!buf) {
    console.error(`✗ 에셋 없음: ${f} (git ref '${REF}' 및 파일시스템 폴백 모두 실패)`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(resolve(OUT, f), buf);
  console.log(`  staged ${f} (${buf.length}B) ← ${git ? `git:${REF}` : "fs"}`);
  ok++;
}
console.log(`✓ 스테이징 ${ok}/${FILES.length} → ${OUT}`);
if (ok < FILES.length) process.exitCode = 1;
