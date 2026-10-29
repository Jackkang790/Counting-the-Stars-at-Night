import { ModelPreview } from "./preview";
import "./style.css";

type Asset={url:string;sha256:string};
type Job={id:string;name:string;title:string;status:string;stage?:string;progress:number;error?:string;testOnly?:boolean;model?:Asset;rig?:Asset;result?:Asset;publishedId?:string;tasks:{key:string;id?:string;state:string}[];events?:unknown[];retargetReport?:unknown};
const labels:Record<string,string>={uploaded:"업로드 완료",queued:"작업 대기",running:"처리 중",model_review:"외형 검수 필요",model_approved:"외형 승인 완료",rig_ready:"리깅 완료 · 모션 입력 가능",animation_review:"동작 검수 필요",approved:"공연 등록 가능",published:"공연 등록 완료",failed:"실패 · 재시도 가능",needs_reconciliation:"제공자 작업 ID 확인 필요"};
export function mountStudio():void{
  document.body.className="studio-body";document.title="지역 공연자 제작실";
  document.body.innerHTML=`<main id="studio"><header><a href="?musical=1">← AR 무대</a><span>LOCAL ARTISTS / 3D STUDIO</span><h1>당신의 공연을, 공간 속으로.</h1><p>사진과 춤 영상을 등록하고 외형과 동작을 검수해 AR 무대에 올립니다.</p></header>
  <p id="studio-message" role="status">서버 연결 확인 중…</p><p id="studio-error" role="alert" hidden></p>
  <section id="studio-login"><h2>제작실 로그인</h2><form id="login-form"><label>서버에 설정한 제작실 암호<input id="token" type="password" required autocomplete="current-password" /></label><button>로그인</button></form><p>API 키는 이 화면에 입력하지 않습니다. 서버 환경변수로 설정하세요.</p></section>
  <div id="studio-workspace" hidden><section><h2>01 / 공연자 등록</h2><form id="upload-form">
  <div class="studio-columns"><label>공연자 이름<input name="name" maxlength="80" required /></label><label>공연 제목<input name="title" maxlength="120" required /></label></div>
  <label>전신 사진 1~8장 · JPEG / PNG / WebP (장당 20MiB)<input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required /></label><div id="photo-views"></div>
  <p>정면을 필수로 지정하세요. 다중 시점 생성에는 정면·왼쪽·뒤·오른쪽에서 각 한 장을 사용하며 추가 사진은 참고 자료로 보관합니다.</p>
  <label>공연 영상 1개 · MP4 / WebM (200MiB 이하)<input id="video" type="file" accept="video/mp4,video/webm" required /></label>
  <fieldset><legend>공연자 또는 적법한 권한 보유자의 동의</legend>${[["capture","촬영 및 파일 업로드"],["portrait","초상·얼굴·신체 정보 처리"],["digitalReplica","AI 처리 및 디지털 복제 생성"],["performance","AR 공연 및 공개 등록 사용"]].map(([id,text])=>`<label><input type="checkbox" data-consent="${id}" required />${text}에 동의합니다</label>`).join("")}</fieldset>
  <p>유료 생성 승인 시 사진은 Tripo로, 모션 추출 승인 시 영상은 DeepMotion으로 전송됩니다. 생성 인물은 볼류메트릭 촬영본이 아니며 실제 얼굴·신체를 정확히 재현하지 못할 수 있습니다.</p>
  <button>자료 업로드</button><progress id="upload-progress" max="100" value="0"></progress></form></section>
  <section><div class="studio-columns"><h2>02 / 생성과 검수</h2><button id="refresh">작업 목록 새로고침</button></div><label>작업 선택<select id="jobs"></select></label><p id="job-status"></p><progress id="job-progress" max="100" value="0"></progress><div id="preview"></div><p>드래그: 회전 · 두 손가락/휠: 확대. 얼굴·체형·의상과 발 미끄러짐을 확인하세요. 실제 AR 정합은 스마트폰에서 별도로 확인해야 합니다.</p><div id="job-actions"></div><details><summary>처리 기록·리타기팅 결과</summary><pre id="job-log"></pre></details></section></div>
  <dialog id="cost-dialog"><form method="dialog"><h2>외부 서비스 비용 승인</h2><pre id="cost-details"></pre><label><input id="cost-ack" type="checkbox" required />제공자 콘솔에서 요금을 확인했으며 이 작업의 비용과 자료 전송을 승인합니다.</label><button value="cancel" formnovalidate>취소</button><button value="approve">승인 후 실행</button></form></dialog></main>`;
  const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
  const error=(e:unknown)=>{$("studio-error").hidden=false;$("studio-error").textContent=e instanceof Error?e.message:String(e);};
  const run=(fn:()=>Promise<void>)=>{ $("studio-error").hidden=true;void fn().catch(error); };
  async function api(path:string,body?:unknown):Promise<any>{const r=await fetch("/api/studio/"+path,{...(body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json","X-Studio-Request":"1"},body:JSON.stringify(body)})});const data=await r.json().catch(()=>({error:"제작 API 서버 연결이 필요합니다"}));if(!r.ok||data.error)throw new Error(data.error??"서버 요청 실패");return data;}
  let selected:Job|undefined,previewKey="",actionKey="",preview:ModelPreview|undefined,polling=false;
  async function loadJobs():Promise<void>{const jobs:Job[]=await api("jobs");$("studio-login").hidden=true;$("studio-workspace").hidden=false;preview??=new ModelPreview($("preview"));const select=$<HTMLSelectElement>("jobs"),id=selected?.id;select.replaceChildren(...jobs.map(j=>new Option(`${j.name} / ${j.title} — ${labels[j.status]??j.status}`,j.id)));if(id&&jobs.some(j=>j.id===id))select.value=id;if(select.value)await loadJob(select.value);}
  async function loadJob(id:string):Promise<void>{
    const job:Job=await api("jobs/"+id);selected=job;$("job-status").textContent=`${labels[job.status]??job.status} · ${job.progress??0}%${job.testOnly?" · 합성 검증 데이터 (실사 아님)":""}${job.error?" · "+job.error:""}`;$<HTMLProgressElement>("job-progress").value=job.progress??0;
    const option=Array.from($<HTMLSelectElement>("jobs").options).find(o=>o.value===id);if(option)option.textContent=`${job.name} / ${job.title} — ${labels[job.status]??job.status}`;
    $("job-log").textContent=JSON.stringify({tasks:job.tasks,retargetReport:job.retargetReport,events:job.events},null,2);
    const asset=job.result??job.rig??job.model;if(asset&&previewKey!==asset.url+asset.sha256){previewKey=asset.url+asset.sha256;await preview?.load(asset.url);}
    const key=[job.id,job.status,asset?.sha256].join(":");if(key===actionKey)return;actionKey=key;const actions=$("job-actions");actions.replaceChildren();
    const button=(label:string,fn:()=>Promise<void>)=>{const b=document.createElement("button");b.textContent=label;b.onclick=()=>run(fn);actions.append(b);};
    const action=async(data:unknown)=>{await api(`jobs/${id}/actions`,data);await loadJob(id);};
    const quote=async(stage:string)=>{
      const q=await api(`jobs/${id}/actions`,{action:"quote",stage});$("cost-details").textContent=JSON.stringify({provider:q.provider,operations:q.operations,estimatedCredits:q.estimatedCredits,pricing:q.pricing},null,2);
      const dialog=$<HTMLDialogElement>("cost-dialog");$<HTMLInputElement>("cost-ack").checked=false;dialog.showModal();
      const choice=await new Promise<string>(resolve=>dialog.addEventListener("close",()=>resolve(dialog.returnValue),{once:true}));if(choice==="approve")await action({action:"approve",quoteId:q.id,costAcknowledged:true});
    };
    if(["uploaded","failed"].includes(job.status))button("Tripo로 외형 생성 · 비용 확인",()=>quote("generate"));
    if(job.status==="model_approved"||job.status==="failed"&&job.model)button("Tripo 자동 리깅 · 비용 확인",()=>quote("rig"));
    if(job.status==="rig_ready"||job.status==="failed"&&job.rig)button("DeepMotion 모션 추출 · 비용 확인",()=>quote("motion"));
    const review=(fields:string[],texts:string[],kind:string,asset:Asset)=>{const boxes=fields.map((field,i)=>{const label=document.createElement("label"),box=document.createElement("input");box.type="checkbox";label.append(box,document.createTextNode(texts[i]));actions.append(label);return {field,box};});button("검수 승인",async()=>{if(boxes.some(b=>!b.box.checked))throw new Error("검수 항목을 모두 확인하세요");await action({action:kind,sha256:asset.sha256,...Object.fromEntries(boxes.map(b=>[b.field,true]))});});};
    if(job.status==="model_review"&&job.model)review(["face","body","clothing"],["얼굴이 공연자와 허용 가능한 수준으로 일치함","신체·손·비율을 확인함","의상·텍스처를 확인함"],"review-model",job.model);
    if(job.status==="animation_review"&&job.result)review(["motion","feet","alignment"],["공연 동작을 확인함","발 미끄러짐·관절 변형을 확인함","방향·크기·바닥 높이를 확인함"],"review-animation",job.result);
    if(job.status==="approved")button("검수 완료 배우를 AR 공연에 등록",async()=>{await action({action:"publish"});await loadJobs();});
    if(job.status==="failed")button("동일 작업 ID 재확인 / 로컬 변환 재시도",()=>action({action:"resume"}));
    if(job.status==="needs_reconciliation"){const input=document.createElement("input");input.placeholder="제공자 콘솔의 실제 작업 ID";actions.append(input);button("중복 결제 없이 작업 연결",()=>action({action:"reconcile",taskId:input.value}));}
    if(job.status==="published"){const a=document.createElement("a");a.href="?musical=1";a.textContent="AR 무대에서 ‘등록 공연자’로 두 슬롯에 배치 →";actions.append(a);}
    if(!["queued","running","published"].includes(job.status))for(const [kind,label,accept] of [["model","대체 경로: 외형/리깅 GLB 입력",".glb"],["motion","대체 경로: BVH / FBX / GLB 모션 입력",".bvh,.fbx,.glb"],["result","대체 경로: 완성된 애니메이션 GLB 입력",".glb"]]){
      const wrapper=document.createElement("label"),input=document.createElement("input");input.type="file";input.accept=accept;input.dataset.attachment=kind;wrapper.append(document.createTextNode(label),input);actions.append(wrapper);
      input.onchange=()=>run(async()=>{if(!input.files?.[0])return;const data=new FormData();data.append(kind,input.files[0]);await upload(`jobs/${id}/attachments`,data);await loadJob(id);});
    }
  }
  function upload(path:string,data:FormData):Promise<unknown>{return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open("POST","/api/studio/"+path);xhr.setRequestHeader("X-Studio-Request","1");xhr.upload.onprogress=e=>{if(e.lengthComputable)$<HTMLProgressElement>("upload-progress").value=e.loaded/e.total*100;};xhr.onload=()=>{try{const result=JSON.parse(xhr.responseText);if(xhr.status>=400)reject(Error(result.error));else resolve(result);}catch{reject(Error("업로드 응답 오류"));}};xhr.onerror=()=>reject(Error("업로드 연결 실패"));xhr.send(data);});}
  $("login-form").onsubmit=e=>{e.preventDefault();run(async()=>{await api("login",{token:$<HTMLInputElement>("token").value});$<HTMLInputElement>("token").value="";await loadJobs();});};
  const photoURLs:string[]=[];
  $("photos").onchange=()=>{photoURLs.forEach(URL.revokeObjectURL);photoURLs.length=0;$("photo-views").replaceChildren();Array.from($<HTMLInputElement>("photos").files??[]).forEach((file,i)=>{const label=document.createElement("label"),image=document.createElement("img"),select=document.createElement("select");image.src=URL.createObjectURL(file);photoURLs.push(image.src);image.alt=`사진 ${i+1}`;select.dataset.view=String(i);for(const [id,text] of [["front","정면"],["left","왼쪽"],["back","뒤"],["right","오른쪽"],["reference","추가 참고"]])select.add(new Option(text,id));select.value=i===0?"front":"reference";label.append(image,select);$("photo-views").append(label);});};
  $("upload-form").onsubmit=e=>{e.preventDefault();run(async()=>{const photos=Array.from($<HTMLInputElement>("photos").files??[]),video=$<HTMLInputElement>("video").files?.[0];if(photos.length<1||photos.length>8||!video)throw new Error("전신 사진 1~8장과 영상 한 개를 선택하세요");const data=new FormData($<HTMLFormElement>("upload-form"));photos.forEach(f=>data.append("photo",f));data.append("video",video);data.append("views",JSON.stringify(Array.from(document.querySelectorAll<HTMLSelectElement>("[data-view]")).map(s=>s.value)));data.append("consents",JSON.stringify(Object.fromEntries(Array.from(document.querySelectorAll<HTMLInputElement>("[data-consent]")).map(c=>[c.dataset.consent,c.checked]))));const job=await upload("jobs",data) as Job;selected=job;await loadJobs();});};
  $("jobs").onchange=()=>run(()=>loadJob($<HTMLSelectElement>("jobs").value));$("refresh").onclick=()=>run(loadJobs);
  void api("health").then(c=>{$("studio-message").textContent=`연결됨 · Tripo ${c.tripo?"설정됨":"미설정"} · DeepMotion ${c.deepMotion?"설정됨":"미설정"} · 로컬 리타기팅 ${c.localRetarget?"설정됨":"미설정"} · 유료 API 실호출 검증 전`;return loadJobs();}).catch(e=>{if(!String(e).includes("로그인"))error(e);});
  const timer=setInterval(()=>{if(!selected||polling||$("studio-workspace").hidden)return;polling=true;void loadJob(selected.id).catch(error).finally(()=>polling=false);},2500);
  window.addEventListener("pagehide",()=>{clearInterval(timer);preview?.dispose();photoURLs.forEach(URL.revokeObjectURL);},{once:true});
}
