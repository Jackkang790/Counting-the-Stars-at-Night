// 헤드리스 에셋 검증 — 실제 Codex GLB를 GLTFLoader로 파싱하고
// Emerge → Idle → Disappear 애니메이션을 AnimationMixer로 구동하여
// ANCHOR_Ground 노드의 TRS가 의도대로 변하는지 측정한다.
//
// WebXR(카메라/hit-test)이 아니라 "GLB 로드 + 애니메이션 재생" 파이프라인만 검증한다.
// GLTFLoader.parse(ArrayBuffer)는 XHR/DOM 없이 동작하므로 Node에서 실행 가능
// (이 GLB는 외부 리소스/텍스처 0개).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLB = resolve(__dirname, "../../public/models/starseed_sculpture.glb");

// 엔진과 동일한 느슨한 클립 탐색(gltf.ts findClipLoose와 동일 규칙).
const norm = (s) => s.replace(/^ar[_-]?/i, "").toLowerCase();
const pick = (clips, canonical) => clips.find((c) => norm(c.name) === norm(canonical));

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const buf = readFileSync(GLB);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
loader.parse(
  ab,
  "",
  (gltf) => {
    const clipNames = gltf.animations.map((c) => c.name);
    console.log(`✓ GLB 파싱 성공: ${GLB}`);
    console.log(`  clips = [${clipNames.join(", ")}]`);

    const emerge = pick(gltf.animations, "Emerge");
    const idle = pick(gltf.animations, "Idle");
    const disappear = pick(gltf.animations, "Disappear");
    if (!emerge) fail("Emerge 클립을 찾지 못함");
    if (!idle) fail("Idle 클립을 찾지 못함");
    if (!disappear) fail("Disappear 클립을 찾지 못함");
    console.log("✓ Emerge / Idle / Disappear 클립 모두 해석됨(AR_ 접두사 호환 리졸버)");

    const anchor = gltf.scene.getObjectByName("ANCHOR_Ground");
    if (!anchor) fail("ANCHOR_Ground 노드를 찾지 못함");

    const mixer = new THREE.AnimationMixer(gltf.scene);

    // --- Emerge: 시작(t=0)과 끝에서 스케일이 커지는지 ---
    const emergeAction = mixer.clipAction(emerge);
    emergeAction.setLoop(THREE.LoopOnce, 1);
    emergeAction.clampWhenFinished = true;
    emergeAction.reset().play();

    mixer.setTime(0);
    const s0 = anchor.scale.clone();
    const y0 = anchor.position.y;
    // 끝 프레임까지 진행
    mixer.setTime(emerge.duration);
    const s1 = anchor.scale.clone();
    const y1 = anchor.position.y;

    console.log(
      `  Emerge: scale ${fmt(s0)} → ${fmt(s1)} | ANCHOR_Ground.y ${y0.toFixed(3)} → ${y1.toFixed(3)} (dur ${emerge.duration}s)`
    );
    const grew = s1.x > s0.x + 1e-4 || s1.y > s0.y + 1e-4 || s1.z > s0.z + 1e-4 || Math.abs(y1 - y0) > 1e-4;
    if (!grew) fail("Emerge 동안 ANCHOR_Ground TRS 변화가 감지되지 않음(솟아오름 미작동)");
    console.log("✓ Emerge: 등장 중 TRS 변화 확인(땅에서 솟아오름)");

    // --- Idle: 반복 재생 중 시간에 따라 상태가 변하는지(미세 회전 등) ---
    emergeAction.stop();
    const idleAction = mixer.clipAction(idle);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    idleAction.reset().play();
    // 듀레이션 전체를 샘플링하여 최대 yaw 편차를 측정(사인 요동의 영점만 보고 오판 방지).
    let maxYaw = 0;
    for (let i = 0; i <= 16; i++) {
      mixer.setTime((idle.duration * i) / 16);
      maxYaw = Math.max(maxYaw, Math.abs(anchor.rotation.y));
    }
    console.log(`  Idle: 최대 yaw 편차 ${(maxYaw * 180 / Math.PI).toFixed(2)}° (dur ${idle.duration}s, loop)`);
    if (maxYaw < 1e-3) fail("Idle 동안 움직임이 감지되지 않음");
    console.log("✓ Idle: 루프 클립 구동 확인(미세 요동)");

    // --- Disappear: 끝에서 스케일이 0에 수렴(사라짐)하는지 ---
    idleAction.stop();
    const disAction = mixer.clipAction(disappear);
    disAction.setLoop(THREE.LoopOnce, 1);
    disAction.clampWhenFinished = true;
    disAction.reset().play();
    mixer.setTime(0);
    const d0 = anchor.scale.clone();
    mixer.setTime(disappear.duration);
    const d1 = anchor.scale.clone();
    console.log(`  Disappear: scale ${fmt(d0)} → ${fmt(d1)} (dur ${disappear.duration}s)`);
    const shrank = d1.x < d0.x - 1e-4 || d1.y < d0.y - 1e-4 || d1.z < d0.z - 1e-4;
    if (!shrank) fail("Disappear 동안 축소가 감지되지 않음");
    console.log("✓ Disappear: 퇴장 중 축소 확인");

    console.log("\n✅ 에셋 로드 + Emerge→Idle→Disappear 파이프라인 검증 통과 (헤드리스)");
    console.log("   ※ WebXR 세션/hit-test/카메라 합성은 실기기 전까지 미검증.");
  },
  (err) => fail(`GLTFLoader 파싱 실패: ${err?.message ?? err}`)
);

function fmt(v) {
  return `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
}
