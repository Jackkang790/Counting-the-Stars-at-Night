import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from '../node_modules/typescript/lib/typescript.js';
import {inspectGLB} from '../../performer-service/src/glb.mjs';
const root=resolve(import.meta.dirname,'..'),folder=resolve(root,'musical-assets/quartet');
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(resolve(root,path),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText).toString('base64'));
const {validateShow,mediaTime,actorOpacity}=await load('src/musical/timeline.ts'),{placementIssue,quartetPlacementPolicy}=await load('src/musical/placementPolicy.ts');
const show=validateShow(JSON.parse(readFileSync(resolve(folder,'show.json'))));assert.equal(show.duration,10);assert.equal(show.actors.length,4);assert.ok(show.actors.every(a=>a.anchor==='stage'&&a.position[1]===0));assert.equal(new Set(show.actors.map(a=>a.position[0])).size,4);
for(const a of show.actors){assert.equal(mediaTime(a,7,10),7);assert.equal(actorOpacity(a,10),0);const bytes=readFileSync(resolve(folder,a.model)),info=inspectGLB(bytes,{requireRig:true,requireAnimation:true});assert.equal(info.bones,17);assert.equal(info.animations.length,1);assert.equal(info.animations[0].name,a.clipName);}
const camera={x:0,y:1.5,z:0};assert.match(placementIssue(camera,{x:0,y:0,z:-.3},quartetPlacementPolicy),/가까운/);assert.match(placementIssue(camera,{x:0,y:1.4,z:-4},quartetPlacementPolicy),/바닥/);assert.equal(placementIssue(camera,{x:0,y:0,z:-4},quartetPlacementPolicy),null);assert.ok(placementIssue(camera,{x:0,y:0,z:-20},quartetPlacementPolicy));
const poses=JSON.parse(readFileSync(resolve(folder,'poses.json')));assert.equal(poses.actors.length,4);assert.equal(poses.frames,240);for(const track of poses.actors)assert.equal(track.frames.filter(Boolean).length,240);
const analysis=JSON.parse(readFileSync(resolve(folder,'analysis.json')));assert.equal(analysis.source.fps,24);assert.equal(analysis.source.width,1280);assert.ok(analysis.actors.every(a=>a.cropRecoveries>0));
console.log(JSON.stringify({result:'PASS',fourIndependentlyRiggedGLBs:true,clipsAndOriginalAudioClockAligned:true,groundAnchors:true,closeAndEyeLevelHitsRejected:true,monocularPoseTracks:4,measuredVolumetricCapture:false,phoneARVerified:false},null,2));
