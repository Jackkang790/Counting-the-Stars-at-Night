import { randomUUID,createHash } from 'node:crypto';
import { mkdir,readFile,copyFile,stat } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { spawn } from 'node:child_process';
import { inspectFile } from './glb.mjs';
import { Tripo,DeepMotion } from './providers.mjs';
import { transfer } from './network.mjs';

export const STAGES=['generate','rig','motion'];
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export class Ambiguous extends Error {}
export class Pipeline {
  constructor(store,config={},deps={}){
    this.store=store;this.config=config;this.tripo=deps.tripo??new Tripo({key:config.tripoKey,version:config.tripoVersion,uploadPath:config.tripoUploadPath});
    this.deep=deps.deep??new DeepMotion({clientID:config.deepID,secret:config.deepSecret,baseURL:config.deepURL});
    this.transfer=deps.transfer??transfer;this.local=deps.local??((job)=>this.blender(job));this.busy=false;this.closed=false;this.timer=setInterval(()=>this.pump(),1000);this.timer.unref();
  }
  capabilities(){return {tripo:!!this.config.tripoKey,deepMotion:!!(this.config.deepID&&this.config.deepSecret&&this.config.deepURL),localRetarget:!!this.config.blenderPath,liveCallsVerified:false}}
  plan(job,stage){
    if(!STAGES.includes(stage))throw Error('알 수 없는 생성 단계');
    const allowed=stage==='generate'?['uploaded','failed']:stage==='rig'?['model_approved','failed']:['rig_ready','awaiting_motion_file','failed'];
    if(!allowed.includes(job.status))throw Error('현재 상태에서는 이 단계를 승인할 수 없습니다');
    if(stage!=='generate'&&!job.modelReview?.approved)throw Error('얼굴·신체·의상 검수가 필요합니다');
    if(stage==='motion'&&!job.rig)throw Error('리깅 모델이 필요합니다');
    if(stage==='rig'&&!job.modelTaskID)throw Error('Tripo 생성 작업 ID가 없는 로컬 모델은 리깅된 GLB로 입력하세요');
    if(!this.capabilities()[stage==='motion'?'deepMotion':'tripo'])throw Error(stage==='motion'?'DeepMotion API 권한이 없습니다. BVH/FBX/GLB 입력을 사용하세요':'서버 Tripo API 키가 없습니다. 모델 파일 입력으로 시험할 수 있습니다');
    const operations=stage==='generate'?['image_to_model 또는 multiview_to_model']:stage==='rig'?['animate_prerigcheck','animate_rig']:['video2anim'];
    const quote={id:randomUUID(),stage,expiresAt:Date.now()+5*60000,operations,provider:stage==='motion'?'DeepMotion':'Tripo',modelVersion:this.config.tripoVersion??'v2.5-20250123',estimatedCredits:null,
      pricing:'요금은 제공자 계정·옵션에 따라 달라집니다. 제공자 콘솔에서 요금을 확인한 뒤 승인하세요. 이 승인은 위 작업만 포함합니다.'};
    job.quote=quote;this.store.save(job);return quote;
  }
  approve(job,id,ack){
    const q=job.quote;if(!q||q.id!==id||q.expiresAt<Date.now()||ack!==true)throw Error('유효한 비용 승인과 요금 확인 동의가 필요합니다');
    job.stage=q.stage;job.status='queued';job.attempt=(job.attempt??0)+1;job.error=null;job.quote=null;job.progress=0;
    job.approvals??=[];job.approvals.push({...q,approvedAt:new Date().toISOString()});this.store.save(job);this.store.event(job.id,'cost_approved',{stage:q.stage,attempt:job.attempt});
    void this.pump();return job;
  }
  async task(job,key,provider,create){
    key=`${job.stage}:${job.attempt}:${key}`;job.tasks??={};let task=job.tasks[key];
    if(!task){task=job.tasks[key]={state:'submitting',provider:provider===this.tripo?'tripo':'deepmotion'};this.store.save(job);
      try{task.id=await create();task.state='polling';this.store.save(job);this.store.event(job.id,'provider_task',{key,id:task.id})}
      catch(e){if(e.rejected){task.state='failed';this.store.save(job);throw e}throw new Ambiguous('외부 작업 제출 결과를 확인할 수 없습니다. 제공자 콘솔에서 작업 ID를 확인한 뒤 연결하세요. 자동 재결제하지 않습니다.')}
    }
    if(!task.id)throw new Ambiguous('제출 중인 외부 작업의 ID를 확인해야 합니다');
    if(task.state==='success')return task.result;
    const deadline=Date.now()+30*60000;
    while(!this.closed&&Date.now()<deadline){
      const state=await provider.poll(task.id);job.progress=Math.max(0,Math.min(95,state.progress));task.state=state.status;this.store.save(job);
      if(state.status==='failed')throw Error(`제공자 작업 실패: ${task.id}`);
      if(state.status==='success'){task.result=state.result;task.credits=state.credits??null;this.store.save(job);return task.result}
      await new Promise(r=>setTimeout(r,this.config.pollMs??3000));
    }
    throw Error('외부 작업 대기 시간 초과. 동일 작업 ID로 재확인할 수 있습니다');
  }
  async pump(){
    if(this.busy||this.closed)return;const job=this.store.list().reverse().find(j=>j.status==='queued');if(!job)return;
    this.busy=true;job.status='running';this.store.save(job);
    try{
      await mkdir(join(this.store.folder,job.id,'artifacts'),{recursive:true});
      if(job.stage==='generate'){
        // Source images are sent only after the explicit paid-stage approval.
        const existing=job.tasks?.[`generate:${job.attempt}:model`];const payload=existing?null:await this.tripo.generation(job.files.filter(f=>f.kind==='photo'));
        const result=await this.task(job,'model',this.tripo,()=>this.tripo.create(payload));
        job.model=await this.artifact(job,this.tripo.output(result),`generated-${job.attempt}.glb`);job.modelInfo=await inspectFile(job.model.path);job.modelTaskID=job.tasks[`generate:${job.attempt}:model`].id;job.status='model_review';job.modelReview=null;job.rig=null;job.result=null;job.animationReview=null;
      }else if(job.stage==='rig'){
        const original=job.modelTaskID;
        if(!original)throw Error('Tripo 생성 작업 ID가 필요합니다. 로컬 모델은 리깅된 GLB로 입력하세요');
        const check=await this.task(job,'rigcheck',this.tripo,()=>this.tripo.create({type:'animate_prerigcheck',original_model_task_id:original}));
        job.rigCheck=check;if(check.riggable!==true)throw Error('Tripo에서 리깅 가능한 모델로 확인되지 않았습니다');
        const result=await this.task(job,'rig',this.tripo,()=>this.tripo.create({type:'animate_rig',original_model_task_id:original,model_version:'v2.0-20250506',out_format:'glb',rig_type:'biped',spec:'tripo'}));
        job.rig=await this.artifact(job,this.tripo.output(result),`rigged-${job.attempt}.glb`);job.rigInfo=await inspectFile(job.rig.path,{requireRig:true});job.status='rig_ready';
      }else if(job.stage==='motion'){
        const video=job.files.find(f=>f.kind==='video');if(!video)throw Error('공연 영상이 필요합니다');
        const videoURL=job.tasks?.[`motion:${job.attempt}:motion`]?null:await this.deep.upload(video);
        await this.task(job,'motion',this.deep,()=>this.deep.create(videoURL));
        const task=job.tasks[`motion:${job.attempt}:motion`],result=await this.deep.output(task.id);
        job.motion=await this.artifact(job,result.url,`motion-${job.attempt}.${result.kind}`);job.stage='retarget';this.store.save(job);await this.finishLocal(job);
      }else if(job.stage==='retarget'){await this.finishLocal(job)}else throw Error('처리할 작업 단계가 없습니다');
      job.progress=100;this.store.save(job);this.store.event(job.id,'stage_finished',{stage:job.stage,status:job.status});
    }catch(error){if(!this.closed){job.status=error instanceof Ambiguous?'needs_reconciliation':'failed';job.error=this.safeError(error);this.store.save(job);this.store.event(job.id,'error',{stage:job.stage,message:job.error})}}
    finally{this.busy=false}
  }
  safeError(error){let text=String(error.message??error).slice(0,1200);for(const secret of [this.config.tripoKey,this.config.deepID,this.config.deepSecret,this.config.adminToken].filter(Boolean))text=text.replaceAll(secret,'[redacted]');return text.replace(/https?:\/\/[^\s'"<>]+/g,'[provider URL]').replaceAll(this.store.folder,'[private data]')}
  async artifact(job,url,name){const path=join(this.store.folder,job.id,'artifacts',name);await this.transfer(url,{destination:path,hosts:this.config.artifactHosts??[]});return {path,name,sha256:sha(await readFile(path))}}
  async finishLocal(job){if(!job.rig||!job.motion)throw Error('리깅 모델과 모션 파일이 필요합니다');job.result=await this.local(job);job.resultInfo=await inspectFile(job.result.path,{requireRig:true,requireAnimation:true});job.status='animation_review';job.animationReview=null}
  async blender(job){
    if(!this.config.blenderPath)throw Error('서버 BLENDER_PATH를 설정하거나 애니메이션이 포함된 GLB 결과를 입력하세요');
    const output=join(this.store.folder,job.id,'artifacts',`performance-${job.attempt??0}.glb`),report=output+'.json';
    const script=resolve(import.meta.dirname,'../blender/retarget.py');
    await new Promise((done,reject)=>{
      const child=spawn(this.config.blenderPath,['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',script,'--','--model',job.rig.path,'--motion',job.motion.path,'--output',output,'--report',report],{stdio:['ignore','ignore','pipe'],windowsHide:true});let tail='';
      const timer=setTimeout(()=>{child.kill();reject(Error('리타기팅 시간 제한 초과'))},5*60000);
      child.stderr.on('data',chunk=>{tail=(tail+chunk).slice(-1200)});child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('exit',code=>{clearTimeout(timer);code===0?done():reject(Error('Blender 리타기팅 실패: '+tail))});
    });
    job.retargetReport=JSON.parse(await readFile(report,'utf8'));return {path:output,name:'performance.glb',sha256:sha(await readFile(output))};
  }
  async publish(job){
    if(job.status!=='approved'||!job.animationReview?.approved||!job.modelReview?.approved||!job.result)throw Error('외형·동작 검수를 모두 승인한 결과만 공연에 등록할 수 있습니다');
    await inspectFile(job.result.path,{requireRig:true,requireAnimation:true});
    const id=randomUUID(),dir=join(this.store.folder,'published');await mkdir(dir,{recursive:true});await copyFile(job.result.path,join(dir,id+'.glb'));
    const actor={id,name:job.name,title:job.title,url:`/api/studio/published/${id}.glb`,sha256:job.result.sha256,representation:'rigged-glb',contentKind:job.testOnly?'synthetic-calibration':'generated-human',consentRecorded:true,reviewedAt:new Date().toISOString(),sourceJob:job.id};
    this.store.publish(actor);job.publishedId=id;job.status='published';this.store.save(job);return actor;
  }
  close(){this.closed=true;clearInterval(this.timer)}
}
