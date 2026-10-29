import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from '../.tools/qa/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../.tools/qa/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = fs.readFileSync(path.join(root, 'public/models/starseed_sculpture.glb'));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '');
const expected = { Emerge: 3, Idle: 4, Disappear: 1.5 };
const checks = [];
function check(name, result, evidence) { checks.push({name, passed: Boolean(result), evidence}); assert.ok(result, name); }
const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
check('Metre bounds / Y up', Math.abs(size.x-1.24)<1e-5 && Math.abs(size.y-2.2138741)<1e-4, size.toArray());
check('Anchor name', Boolean(gltf.scene.getObjectByName('ANCHOR_Ground')));
const meshes = [];
gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
check('Four PBR meshes', meshes.length===4 && meshes.every(o=>o.material.isMeshStandardMaterial && o.geometry.attributes.normal));
check('Opaque / frontface culling', meshes.every(o=>!o.material.transparent && o.material.side===THREE.FrontSide));
check('Unified clips', gltf.animations.length===3 && gltf.animations.every(c=>c.name in expected));
const poses = {};
for (const clip of gltf.animations) {
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  check(`${clip.name} duration`, Math.abs(clip.duration-expected[clip.name])<1e-6, clip.duration);
  const anchor = gltf.scene.getObjectByName('ANCHOR_Ground');
  poses[clip.name] = [];
  for (const time of [0, clip.duration/4, clip.duration/2, clip.duration]) {
    mixer.setTime(time);
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const s = box.getSize(new THREE.Vector3());
    poses[clip.name].push({time, scale:anchor.scale.toArray(), size:s.toArray(), rotation:anchor.quaternion.toArray()});
  }
  const samples = poses[clip.name];
  const first = clip.name==='Emerge' ? 0 : 1;
  const last = clip.name==='Disappear' ? 0 : 1;
  check(`${clip.name} start`, samples[0].scale.every(v=>Math.abs(v-first)<1e-6));
  check(`${clip.name} end`, samples.at(-1).scale.every(v=>Math.abs(v-last)<1e-6));
  if (clip.name==='Idle') check('Idle yaw motion', Math.abs(samples[1].rotation[1])>.01);
  else check(`${clip.name} intermediate geometry`, samples[2].size[1]>0.9 && samples[2].size[1]<1.5);
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
}
const report = {passed:true, three_revision:THREE.REVISION, package_version:'0.186.1',
  glb_sha256:createHash('sha256').update(bytes).digest('hex'),
  scope:'Node GLTFLoader parse + PBR geometry + AnimationMixer playback; WebGL checked separately', checks, poses};
fs.writeFileSync(path.join(root,'blender/reports/three-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log('THREE_VALIDATION_OK', JSON.stringify({revision:THREE.REVISION,checks:checks.length}));
