import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {resolve} from 'node:path';
import ts from '../node_modules/typescript/lib/typescript.js';
const root=resolve(import.meta.dirname,'..');
const source=ts.transpileModule(readFileSync(resolve(root,'src/tracking-lab/metrics.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {TrialMetrics}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const m=new TrialMetrics();m.cameraReady=100;m.engineReady=200;
assert.equal(m.summary().firstRecognitionFromCameraMs,null);m.transition(false,250);assert.equal(m.losses,0);
m.transition(true,300);m.transition(true,400);assert.equal(m.summary().firstRecognitionFromEngineMs,100);
m.beginStationary();for(let i=0;i<20;i++)m.sample([1,2,3],i%2?[0,0,0,-1]:[0,0,0,1],500+i*50);
assert.ok(m.summary().translationRmsMeters<1e-12);assert.equal(m.summary().rotationRmsFromFirstDegrees,0,'q and -q are the same rotation');
m.transition(false,1700);m.transition(false,1800);assert.equal(m.losses,1);assert.equal(m.stationary,false);m.transition(true,2000);assert.deepEqual(m.reacquisitions,[300]);
const scaled=new TrialMetrics();scaled.transition(true,0);scaled.beginStationary();for(let i=0;i<20;i++)scaled.sample([0,0,0],[0,0,0,i%2?.9999999:-1.0000001],100+i*50);assert.equal(scaled.summary().rotationRmsFromFirstDegrees,0,'Float scale is not physical rotation jitter');
const t=JSON.parse(readFileSync(resolve(root,'.assets/tracking-lab/target.json')));
for(const [file,info] of Object.entries(t.files)){const bytes=readFileSync(resolve(root,'.assets/tracking-lab',file));assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256);}
assert.equal(t.width,960);assert.equal(t.height,428);assert.equal(t.modelSha256,createHash('sha256').update(readFileSync(resolve(root,'musical-assets/quartet/performer-01.glb'))).digest('hex'));
console.log(JSON.stringify({result:'PASS',nullMeasurementNotZero:true,lossDebounced:true,quaternionSignInvariant:true,commonTargetAndModelHashes:true,phoneARVerified:false}));
