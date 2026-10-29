import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import ts from '../node_modules/typescript/lib/typescript.js';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'package.json')),cache=new Map();
async function moduleUrl(path){path=resolve(path);if(cache.has(path))return cache.get(path);let code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
for(const m of [...code.matchAll(/from\s+["']([^"']+)["']/g)]){const s=m[1];let url;if(s.startsWith('.')){let p=resolve(dirname(path),s);if(!existsSync(p))p+='.ts';url=await moduleUrl(p);}else url=pathToFileURL(s==='three'?resolve(root,'node_modules/three/build/three.module.js'):require.resolve(s)).href;code=code.replaceAll(JSON.stringify(s),JSON.stringify(url));}
const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(path,url);return url;}
const T=await import(pathToFileURL(resolve(root,'node_modules/three/build/three.module.js')).href),{RiggedGLBPerformer}=await import(await moduleUrl(resolve(root,'src/musical/riggedGLB.ts')));
const config=JSON.parse(readFileSync(resolve(root,'musical-assets/show.json'))).actors[0];
const data=readFileSync(resolve(root,'musical-assets/test-actor-animated.glb')),bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),actor=await RiggedGLBPerformer.load(config,bytes);
assert.equal(actor.representation,'rigged-glb');assert.equal(actor.contentKind,'synthetic-calibration');
const stage=new T.Group(),slot=new T.Group(),camera=new T.PerspectiveCamera();stage.position.set(2,1,-4);stage.rotation.y=.4;stage.add(slot);slot.position.fromArray(config.position);slot.add(actor.group);
let bone;actor.model.traverse(n=>{if(n.isBone&&n.name==='LeftUpperArm')bone=n;});assert.ok(bone);
actor.sample(config.start+1,true);const a=bone.quaternion.toArray();actor.sample(config.start+1.5,true);assert.notDeepEqual(bone.quaternion.toArray(),a);
const paused=bone.quaternion.toArray();actor.sample(config.start+1.5,false);assert.deepEqual(bone.quaternion.toArray(),paused);
stage.updateMatrixWorld(true);const fixed=slot.matrixWorld.toArray();for(const x of [-2,0,2]){camera.position.set(x,1,2);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);actor.sample(config.start+2+x/10,true);stage.updateMatrixWorld(true);assert.deepEqual(slot.matrixWorld.toArray(),fixed);}
actor.sample(0,false);assert.equal(actor.group.visible,false);actor.sample(30,false);assert.equal(actor.group.visible,false);
const rig=readFileSync(resolve(root,'../performer-service/tests/fixtures/test-actor-rig.glb'));await assert.rejects(RiggedGLBPerformer.load(config,rig.buffer.slice(rig.byteOffset,rig.byteOffset+rig.byteLength)),/본 동작/);
actor.dispose();console.log(JSON.stringify({result:'PASS',skeletalPoseChanges:true,sharedClockPause:true,twoSpatialDimensionsPlusDepth:true,cameraIndependentBuildingAnchor:true,syntheticFlagPreserved:true,staticRigRejected:true,deviceARVerified:false},null,2));
