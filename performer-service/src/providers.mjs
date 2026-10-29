import { readFile } from 'node:fs/promises';
import { transfer } from './network.mjs';

const taskID=value=>{const id=String(value??'');if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('제공자 작업 ID 형식 오류');return id};
async function json(response){if(!response.ok)throw Object.assign(Error(`외부 API 요청 실패 (${response.status})`),{rejected:response.status>=400&&response.status<500});const text=await response.text();if(text.length>1_000_000)throw Error('외부 API 응답이 너무 큽니다');return JSON.parse(text)}
export class Tripo {
  constructor({key,version='v2.5-20250123',fetcher=fetch,uploadPath='/upload/sts'}={}){
    this.key=key;this.version=version;this.fetch=fetcher;
    if(!['/upload','/upload/sts'].includes(uploadPath))throw Error('잘못된 Tripo 업로드 경로');this.uploadPath=uploadPath;
  }
  async request(path,{method='GET',body}={}){
    if(!this.key)throw Error('서버 TRIPO_API_KEY가 설정되지 않았습니다');
    const data=await json(await this.fetch('https://api.tripo3d.ai/v2/openapi'+path,{method,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,
      headers:{Authorization:`Bearer ${this.key}`,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(90000),redirect:'error'}));
    if(data.code!==0)throw Object.assign(Error(`Tripo 작업 오류 (${data.code})`),{rejected:true});return data.data;
  }
  async image(file){const bytes=await readFile(file.path);if(bytes.length>10*1024*1024)throw Error('Tripo 전송 사진은 장당 10MiB 이하로 줄여 주세요');const form=new FormData();form.append('file',new Blob([bytes],{type:file.mime}),file.originalName);const data=await this.request(this.uploadPath,{method:'POST',body:form});if(!data?.image_token)throw Error('Tripo 업로드 토큰 누락');return {type:file.mime==='image/png'?'png':file.mime==='image/webp'?'webp':'jpg',file_token:data.image_token}}
  async generation(files){
    const chosen=new Map();for(const file of files)if(['front','left','back','right'].includes(file.view)&&!chosen.has(file.view))chosen.set(file.view,file);
    const front=chosen.get('front')??files[0];if(!front)throw Error('정면 사진이 필요합니다');
    const tokens=new Map();for(const [view,file] of chosen)tokens.set(view,await this.image(file));
    if(!tokens.has('front'))tokens.set('front',await this.image(front));
    const common={model_version:this.version,texture:true,pbr:true,texture_quality:'standard',face_limit:30000};
    return tokens.size>=2?{...common,type:'multiview_to_model',files:['front','left','back','right'].map(v=>tokens.get(v)??{type:'jpg'})}:{...common,type:'image_to_model',file:tokens.get('front')};
  }
  async create(payload){return taskID((await this.request('/task',{method:'POST',body:payload})).task_id)}
  async poll(id){const data=await this.request('/task/'+taskID(id));return {status:data.status==='success'?'success':['queued','running'].includes(data.status)?'running':'failed',progress:Number(data.progress)||0,result:data.output??{},credits:data.consumed_credit??null}}
  output(result){const value=result.pbr_model??result.model??result.base_model;if(typeof value!=='string')throw Error('Tripo GLB 결과 URL이 없습니다');return value}
}

export class DeepMotion {
  constructor({clientID,secret,baseURL,fetcher=fetch,io=transfer}={}){
    this.clientID=clientID;this.secret=secret;this.fetch=fetcher;this.io=io;this.cookie=null;
    if(baseURL){const url=new URL(baseURL);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('DeepMotion이 제공한 HTTPS 기본 주소를 설정하세요');this.base=url.href.replace(/\/$/,'')}
  }
  async session(){
    if(this.cookie)return;
    if(!this.base||!this.clientID||!this.secret)throw Error('DeepMotion API 권한·주소가 없습니다. 모션 파일 입력을 사용하세요');
    const response=await this.fetch(this.base+'/session/auth',{headers:{Authorization:'Basic '+Buffer.from(this.clientID+':'+this.secret).toString('base64')},signal:AbortSignal.timeout(30000),redirect:'error'});
    if(!response.ok)throw Error(`DeepMotion 인증 실패 (${response.status})`);
    const cookies=response.headers.getSetCookie?.()??[response.headers.get('set-cookie')??''];
    const value=cookies.map(c=>c.split(';')[0]).find(c=>c.startsWith('dmsess='));if(!value)throw Error('DeepMotion 세션 쿠키 누락');this.cookie=value;
  }
  async request(path,{method='GET',body}={}){
    await this.session();const response=await this.fetch(this.base+path,{method,body:body?JSON.stringify(body):undefined,headers:{Cookie:this.cookie,...(body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(60000),redirect:'error'});
    if(response.status===401){this.cookie=null;throw Error('DeepMotion 세션이 만료되었습니다. 작업 ID로 상태를 재확인하세요')}
    return json(response);
  }
  async upload(file){const data=await this.request('/upload?'+new URLSearchParams({name:file.originalName,resumable:'0'}));if(!data.url)throw Error('DeepMotion 업로드 주소 누락');await this.io(data.url,{method:'PUT',body:await readFile(file.path),headers:{'Content-Type':file.mime}});return data.url}
  async create(videoURL){const data=await this.request('/process',{method:'POST',body:{url:videoURL,processor:'video2anim',params:['config=configDefault','formats=bvh,fbx','footLockingMode=auto','rootAtOrigin=true','poseFilteringStrength=0.3','trackHand=0','trackFace=0']}});return taskID(data.rid)}
  async poll(id){const data=await this.request('/status/'+taskID(id)),row=data.status?.find(r=>String(r.rid)===String(id));if(!row)throw Error('DeepMotion 작업 상태 누락');return {status:row.status==='SUCCESS'?'success':['PROGRESS','RETRY','STARTING'].includes(row.status)?'running':'failed',progress:row.details?.total?100*row.details.step/row.details.total:0,result:{}}}
  async output(id){const data=await this.request('/download/'+taskID(id)),row=data.links?.find(r=>String(r.rid)===String(id));for(const kind of ['bvh','fbx','glb'])for(const item of row?.urls??[])for(const file of item.files??[])if(file[kind])return {url:file[kind],kind};throw Error('DeepMotion 모션 결과 파일이 없습니다')}
}
