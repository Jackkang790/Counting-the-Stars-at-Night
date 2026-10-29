import { createServer } from 'node:http';
import { randomBytes,randomUUID,timingSafeEqual } from 'node:crypto';
import { createReadStream,existsSync } from 'node:fs';
import { readFile,stat,rm } from 'node:fs/promises';
import { resolve,join,extname,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Store } from './store.mjs';
import { Pipeline,sha } from './pipeline.mjs';
import { uploads } from './upload.mjs';
import { inspectFile } from './glb.mjs';

const ID=/^[a-f0-9-]{36}$/;
const consents=['capture','portrait','digitalReplica','performance'];
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.svg':'image/svg+xml'};
const fail=(message,status=400)=>Object.assign(Error(message),{status});
async function body(req){let text='';for await(const part of req){text+=part;if(text.length>32000)throw fail('요청이 너무 큽니다',413)}return JSON.parse(text||'{}')}
function send(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
async function file(req,res,path,type){const info=await stat(path);let start=0,end=info.size-1,status=200;
  if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m)throw fail('지원하지 않는 Range',416);start=Number(m[1]);end=m[2]?Number(m[2]):end;if(start>end||end>=info.size)throw fail('Range 범위 오류',416);status=206}
  res.writeHead(status,{'Content-Type':type??mime[extname(path)]??'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'no-store',...(status===206?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{})});
  if(req.method==='HEAD')res.end();else createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
}
function publicJob(job){
  const artifact=key=>job[key]?{name:job[key].name,sha256:job[key].sha256,url:`/api/studio/jobs/${job.id}/assets/${key}`}:null;
  return {id:job.id,name:job.name,title:job.title,status:job.status,stage:job.stage,progress:job.progress??0,error:job.error,createdAt:job.createdAt,updatedAt:job.updatedAt,testOnly:job.testOnly,
    files:job.files.map(f=>({id:f.id,name:f.originalName,kind:f.kind,view:f.view,bytes:f.bytes,url:`/api/studio/jobs/${job.id}/files/${f.id}`})),
    model:artifact('model'),rig:artifact('rig'),motion:artifact('motion'),result:artifact('result'),modelInfo:job.modelInfo,rigInfo:job.rigInfo,resultInfo:job.resultInfo,retargetReport:job.retargetReport,
    modelReview:job.modelReview,animationReview:job.animationReview,consents:job.consents,publishedId:job.publishedId,
    tasks:Object.entries(job.tasks??{}).map(([key,value])=>({key,id:value.id,state:value.state,provider:value.provider})),approvals:job.approvals??[]};
}
export function configuration(env=process.env){return {adminToken:env.PERFORMER_ADMIN_TOKEN,folder:resolve(env.PERFORMER_DATA_DIR??'data'),webDist:env.WEB_DIST?resolve(env.WEB_DIST):null,cookieSecure:env.COOKIE_SECURE==='1',tripoKey:env.TRIPO_API_KEY,tripoVersion:env.TRIPO_MODEL_VERSION??'v2.5-20250123',tripoUploadPath:env.TRIPO_UPLOAD_PATH??'/upload/sts',deepID:env.DEEP_MOTION_CLIENT_ID,deepSecret:env.DEEP_MOTION_CLIENT_SECRET,deepURL:env.DEEP_MOTION_BASE_URL,blenderPath:env.BLENDER_PATH,artifactHosts:(env.ARTIFACT_HOSTS??'').split(',').filter(Boolean)}}
export function createApp(config,deps={}){
  if(typeof config.adminToken!=='string'||config.adminToken.length<24)throw Error('PERFORMER_ADMIN_TOKEN에 24자 이상의 관리 암호를 설정하세요');
  const store=new Store(config.folder),pipeline=new Pipeline(store,config,deps),sessions=new Map();let loginFailures=0,resetFailures=Date.now();
  const app=createServer(async(req,res)=>{
    let cleanup;
    try{
      const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname),parts=path.split('/').filter(Boolean);
      if(path==='/api/studio/health'&&req.method==='GET'){send(res,{service:'performer-studio',...pipeline.capabilities()});return}
      if(path==='/api/studio/registry'&&req.method==='GET'){send(res,store.registry());return}
      if(/^\/api\/studio\/published\/[a-f0-9-]{36}\.glb$/.test(path)&&['GET','HEAD'].includes(req.method)){const id=parts[3].slice(0,-4);if(!store.registry().some(a=>a.id===id))throw fail('등록된 공연자가 아닙니다',404);await file(req,res,join(store.folder,'published',id+'.glb'));return}
      if(path.startsWith('/api/studio/')){
        if(!['GET','HEAD'].includes(req.method)&&req.headers['x-studio-request']!=='1')throw fail('동일 출처의 제작 화면에서 요청하세요',403);
        const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)throw fail('다른 출처의 쓰기 요청은 허용하지 않습니다',403);
        if(path==='/api/studio/login'&&req.method==='POST'){
          if(Date.now()-resetFailures>10*60000){loginFailures=0;resetFailures=Date.now()}if(loginFailures>=10)throw fail('로그인 시도 제한. 잠시 후 다시 시도하세요',429);
          const input=await body(req),a=Buffer.from(String(input.token??'')),b=Buffer.from(config.adminToken);
          if(a.length!==b.length||!timingSafeEqual(a,b)){loginFailures++;throw fail('관리 암호가 올바르지 않습니다',401)}
          const session=randomBytes(32).toString('hex');sessions.set(session,Date.now()+8*3600000);res.setHeader('Set-Cookie',`studio_session=${session}; HttpOnly; SameSite=Strict; Path=/api/studio; Max-Age=28800${config.cookieSecure?'; Secure':''}`);send(res,{ok:true});return;
        }
        const session=(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith('studio_session='))?.slice(15);
        if(!session||!sessions.has(session)||sessions.get(session)<Date.now())throw fail('제작자 로그인이 필요합니다',401);
        if(path==='/api/studio/logout'&&req.method==='POST'){sessions.delete(session);res.setHeader('Set-Cookie','studio_session=; HttpOnly; SameSite=Strict; Path=/api/studio; Max-Age=0');send(res,{ok:true});return}
        if(path==='/api/studio/jobs'&&req.method==='GET'){send(res,store.list().map(publicJob));return}
        if(path==='/api/studio/jobs'&&req.method==='POST'){
          const id=randomUUID();cleanup=join(store.folder,id);const {fields,files}=await uploads(req,join(store.folder,id,'input'));let permissions;
          try{permissions=JSON.parse(fields.consents??'{}')}catch{throw fail('동의 항목을 확인하세요')}
          if(consents.some(c=>permissions[c]!==true))throw fail('촬영·초상·디지털 복제·공연 사용 동의가 모두 필요합니다');
          if(!fields.name?.trim()||!fields.title?.trim()||fields.name.length>80||fields.title.length>120)throw fail('공연자 이름(80자 이하)과 공연 제목(120자 이하)을 입력하세요');
          const photos=files.filter(f=>f.kind==='photo');if(photos.length<1||photos.length>8||files.filter(f=>f.kind==='video').length!==1||files.some(f=>!['photo','video'].includes(f.kind)))throw fail('전신 사진 1~8장과 공연 영상 한 개를 입력하세요');
          let views;try{views=JSON.parse(fields.views??'[]')}catch{throw fail('사진 방향 형식 오류')}
          photos.forEach((f,i)=>{f.view=['front','left','back','right','reference'].includes(views[i])?views[i]:i===0?'front':'reference'});
          if(!photos.some(f=>f.view==='front'))throw fail('정면 사진 한 장을 지정하세요');
          const job={id,name:fields.name.trim(),title:fields.title.trim(),files,consents:{...permissions,recordedAt:new Date().toISOString(),version:1},status:'uploaded',createdAt:new Date().toISOString(),tasks:{},testOnly:fields.testOnly==='true'};store.save(job);cleanup=null;store.event(id,'uploaded');send(res,publicJob(job),201);return;
        }
        if(parts[2]==='jobs'&&ID.test(parts[3]??'')){
          const job=store.get(parts[3]);
          if(parts.length===4&&req.method==='GET'){send(res,{...publicJob(job),events:store.events(job.id)});return}
          if(parts[4]==='files'&&ID.test(parts[5]??'')&&req.method==='GET'){const f=job.files.find(f=>f.id===parts[5]);if(!f)throw fail('파일 없음',404);await file(req,res,f.path,f.mime);return}
          if(parts[4]==='assets'&&['model','rig','result','motion'].includes(parts[5])&&['GET','HEAD'].includes(req.method)){const asset=job[parts[5]];if(!asset)throw fail('결과 파일 없음',404);await file(req,res,asset.path);return}
          if(parts[4]==='attachments'&&req.method==='POST'){
            if(['queued','running','published'].includes(job.status))throw fail('진행 중이거나 등록된 작업은 교체할 수 없습니다',409);
            cleanup=join(store.folder,job.id,'attachments',randomUUID());const data=await uploads(req,cleanup);if(data.files.length!==1)throw fail('첨부 파일은 한 번에 하나만 선택하세요');const f=data.files[0];job.files.push(f);
            if(f.kind==='model'){job.modelInfo=await inspectFile(f.path);job.model=f;job.modelTaskID=null;job.modelReview=null;job.result=null;job.rig=job.modelInfo.skins?f:null;job.status='model_review'}
            else if(f.kind==='result'){job.modelInfo=await inspectFile(f.path,{requireRig:true,requireAnimation:true});job.resultInfo=job.modelInfo;job.model=job.rig=job.result=f;job.modelReview=null;job.animationReview=null;job.status='model_review'}
            else if(f.kind==='motion'){if(!job.rig||!job.modelReview?.approved)throw fail('리깅된 모델과 외형 검수를 먼저 완료하세요');job.motion=f;job.stage='retarget';job.status='queued';job.attempt=(job.attempt??0)+1}
            else throw fail('model, result, motion 첨부만 가능합니다');
            if(job.modelInfo?.syntheticCalibration)job.testOnly=true;
            job.error=null;store.save(job);cleanup=null;void pipeline.pump();send(res,publicJob(job));return;
          }
          if(parts[4]==='actions'&&req.method==='POST'){
            const input=await body(req);
            if(input.action==='quote'){send(res,pipeline.plan(job,input.stage));return}
            if(input.action==='approve'){send(res,publicJob(pipeline.approve(job,input.quoteId,input.costAcknowledged)));return}
            if(input.action==='review-model'){
              if(job.status!=='model_review'||!job.model||input.sha256!==job.model.sha256||!['face','body','clothing'].every(k=>input[k]===true))throw fail('현재 모델의 얼굴·신체·의상 검수를 모두 완료하세요');
              job.modelReview={approved:true,sha256:job.model.sha256,at:new Date().toISOString(),face:true,body:true,clothing:true,note:String(input.note??'').slice(0,1000)};job.status=job.result?'animation_review':job.rig?'rig_ready':'model_approved';store.save(job);send(res,publicJob(job));return;
            }
            if(input.action==='review-animation'){
              if(job.status!=='animation_review'||!job.result||input.sha256!==job.result.sha256||!['motion','feet','alignment'].every(k=>input[k]===true))throw fail('현재 결과의 동작·발·공간 크기 검수가 필요합니다');
              job.animationReview={approved:true,sha256:job.result.sha256,at:new Date().toISOString()};job.status='approved';store.save(job);send(res,publicJob(job));return;
            }
            if(input.action==='publish'){send(res,await pipeline.publish(job));return}
            if(input.action==='resume'){
              if(!['failed','needs_reconciliation'].includes(job.status))throw fail('재확인 가능한 작업이 아닙니다');
              const pending=Object.values(job.tasks).some(t=>t.state!=='success'&&!t.id);if(pending)throw fail('제공자 작업 ID를 먼저 연결하세요');
              if(job.stage!=='retarget'&&!Object.values(job.tasks).some(t=>t.id&&t.state!=='failed'))throw fail('재시도에는 새로운 비용 승인이 필요합니다');job.status='queued';job.error=null;store.save(job);void pipeline.pump();send(res,publicJob(job));return;
            }
            if(input.action==='reconcile'){
              if(job.status!=='needs_reconciliation'||!/^[A-Za-z0-9_-]{1,128}$/.test(input.taskId??''))throw fail('연결할 제공자 작업 ID를 확인하세요');
              const entry=Object.values(job.tasks).find(t=>t.state==='submitting'&&!t.id);if(!entry)throw fail('연결할 작업이 없습니다');entry.id=input.taskId;entry.state='polling';job.status='queued';job.error=null;store.save(job);void pipeline.pump();send(res,publicJob(job));return;
            }
            throw fail('지원하지 않는 작업 요청');
          }
        }
        throw fail('API 경로를 찾을 수 없습니다',404);
      }
      if(!config.webDist)throw fail('WEB_DIST에 빌드 폴더를 설정하세요',404);
      if(!['GET','HEAD'].includes(req.method))throw fail('Method not allowed',405);
      let target=resolve(config.webDist,'.'+path);if(!target.startsWith(config.webDist+sep)&&target!==config.webDist)throw fail('잘못된 경로',403);
      if(path==='/'||(!extname(path)&&!existsSync(target)))target=join(config.webDist,'index.html');await file(req,res,target);
    }catch(error){if(cleanup)await rm(cleanup,{recursive:true,force:true}).catch(()=>{});if(res.headersSent){res.destroy();return}send(res,{error:pipeline.safeError(error)},error.status??(error.code==='ENOENT'?404:400))}
  });
  const close=()=>{pipeline.close();store.close()};return {app,store,pipeline,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const service=createApp(configuration());service.app.listen(Number(process.env.PERFORMER_PORT??8091),process.env.PERFORMER_HOST??'127.0.0.1',()=>console.log('Performer studio ready (provider calls require explicit approval)'));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{service.app.close(()=>{service.close();process.exit(0)})});
}
