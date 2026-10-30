import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from '../node_modules/typescript/lib/typescript.js';
import {inspectGLB} from '../../performer-service/src/glb.mjs';
const root=resolve(import.meta.dirname,'..'),folder=resolve(root,'musical-assets/quartet');
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(resolve(root,path),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText).toString('base64'));
const {validateShow,mediaTime,actorOpacity}=await load('src/musical/timeline.ts'),{placementIssue,quartetPlacementPolicy,floorStageScale}=await load('src/musical/placementPolicy.ts');
const show=validateShow(JSON.parse(readFileSync(resolve(folder,'show.json'))));assert.equal(show.duration,10);assert.equal(show.actors.length,4);assert.ok(show.actors.every(a=>a.anchor==='stage'&&a.position[1]===0));assert.equal(new Set(show.actors.map(a=>a.position[0])).size,4);
for(const a of show.actors){assert.equal(mediaTime(a,7,10),7);assert.equal(actorOpacity(a,10),0);const bytes=readFileSync(resolve(folder,a.model)),info=inspectGLB(bytes,{requireRig:true,requireAnimation:true});assert.equal(info.bones,17);assert.equal(info.animations.length,1);assert.equal(info.animations[0].name,a.clipName);}
const camera={x:0,y:1.5,z:0};for(const y of [0,1.48,1.5,2])assert.equal(placementIssue(camera,{x:0,y,z:-4},quartetPlacementPolicy),null);assert.ok(placementIssue(camera,{x:0,y:1.48,z:-4},{...quartetPlacementPolicy,requireGround:true}));for(const z of [0,.1,.3,.5,.8,1.5,4])assert.equal(placementIssue(camera,{x:0,y:0,z:-z},quartetPlacementPolicy),null);assert.ok(placementIssue(camera,{x:0,y:0,z:-20},quartetPlacementPolicy));assert.ok(placementIssue(camera,{x:NaN,y:0,z:-1},quartetPlacementPolicy));
assert.ok(floorStageScale(.5,2,3.8)<floorStageScale(2,2,3.8));assert.equal(floorStageScale(10,1,3.8),1);assert.equal(floorStageScale(.5,2),1);assert.ok(Number.isFinite(floorStageScale(.5,NaN,3.8)));
const poses=JSON.parse(readFileSync(resolve(folder,'poses.json')));assert.equal(poses.actors.length,4);assert.equal(poses.frames,240);for(const track of poses.actors)assert.equal(track.frames.filter(Boolean).length,240);
const analysis=JSON.parse(readFileSync(resolve(folder,'analysis.json')));assert.equal(analysis.source.fps,24);assert.equal(analysis.source.width,1280);assert.ok(analysis.actors.every(a=>a.cropRecoveries>0));
console.log(JSON.stringify({result:'PASS',fourIndependentlyRiggedGLBs:true,clipsAndOriginalAudioClockAligned:true,worldAnchors:true,nearbyPointsAccepted:true,elevatedPointsAccepted:true,legacyGroundPolicyPreserved:true,nearStagesFitView:true,invalidHitsRejected:true,monocularPoseTracks:4,measuredVolumetricCapture:false,phoneARVerified:false},null,2));
