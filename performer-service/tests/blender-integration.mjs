import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/store.mjs';
import {Pipeline} from '../src/pipeline.mjs';
const blenderPath=process.env.BLENDER_PATH??process.argv[2];if(!blenderPath)throw Error('Pass BLENDER_PATH or the Blender executable as an argument');
const root=resolve(import.meta.dirname,'../..'),folder=await mkdtemp(join(tmpdir(),'performer-real-blender-')),store=new Store(folder),pipeline=new Pipeline(store,{blenderPath});
try{
  const id=randomUUID();store.save({id,status:'queued',stage:'retarget',name:'Owned synthetic calibration',testOnly:true,rig:{path:join(root,'performer-service/tests/fixtures/test-actor-rig.glb')},motion:{path:join(root,'ar-engine/musical-assets/test-actor-animated.glb')},modelReview:{approved:true},tasks:{}});
  await pipeline.pump();const job=store.get(id);assert.equal(job.status,'animation_review',job.error);assert.equal(job.resultInfo.skins,1);assert.equal(job.resultInfo.animations.length,1);assert.equal(job.resultInfo.syntheticCalibration,true);assert.equal(job.retargetReport.frames,720);assert.equal(Object.keys(job.retargetReport.boneMap).length,17);
  const out=join(root,'ar-engine/reports/performer-pipeline');await mkdir(out,{recursive:true});await writeFile(join(out,'blender.json'),JSON.stringify({result:'PASS',actualBlenderProcess:true,animatedGLBValidated:true,needsManualReview:true,syntheticCalibration:true,liveAPICalls:0,...job.retargetReport},null,2));console.log('PASS: actual server worker → Blender → rigged animated GLB → manual animation review');
}finally{pipeline.close();store.close();await rm(folder,{recursive:true,force:true});}
