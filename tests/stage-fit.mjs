import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import ts from '../ar-engine/node_modules/typescript/lib/typescript.js';
const threeUrl=pathToFileURL(resolve(import.meta.dirname,'../ar-engine/node_modules/three/build/three.module.js')).href;
const T=await import(threeUrl);
const source=ts.transpileModule(readFileSync(resolve(import.meta.dirname,'../ar-engine/src/musical/stageFit.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText.replace('from \'three\'',`from '${threeUrl}'`);
const {fitFloorStage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const [w,h] of [[412,863],[915,360]])for(const distance of [.35,.8,3,8]){
 const camera=new T.PerspectiveCamera(45,w/h,.01,100);camera.position.set(0,1.5,0);camera.lookAt(0,0,-distance);camera.updateMatrixWorld(true);
 const pose=new T.Matrix4().makeRotationY(Math.PI);pose.setPosition(0,0,-distance);
 const scale=fitFloorStage(pose,camera,3.8);assert.ok(scale>=.03&&scale<=1);
 for(const x of [-1.9,1.9])for(const y of [0,1.8])for(const z of [-.95,0]){
  const point=new T.Vector3(x,y,z).multiplyScalar(scale).applyMatrix4(pose).project(camera);
  assert.ok(Math.abs(point.x)<=.881&&point.y>=-.971&&point.y<=.721,JSON.stringify({w,h,distance,scale,point}));
 }
 assert.deepEqual(new T.Vector3().setFromMatrixPosition(pose).toArray(),[0,0,-distance]);
}
assert.equal(fitFloorStage(new T.Matrix4(),new T.PerspectiveCamera()),1);
const manualSource=ts.transpileModule(readFileSync(resolve(import.meta.dirname,'../ar-engine/src/musical/manualPlacement.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText.replace('from \'three\'',`from '${threeUrl}'`);
const {manualStagePose}=await import('data:text/javascript;base64,'+Buffer.from(manualSource).toString('base64'));
const viewer=new T.PerspectiveCamera();viewer.position.set(0,1.5,0);viewer.updateMatrixWorld(true);
const manual=manualStagePose(viewer,2),saved=manual.toArray();assert.equal(manual.elements[14],-2);assert.ok(Math.abs(manual.elements[13]-1.14)<1e-9);
viewer.position.x=2;viewer.rotation.y=.5;viewer.updateMatrixWorld(true);assert.deepEqual(manual.toArray(),saved,'A saved world placement never follows later camera changes');
for(const distance of [NaN,0,7])assert.throws(()=>manualStagePose(viewer,distance));
console.log(JSON.stringify({result:'PASS',views:8,nearFloorMeters:[.35,.8],fourActorBoundsFit:true,anchorUnchanged:true,phoneARVerified:false}));
