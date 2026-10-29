// Actual Three.js parsing, layer toggling and registration transform tests, no engine edits.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import * as THREE from '../.tools/qa/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../.tools/qa/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const bytes=fs.readFileSync(path.join(root,'public/models/alignment_test_facade.glb'));
const sha=createHash('sha256').update(bytes).digest('hex');
const require=createRequire(import.meta.url);
const validator=require('../.tools/qa/node_modules/gltf-validator');
const checks=[];
const save=(name,value)=>fs.writeFileSync(path.join(root,'blender/reports',name),JSON.stringify(value,null,2)+'\n');
function check(name,passed,evidence){checks.push({name,passed:Boolean(passed),evidence});if(!passed){save('alignment_three.json',{passed:false,glb_sha256:sha,checks});throw Error(name);}}
const khronos=await validator.validateBytes(new Uint8Array(bytes),{uri:'alignment_test_facade.glb',maxIssues:1000,
 externalResourceFunction:()=>Promise.reject(Error('External resources forbidden'))});
save('alignment_khronos.json',khronos);
check('Khronos zero errors/warnings',!khronos.issues.numErrors&&!khronos.issues.numWarnings,khronos.issues);
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const build=JSON.parse(fs.readFileSync(path.join(root,'blender/reports/alignment_build.json'),'utf8'));
const points=build.reference_points_gltf_m;
check('No animation drift',gltf.animations.length===0);
check('Anchor at origin',gltf.scene.getObjectByName('ANCHOR_Facade').position.length()<1e-6);
const groups=Object.keys(build.layer_meshes);
for(const group of groups)check('Named layer '+group,Boolean(gltf.scene.getObjectByName(group)));
const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
check('Eleven meshes',meshes.length===11);
check('PBR material and normals',meshes.every(o=>o.material.isMeshStandardMaterial&&o.geometry.attributes.normal));
const overlays=meshes.filter(o=>o.parent.name==='OVERLAY_Architecture');
check('Four transparent overlays',overlays.length===4&&overlays.every(o=>o.material.transparent&&Math.abs(o.material.opacity-.28)<1e-6));
check('Reference opaque',meshes.filter(o=>o.parent.name==='REFERENCE_Facade').every(o=>!o.material.transparent));
check('Front culling',meshes.every(o=>o.material.side===THREE.FrontSide));
for(const [name,expected]of Object.entries(points)){
 const node=gltf.scene.getObjectByName(name);check('GLB point '+name,node&&node.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...expected))<1e-5);
}
const box=new THREE.Box3().setFromObject(gltf.scene);
check('Exported AABB',box.min.distanceTo(new THREE.Vector3(-3.08,-.075,-.054))<1e-4&&box.max.distanceTo(new THREE.Vector3(3.08,3.68,.2))<1e-4,{min:box.min.toArray(),max:box.max.toArray()});
const facade=gltf.scene.getObjectByName('REFERENCE_Facade');facade.visible=false;
check('Real-building mode hides proxy',!facade.visible&&gltf.scene.getObjectByName('OVERLAY_Architecture').visible);
facade.visible=true;
const wrapper=new THREE.Group();wrapper.position.set(1.2,.4,-2.1);wrapper.rotation.set(.03,.21,-.02);wrapper.add(gltf.scene);wrapper.updateMatrixWorld(true);
for(const [name,expected]of Object.entries(points)){
 const wanted=new THREE.Vector3(...expected).applyMatrix4(wrapper.matrixWorld);
 const actual=gltf.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 check('Placement group point '+name,actual.distanceTo(wanted)<1e-5);
}
const baseline=gltf.scene.getObjectByName('PT_P01_WallBL').getWorldPosition(new THREE.Vector3()).distanceTo(gltf.scene.getObjectByName('PT_P02_WallBR').getWorldPosition(new THREE.Vector3()));
check('Rigid transform keeps 6m baseline',Math.abs(baseline-6)<1e-5,baseline);
save('alignment_three.json',{passed:true,three_revision:THREE.REVISION,glb_sha256:sha,checks,
 scope:'Node GLTFLoader + PBR BLEND + layers + local/world point transforms; not GPU, XR or tracking accuracy'});
console.log('ALIGNMENT_THREE_OK',JSON.stringify({revision:THREE.REVISION,checks:checks.length,khronosErrors:khronos.issues.numErrors,khronosWarnings:khronos.issues.numWarnings}));
