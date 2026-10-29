// 헤드리스 정합 에셋 검증 — Codex alignment_test_facade.
// GLB 파싱 + 매니페스트 레이어/기준점 일치 + 기준점 월드 거리(6m, 3.6m) 확인.
// Codex 파일은 읽기만 한다(공유 루트 → 없으면 Codex worktree로 폴백).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const CANDIDATES = [
  resolve(ROOT, "public/models"),
  process.env.AR_CODEX_MODELS ?? resolve(ROOT, "blender/.worktrees/feature-blender-assets/public/models"),
];
function find(name) {
  for (const d of CANDIDATES) if (existsSync(resolve(d, name))) return resolve(d, name);
  return null;
}
function fail(m) { console.error(`✗ ${m}`); process.exit(1); }

const glbPath = find("alignment_test_facade.glb");
const manPath = find("alignment_test_facade.manifest.json");
if (!glbPath) fail("alignment_test_facade.glb 를 찾지 못함(루트/worktree 모두 없음)");
if (!manPath) fail("alignment_test_facade.manifest.json 를 찾지 못함");
console.log(`GLB:      ${glbPath}`);
console.log(`manifest: ${manPath}`);

const manifest = JSON.parse(readFileSync(manPath, "utf-8"));
const buf = readFileSync(glbPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

new GLTFLoader().parse(ab, "", (gltf) => {
  console.log(`✓ GLB 파싱 성공 (${gltf.animations.length} anim — 정합 시험물은 정적)`);

  // 앵커
  const anchorName = manifest.anchor?.node ?? "ANCHOR_Facade";
  if (!gltf.scene.getObjectByName(anchorName)) fail(`앵커 노드 없음: ${anchorName}`);
  console.log(`✓ 앵커 노드: ${anchorName}`);

  // 레이어 노드
  const layers = manifest.layers ?? [];
  for (const l of layers) {
    if (!gltf.scene.getObjectByName(l.node)) fail(`레이어 노드 없음: ${l.node}`);
  }
  console.log(`✓ 레이어 ${layers.length}종: [${layers.map((l) => l.node).join(", ")}]`);

  // 기준점 노드
  const pts = manifest.calibration?.reference_points ?? [];
  const byName = {};
  for (const p of pts) {
    const n = gltf.scene.getObjectByName(p.node);
    if (!n) fail(`기준점 노드 없음: ${p.node}`);
    byName[p.node] = n;
  }
  console.log(`✓ 기준점 ${pts.length}개 모두 존재`);

  // 배치 Group로 감싸 월드 거리 확인(엔진 규약: Group에 변환, 내부는 로컬 TRS)
  const group = new THREE.Group();
  group.add(gltf.scene);
  group.position.set(3, 0, -5);
  group.rotation.y = Math.PI / 7;
  group.updateMatrixWorld(true);

  const wp = (name) => byName[name].getWorldPosition(new THREE.Vector3());
  const d = (a, b) => wp(a).distanceTo(wp(b));
  const horiz = d("PT_P01_WallBL", "PT_P02_WallBR");
  const vert = d("PT_P01_WallBL", "PT_P03_WallTL");
  console.log(`  기준선: 가로 ${horiz.toFixed(3)}m (기대 6), 세로 ${vert.toFixed(3)}m (기대 3.6)`);
  if (Math.abs(horiz - 6) > 1e-3) fail("가로 기준선 6m 불일치");
  if (Math.abs(vert - 3.6) > 1e-3) fail("세로 기준선 3.6m 불일치");
  console.log("✓ 배치 Group 변환 후에도 기준점 간 실척 거리 보존(강체 정합)");

  console.log("\n✅ 정합 에셋 로드 + 레이어/기준점/실척 검증 통과 (헤드리스)");
  console.log("   ※ 실제 관사 16호 대응·브라우저/모바일 GPU·WebXR은 현장 자료·실기기 전까지 미검증.");
}, (err) => fail(`GLTFLoader 파싱 실패: ${err?.message ?? err}`));
