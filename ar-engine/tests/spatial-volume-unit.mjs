import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "../node_modules/typescript/lib/typescript.js";
const root = resolve(import.meta.dirname, ".."), require = createRequire(resolve(root, "package.json")), cache = new Map();
async function moduleUrl(path) {
  path = resolve(path); if (cache.has(path)) return cache.get(path);
  let code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const match of [...code.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const specifier = match[1]; let url;
    if (specifier.startsWith(".")) { let target = resolve(dirname(path), specifier); if (!existsSync(target)) target += ".ts"; url = await moduleUrl(target); }
    else url = pathToFileURL(specifier === "three" ? resolve(root,"node_modules/three/build/three.module.js") : require.resolve(specifier)).href;
    code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
  }
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`; cache.set(path, url); return url;
}
const THREE = await import(pathToFileURL(resolve(root, "node_modules/three/build/three.module.js")).href);
const { MeshSequencePerformer } = await import(await moduleUrl(resolve(root, "src/musical/meshSequence.ts")));
const { validateMeshSequence, sequenceFrame } = await import(await moduleUrl(resolve(root, "src/musical/volumeManifest.ts")));
const { mountSpatialPerformer, spatialSnapshot } = await import(await moduleUrl(resolve(root, "src/musical/spatial.ts")));
const folder = resolve(root, "musical-assets/volume-calibration"), manifest = JSON.parse(readFileSync(resolve(folder, "calibration.vseq.json")));
const config = JSON.parse(readFileSync(resolve(root, "musical-assets/show.json"))).actors[0];
const read = async name => { const data = readFileSync(resolve(folder, name)); return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength); };
assert.equal(validateMeshSequence(manifest).source.kind, "synthetic-calibration");
assert.throws(() => validateMeshSequence({ ...manifest, fps: 0 }));
assert.throws(() => validateMeshSequence({ ...manifest, frames: ["../secret.glb", "frame-01.glb"] }));
assert.throws(() => validateMeshSequence({ ...manifest, source: { kind: "video", title: "x", license: "x" } }));
assert.equal(sequenceFrame(.5, 12, 12, true), 6); assert.equal(sequenceFrame(1.5, 12, 12, true), 6); assert.equal(sequenceFrame(9,12,12,false),11);
const volume = await MeshSequencePerformer.load(config, manifest, read);
assert.equal(volume.frameCount, 12); assert.equal(volume.representation, "mesh-sequence");
volume.sample(5.5, true); assert.equal(volume.currentFrame, 6);
volume.sample(5.8, true); assert.equal(volume.currentFrame, 9);
assert.equal(volume.group.children.filter(o => o.visible).length, 1);
volume.sample(4.9, true); assert.equal(volume.group.visible, false);
volume.sample(7, false); const frozen = volume.currentFrame; volume.sample(7, false); assert.equal(volume.currentFrame, frozen);

const stage = new THREE.Group(), registration = new THREE.Group(); registration.position.set(2,.4,-3); registration.rotation.y=.4; registration.add(stage);
const slot = { group: new THREE.Group(), config, representation: volume.representation, contentKind: volume.contentKind, frameIndex: 0, frameCount: 12 };
slot.group.position.fromArray(config.position); slot.group.add(volume.group); mountSpatialPerformer(stage, new Map([["door",new THREE.Vector3(.65,.4,0)]]), slot);
const camera = new THREE.PerspectiveCamera(50,1,.01,100), before = spatialSnapshot(stage,[slot],camera)[0];
const nearMatrix = (a,b) => assert.ok(a.length===b.length && a.every((n,i)=>Math.abs(n-b[i])<1e-9));
assert.equal(before.belongsToStage,true); assert.equal(before.attachedToCamera,false);
const projection = [];
for (const x of [-1,0,1]) {
  camera.position.set(x,1.2,-6); camera.lookAt(0,1,0); camera.updateMatrixWorld(true);
  volume.sample(6 + x*.1, true); const now = spatialSnapshot(stage,[slot],camera)[0];
  nearMatrix(now.buildingRelativeMatrix,before.buildingRelativeMatrix); nearMatrix(now.worldMatrix,before.worldMatrix);
  projection.push(new THREE.Vector3().setFromMatrixPosition(slot.group.matrixWorld).project(camera).x);
}
assert.ok(Math.abs(projection[0]-projection[2])>.01,"Viewer movement must change perspective without moving performer in the building");
registration.position.x += .3;
const afterMove = spatialSnapshot(stage,[slot],camera)[0]; nearMatrix(afterMove.buildingRelativeMatrix,before.buildingRelativeMatrix); assert.notDeepEqual(afterMove.worldMatrix,before.worldMatrix);
await assert.rejects(() => MeshSequencePerformer.load(config,{...manifest,frames:["frame-00.glb","frame-00.glb"]},read),/정적 형상/);
await assert.rejects(() => MeshSequencePerformer.load(config,manifest,read,()=>true),/취소/);

globalThis.FileReader ??= class { readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});} };
const { GLTFExporter } = await import("../node_modules/three/examples/jsm/exporters/GLTFExporter.js");
const planeScene = new THREE.Scene(); planeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(1,2),new THREE.MeshStandardMaterial()));
const planeBytes = await new GLTFExporter().parseAsync(planeScene,{binary:true});
await assert.rejects(() => MeshSequencePerformer.load(config,{...manifest,frames:["a.glb","b.glb"]},async()=>planeBytes),/평면 파일/);
volume.dispose();
console.log(JSON.stringify({result:"PASS",changing3DFrames:true,nonPlanarGeometryRequired:true,duplicateStaticFramesRejected:true,cameraIndependentBuildingCoordinates:true,parentRegistrationMovementPreservesRelativePlacement:true,physicalDeviceARVerified:false,realHumanVolumetricFootageProvided:false},null,2));
