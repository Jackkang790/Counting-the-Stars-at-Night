import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {Store} from '../src/store.mjs';
import {Pipeline,sha} from '../src/pipeline.mjs';
import {Tripo,DeepMotion} from '../src/providers.mjs';
import {inspectFile,inspectGLB} from '../src/glb.mjs';
import {privateAddress,trustedArtifact} from '../src/network.mjs';
const root=resolve(import.meta.dirname,'../..'),fixture=join(root,'ar-engine/musical-assets/test-actor-animated.glb');
const rig=resolve(import.meta.dirname,'fixtures/test-actor-rig.glb');
const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('wait timeout')};
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});

test('real GLBs distinguish rig-only, animated, synthetic and invalid external resources',async()=>{
  assert.equal((await inspectFile(rig,{requireRig:true})).skins,1);await assert.rejects(inspectFile(rig,{requireAnimation:true}));
  const info=await inspectFile(fixture,{requireRig:true,requireAnimation:true});assert.equal(info.syntheticCalibration,true);assert.equal(info.bones,17);
  assert.throws(()=>inspectGLB(Buffer.from('not GLB')));
  const original=await readFile(fixture),length=original.readUInt32LE(12),json=JSON.parse(original.subarray(20,20+length));json.buffers[0].uri='https://internal.example/secret';
  let text=JSON.stringify(json);text+=' '.repeat((4-text.length%4)%4);const bytes=Buffer.concat([original.subarray(0,20),Buffer.from(text),original.subarray(20+length)]);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(Buffer.byteLength(text),12);assert.throws(()=>inspectGLB(bytes),/내장/);
  const flat=Buffer.from(original),doc=JSON.parse(original.subarray(20,20+length));
  for(const animation of doc.animations)for(const sampler of animation.samplers){const a=doc.accessors[sampler.output],v=doc.bufferViews[a.bufferView],size={VEC3:3,VEC4:4,SCALAR:1}[a.type],stride=v.byteStride??size*4,start=28+length+(v.byteOffset??0)+(a.byteOffset??0);for(let i=1;i<a.count;i++)for(let k=0;k<size;k++)flat.writeFloatLE(flat.readFloatLE(start+k*4),start+i*stride+k*4);}
  assert.throws(()=>inspectGLB(flat,{requireRig:true,requireAnimation:true}),/실제로 변하는/);
});
test('Tripo adapter: documented multipart token and four ordered multiview slots; no live calls',async()=>{
  const calls=[];const api=new Tripo({key:'private-api-key',fetcher:async(url,options)=>{calls.push({url,options});return response({code:0,data:url.endsWith('/upload/sts')?{image_token:'token-'+calls.length}:{task_id:'task-1'}});}});
  const file={path:rig,mime:'image/png',originalName:'test.png'};
  const payload=await api.generation([{...file,view:'front'},{...file,view:'back'},{...file,view:'reference'}]);
  assert.equal(calls.length,2);assert.equal(payload.type,'multiview_to_model');assert.equal(payload.files.length,4);assert.ok(payload.files[0].file_token);assert.equal(payload.files[1].file_token,undefined);assert.ok(payload.files[2].file_token);
  assert.equal(await api.create(payload),'task-1');assert.equal(calls[0].options.headers.Authorization,'Bearer private-api-key');assert.ok(calls[0].options.body instanceof FormData);
  await assert.rejects(new Tripo().create({}),/TRIPO_API_KEY/);
});
test('DeepMotion adapter: Basic auth to cookie, signed PUT, process/status/download contracts (mock only)',async()=>{
  const calls=[],puts=[];const api=new DeepMotion({clientID:'id',secret:'secret',baseURL:'https://vendor.example',io:async(...args)=>puts.push(args),fetcher:async(url,options)=>{
    calls.push({url,options});if(url.endsWith('/session/auth'))return new Response('',{headers:{'set-cookie':'dmsess=mock; HttpOnly; Path=/'}});
    if(url.includes('/upload?'))return response({url:'https://storage.googleapis.com/example/signed'});
    if(url.endsWith('/process'))return response({rid:'123'});
    if(url.includes('/status/'))return response({status:[{rid:123,status:'SUCCESS',details:{step:3,total:3}}]});
    return response({links:[{rid:123,urls:[{files:[{bvh:'https://storage.googleapis.com/example/motion.bvh'}]}]}]});
  }});
  const url=await api.upload({path:rig,originalName:'dance.mp4',mime:'video/mp4'});assert.equal(puts[0][1].method,'PUT');assert.equal(await api.create(url),'123');assert.equal((await api.poll('123')).status,'success');assert.equal((await api.output('123')).kind,'bvh');
  assert.match(calls[0].options.headers.Authorization,/Basic /);assert.equal(calls[1].options.headers.Cookie,'dmsess=mock');assert.equal(calls[2].options.headers.Authorization,undefined);await assert.rejects(new DeepMotion().session(),/권한/);
});
test('artifact network blocks private and unapproved addresses without fetching',async()=>{
  for(const address of ['127.0.0.1','10.1.2.3','172.16.1.1','192.168.1.1','::1','::ffff:127.0.0.1'])assert.equal(privateAddress(address),true);
  assert.equal(privateAddress('8.8.8.8'),false);await assert.rejects(trustedArtifact('http://storage.googleapis.com/x'),/HTTPS/);await assert.rejects(trustedArtifact('https://attacker.example/x'),/허용/);
});
test('persistent lease and ambiguous submission recovery prevent automatic duplicate billing',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'performer-store-'));let store=new Store(folder);
  try{assert.throws(()=>new Store(folder),/lease/);store.save({id:'a',status:'running',tasks:{a:{state:'submitting'}}});store.close();store=new Store(folder);assert.equal(store.get('a').status,'needs_reconciliation');store.save({id:'b',status:'running',tasks:{b:{state:'running',id:'existing-id'}}});store.close();store=new Store(folder);assert.equal(store.get('b').status,'queued');}finally{store.close();await rm(folder,{recursive:true,force:true});}
});
test('cost gate, single-use approval and ambiguous provider timeout never resubmit',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'performer-cost-')),store=new Store(folder);let posts=0;
  const pipeline=new Pipeline(store,{tripoKey:'test-key',adminToken:'test-private-token'},{tripo:{generation:async()=>({}),create:async()=>{posts++;throw Error('network timeout')},poll:async()=>{throw Error('unexpected')}}});
  try{const job=store.save({id:randomUUID(),status:'uploaded',files:[],tasks:{}});await pipeline.pump();assert.equal(posts,0);const q=pipeline.plan(job,'generate');assert.equal(q.estimatedCredits,null);assert.throws(()=>pipeline.approve(job,q.id,false));pipeline.approve(job,q.id,true);assert.throws(()=>pipeline.approve(job,q.id,true));await wait(()=>!pipeline.busy);assert.equal(posts,1);assert.equal(store.get(job.id).status,'needs_reconciliation');await pipeline.pump();assert.equal(posts,1);assert.equal(pipeline.safeError(Error('test-key test-private-token https://s3.example/signed?secret=abc')),'[redacted] [redacted] [provider URL]');}finally{pipeline.close();store.close();await rm(folder,{recursive:true,force:true});}
});
test('HTTP: protected upload, consent gate, local GLB review and publish with private originals',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'performer-http-')),service=createApp({folder,adminToken:'test-admin-password-at-least-24'});
  await new Promise(r=>service.app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+service.app.address().port;let cookie;
  const request=async(path,body,method)=>{const r=await fetch(base+'/api/studio/'+path,{method:method??(body?'POST':'GET'),headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'X-Studio-Request':'1',...(body instanceof FormData?{}:{'Content-Type':'application/json'})}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
  const data=async(consent=true)=>{const form=new FormData();form.append('name','테스트 배우');form.append('title','30초 테스트');form.append('consents',JSON.stringify({capture:consent,portrait:true,digitalReplica:true,performance:true}));form.append('photo',new Blob([Buffer.from([137,80,78,71,13,10,26,10,1])],{type:'image/png'}),'photo.png');form.append('video',new Blob([await readFile(join(root,'ar-engine/musical-assets/actor-a-demo.mp4'))],{type:'video/mp4'}),'dance.mp4');return form;};
  try{
    assert.equal((await request('jobs')).status,401);const login=await fetch(base+'/api/studio/login',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Request':'1'},body:JSON.stringify({token:'test-admin-password-at-least-24'})});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    assert.equal((await request('jobs',await data(false))).status,400);assert.equal((await request('jobs')).data.length,0);
    const created=await request('jobs',await data());assert.equal(created.status,201);const id=created.data.id;
    const action=body=>request(`jobs/${id}/actions`,body);assert.equal((await action({action:'publish'})).status,400);assert.equal((await action({action:'quote',stage:'generate'})).status,400);
    const attachment=new FormData();attachment.append('result',new Blob([await readFile(fixture)]),'performer.glb');const attached=await request(`jobs/${id}/attachments`,attachment);assert.equal(attached.status,200);assert.equal(attached.data.testOnly,true);assert.ok(!JSON.stringify(attached.data).includes(folder));
    let job=attached.data;assert.equal((await action({action:'review-model',sha256:'wrong',face:true,body:true,clothing:true})).status,400);
    job=(await action({action:'review-model',sha256:job.model.sha256,face:true,body:true,clothing:true})).data;assert.equal(job.status,'animation_review');
    job=(await action({action:'review-animation',sha256:job.result.sha256,motion:true,feet:true,alignment:true})).data;assert.equal(job.status,'approved');const published=await action({action:'publish'});assert.equal(published.data.contentKind,'synthetic-calibration');
    assert.equal((await fetch(base+published.data.url)).status,200);assert.equal((await fetch(base+job.files[0].url)).status,401);assert.equal((await request('registry')).data.length,1);
    const badOrigin=await fetch(base+'/api/studio/logout',{method:'POST',headers:{Cookie:cookie,'X-Studio-Request':'1',Origin:'https://evil.example'}});assert.equal(badOrigin.status,403);
  }finally{await new Promise(r=>service.app.close(r));service.close();await rm(folder,{recursive:true,force:true});}
});
test('local retarget stage validates actual baked animated GLB, requires review before publication',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'performer-local-')),store=new Store(folder),result=resolve(import.meta.dirname,'fixtures/retargeted.glb');
  const pipeline=new Pipeline(store,{}, {local:async job=>{const path=join(folder,job.id,'artifacts','performance.glb');await copyFile(result,path);return {path,name:'performance.glb',sha256:sha(await readFile(path))};}});
  try{const job=store.save({id:randomUUID(),name:'test',title:'test',status:'queued',stage:'retarget',rig:{path:rig},motion:{path:fixture},tasks:{},modelReview:{approved:true},testOnly:true});await pipeline.pump();assert.equal(store.get(job.id).status,'animation_review');await assert.rejects(pipeline.publish(store.get(job.id)),/검수/);}finally{pipeline.close();store.close();await rm(folder,{recursive:true,force:true});}
});
