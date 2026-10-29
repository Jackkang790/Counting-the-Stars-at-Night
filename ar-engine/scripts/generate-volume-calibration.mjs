import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Node-only exporter adapter, not part of the browser runtime.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`; this.onloadend?.(); }); }
};
const folder = resolve(import.meta.dirname, "../musical-assets/volume-calibration"); mkdirSync(folder, { recursive: true });
const exporter = new GLTFExporter(), frames = [];
for (let frame = 0; frame < 12; frame++) {
  const t = frame / 12 * Math.PI * 2, root = new THREE.Scene();
  const block = new THREE.Mesh(new THREE.BoxGeometry(.3 + .06 * Math.sin(t), .45, .22), new THREE.MeshStandardMaterial({ color: 0xe9a543, roughness: .7 }));
  block.position.y = .225; root.add(block);
  const side = new THREE.Mesh(new THREE.ConeGeometry(.11, .32, 5), new THREE.MeshStandardMaterial({ color: 0x35c8e2, roughness: .7 }));
  side.position.set(.22, .32, -.18 + .08 * Math.cos(t)); side.rotation.z = .2 * Math.sin(t); root.add(side);
  const name = `frame-${String(frame).padStart(2, "0")}.glb`;
  writeFileSync(resolve(folder, name), new Uint8Array(await exporter.parseAsync(root, { binary: true })));
  root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); frames.push(name);
}
writeFileSync(resolve(folder, "calibration.vseq.json"), JSON.stringify({ version: 1, type: "volumetric-mesh-sequence", units: "meters", up: "+Y", front: "-Z", origin: "ground-center", fps: 12,
  source: { kind: "synthetic-calibration", title: "비대칭 3D 검증 도형 — 실제 인물 아님", license: "project-generated-test-fixture; no performer footage" }, frames }, null, 2) + "\n");
console.log(`Generated ${frames.length} non-human GLB calibration frames: ${folder}`);
