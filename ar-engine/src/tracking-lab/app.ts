import * as THREE from 'three';
import modelUrl from '../../musical-assets/quartet/performer-01.glb?url';
import {RiggedGLBPerformer} from '../musical/riggedGLB';
import {MindTracker,NftTracker,type Tracker,type TargetInfo} from './adapters';
import {TrialMetrics} from './metrics';
import './style.css';
type Target=TargetInfo&{files:Record<string,{sha256:string;bytes:number}>};
const hash=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function mountTrackingLab():Promise<void>{
 const engine=new URLSearchParams(location.search).get('engine')==='nft'?'nft':'mindar';
 const base=new URL(import.meta.env.BASE_URL+'tracking-lab/',location.origin).href;
 const original=document.getElementById('app');if(original)original.hidden=true;
 document.body.classList.add('tracking-lab');
 const root=document.createElement('main');root.id='tracking-lab';document.body.appendChild(root);
 root.innerHTML=`<header><div><small>INDEPENDENT TRACKING LAB</small><h1>건물 이미지 · 배우 한 명</h1></div><a href="./">기존 AR로</a></header>
 <nav><a href="?trackingLab=1&engine=nft">AR.js NFT</a><a href="?trackingLab=1&engine=mindar">MindAR</a><a href="?musical=1&show=quartet">기존 공간 추적 공연</a></nav>
 <p id="lab-status" role="status">공통 사진과 GLB 확인 중…</p>
 <section id="lab-camera"><video muted playsinline autoplay></video><div id="lab-overlay"><span id="lab-badge">카메라 꺼짐</span><span id="lab-clock">인식 대기</span></div></section>
 <section class="lab-controls"><button id="lab-start" disabled>카메라 시작</button><button id="lab-stop" disabled>종료</button><button id="lab-still" disabled>고정한 상태로 흔들림 측정</button><button id="lab-save" disabled>결과 저장</button></section>
 <p class="lab-note">실제 카메라 전체 화면을 유지합니다. 이미지 인식 시 배우 표시·동작 재생, 상실 시 숨김·일시정지. 650ms 동안 포즈가 갱신되지 않아도 숨깁니다. 마지막 화면 좌표를 월드 앵커처럼 유지하지 않습니다.</p>
 <details open><summary>동일 조건 · 크기와 벽에서 거리</summary><div class="lab-settings">
 <label>배우 키(m)<input id="lab-height" type="range" min="0.3" max="2.5" step="0.05" value="1.65"><output id="lab-height-value">1.65</output></label>
 <label>벽에서 앞쪽 거리(m)<input id="lab-depth" type="range" min="0" max="2" step="0.05" value="0.35"><output id="lab-depth-value">0.35</output></label>
 <label>좌우(m)<input id="lab-x" type="range" min="-2" max="2" step="0.05" value="0"><output id="lab-x-value">0</output></label>
 <label>배우 방향(도)<input id="lab-yaw" type="range" min="-180" max="180" step="5" value="0"><output id="lab-yaw-value">0</output></label>
 <label>기기·OS<input id="lab-device" placeholder="예: iPhone 15 / iOS 버전"></label><label>시험 조건<input id="lab-notes" placeholder="거리·조명·각도·시도 번호"></label>
 </div><p>표적 폭 5.6m는 임시값입니다. 실제 폭을 다르게 쓰는 실험은 비교하지 마세요. 흔들림 측정 시 카메라를 고정하고 10초 기다리세요. 이동 중 변화는 흔들림으로 판정할 수 없습니다.</p></details>
 <details><summary>등록된 공통 사진 · 표적 파일</summary><img id="lab-target" alt="두 엔진에 동일하게 등록한 건물 사진"><p>제공된 첫 실내 사진의 외벽 원근 보정본, 960×428. 반복 격자·반사·깊이 차이는 인식에 불리할 수 있습니다. 사진 미리보기는 카메라를 대신하지 않습니다.</p><a id="lab-image-download" download="building.png">공통 사진</a> · <a id="lab-manifest-download" download="target.json">SHA256 및 등록 정보</a><pre id="lab-identity"></pre></details>
 <section><h2>실행 기록</h2><pre id="lab-metrics">아직 측정값이 없습니다.</pre><button id="lab-import">다른 결과 JSON 비교</button><input id="lab-import-file" type="file" accept="application/json" multiple hidden><div id="lab-comparison"></div><p>이 화면은 실기기 합격을 자동 판정하지 않습니다. iPhone/Android를 직접 테스트하고 기록해야 합니다. 브라우저 자동 카메라 테스트는 실기기 증거가 아닙니다.</p></section>`;
 const $=<T extends HTMLElement>(id:string)=>root.querySelector<T>('#lab-'+id)!;
 $('status').textContent=`${engine==='nft'?'AR.js NFT 3.4.8':'MindAR 1.2.5'} · 공통 표적을 검증합니다.`;
 root.dataset.engine=engine;
 const targetResponse=await fetch(base+'target.json');if(!targetResponse.ok)throw Error('먼저 stage-tracking-lab.mjs로 표적을 스테이징하세요');
 const target=await targetResponse.json() as Target;
 const checked=async(name:string)=>{const r=await fetch(base+name);if(!r.ok)throw Error('표적 파일 없음: '+name);const bytes=await r.arrayBuffer();if(!target.files[name]||await hash(bytes)!==target.files[name].sha256)throw Error('표적 SHA 불일치: '+name);return bytes;};
 // Both adapters prove the photo identity, not just a matching filename.
 await checked('building.png');const mindBytes=await checked('building.mind');
 for(const ext of ['iset','fset','fset3'])await checked('building.'+ext);
 const modelResponse=await fetch(modelUrl);if(!modelResponse.ok)throw Error('GLB 로드 실패');const modelBytes=await modelResponse.arrayBuffer();
 if(await hash(modelBytes)!==target.modelSha256)throw Error('공통 GLB SHA 불일치');
 const actor=await RiggedGLBPerformer.load({id:'comparison-performer',label:'동일 교복 배우',anchor:'stage',position:[0,0,0],rotation:[0,0,0],height:1.65,width:.7,start:0,end:10,fadeIn:0,fadeOut:0,mediaOffset:0,loop:true,mode:'packed',clipName:'UniformQuartet01'},modelBytes,'licensed-human');
 const video=root.querySelector('video')!,container=$('camera'),badge=$('badge');
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);container.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.01,10000),anchor=new THREE.Group();anchor.name='ImageBuildingAnchor';anchor.matrixAutoUpdate=false;anchor.visible=false;anchor.add(actor.group);scene.add(anchor,new THREE.HemisphereLight(0xfff5ed,0x4b5563,2.5));
 const light=new THREE.DirectionalLight(0xffffff,1.8);light.position.set(0,3,3);scene.add(light);
 const rawProjection=new THREE.Matrix4();let projectionReady=false;
 let tracker:Tracker|undefined,stream:MediaStream|undefined,disposed=false,running=false,starting=false,epoch=0;
 let metrics=new TrialMetrics(),lastPose=0,lastFrame=0,animationTime=0,poseCount=0;
 let latestPose:number[]|null=null;
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 const fail=(e:unknown)=>{$('status').textContent='오류: '+(e instanceof Error?e.message:String(e));root.dataset.error='true';};
 const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);if(!projectionReady||!video.videoWidth)return;
  camera.projectionMatrix.copy(rawProjection);const fit=Math.min(w/video.videoWidth,h/video.videoHeight);
  for(const i of [0,4,8,12])camera.projectionMatrix.elements[i]*=video.videoWidth*fit/w;
  for(const i of [1,5,9,13])camera.projectionMatrix.elements[i]*=video.videoHeight*fit/h;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();};
 const observer=new ResizeObserver(resize);observer.observe(container);
 const updateTransform=()=>{const h=Number($<HTMLInputElement>('height').value);actor.group.scale.setScalar(h/1.65);actor.group.position.set(Number($<HTMLInputElement>('x').value),-target.height/target.width*target.widthMeters/2,Number($<HTMLInputElement>('depth').value));actor.group.rotation.y=Number($<HTMLInputElement>('yaw').value)*Math.PI/180;
  for(const id of ['height','depth','x','yaw'])$(id+'-value').textContent=$<HTMLInputElement>(id).value;};
 for(const id of ['height','depth','x','yaw'])$(id).addEventListener('input',updateTransform);updateTransform();
 const setTracking=(found:boolean)=>{metrics.transition(found,performance.now());anchor.visible=found;root.dataset.tracked=String(found);badge.textContent=found?'인식됨 · 건물 기준 배우 표시':'추적 없음 · 배우 숨김';$<HTMLButtonElement>('still').disabled=!found;};
 const report=()=>({schemaVersion:1,experiment:'image-tracking-comparison',engine,startedAt:metrics.startedAt,finishedAt:new Date().toISOString(),userAgent:navigator.userAgent,device:$<HTMLInputElement>('device').value.slice(0,150),conditions:$<HTMLInputElement>('notes').value.slice(0,500),camera:{width:video.videoWidth,height:video.videoHeight,requested:'environment, 960×720 ideal, 24fps ideal',display:'contain'},trackerConfiguration:engine==='nft'?{version:'AR.js 3.4.8 NFT worker',processing:[640,480],extraSmoothing:false}:{version:'MindAR 1.2.5',processing:[video.videoWidth,video.videoHeight],warmupTolerance:2,missTolerance:2,filterMinCF:.001,filterBeta:1000},targetSha256:target.imageSha256,modelSha256:target.modelSha256,targetWidthMeters:target.widthMeters,provisionalDimensions:true,poseCount,lossPolicy:'hide immediately on null pose; hide/pause after 650ms without update; reacquire image, no persistent world anchor',settings:{height:Number($<HTMLInputElement>('height').value),distanceFromWall:Number($<HTMLInputElement>('depth').value),x:Number($<HTMLInputElement>('x').value),yaw:Number($<HTMLInputElement>('yaw').value)},summary:metrics.summary(),events:metrics.events,stationaryPoses:metrics.samples,physicalPhoneARVerified:false,evidence:'camera-session-log; manual device review required'});
 const stop=()=>{epoch++;starting=false;running=false;root.dataset.running='false';root.dataset.ready='false';tracker?.dispose();tracker=undefined;stream?.getTracks().forEach(t=>t.stop());stream=undefined;video.pause();video.srcObject=null;setTracking(false);renderer.setAnimationLoop(null);renderer.clear();$<HTMLButtonElement>('start').disabled=false;$<HTMLButtonElement>('stop').disabled=true;$('status').textContent='카메라 종료 · 결과를 저장할 수 있습니다.';};
 $('start').addEventListener('click',()=>void(async()=>{
  if(running||starting)return;starting=true;const token=++epoch;$<HTMLButtonElement>('start').disabled=true;root.dataset.error='false';metrics=new TrialMetrics();animationTime=0;poseCount=0;latestPose=null;projectionReady=false;
  try{
   if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('HTTPS와 카메라 지원 브라우저가 필요합니다');
   const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'environment',width:{ideal:960},height:{ideal:720},frameRate:{ideal:24,max:30}}});
   if(token!==epoch||disposed){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;video.srcObject=stream;await video.play();
   if(token!==epoch||disposed)return;
   if(!video.videoWidth||!video.videoHeight)throw Error('카메라 영상 크기를 읽지 못했습니다. 종료 후 다시 시작하세요');
   // MindAR's input loader draws using element.width/height, not videoWidth.
   // Leaving the HTML attributes at zero produces a black recognition input.
   video.width=video.videoWidth;video.height=video.videoHeight;
   metrics.cameraReady=performance.now();running=true;root.dataset.running='true';setTracking(false);$<HTMLButtonElement>('stop').disabled=false;
   for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(running){stop();fail('카메라 스트림이 종료됐습니다');}},{once:true});
   const callbacks={projection:(matrix:number[])=>{rawProjection.fromArray(matrix);projectionReady=true;resize();},ready:()=>{metrics.engineReady=performance.now();$('status').textContent='표적 사진과 같은 외벽을 비추세요. 전체 사진이 보이는 거리부터 시작하세요.';root.dataset.ready='true';},pose:(matrix:number[]|null)=>{
    if(token!==epoch||!running)return;if(!matrix||matrix.length!==16||!matrix.every(Number.isFinite)){setTracking(false);return;}
    lastPose=performance.now();poseCount++;latestPose=matrix.slice();anchor.matrix.fromArray(matrix);anchor.matrixWorldNeedsUpdate=true;anchor.matrix.decompose(position,rotation,scale);metrics.sample(position.clone().divideScalar(Math.abs(scale.x)||1).toArray(),rotation.toArray(),lastPose);setTracking(true);
   },error:(message:string)=>{if(token!==epoch)return;stop();fail(message);}};
   tracker=engine==='nft'?new NftTracker(video,base,target,callbacks):new MindTracker(video,mindBytes.slice(0),target,callbacks);
   lastFrame=performance.now();renderer.setAnimationLoop(()=>{
    const now=performance.now(),delta=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
    if(metrics.found&&now-lastPose>650)setTracking(false);if(metrics.found)animationTime+=delta;
    actor.sample(animationTime%10,metrics.found);renderer.render(scene,camera);
    root.dataset.animationTime=animationTime.toFixed(3);$('clock').textContent=metrics.firstPose===null?'인식 대기':`포즈 ${poseCount} · 상실 ${metrics.losses}회`;
   });
   await tracker.start();if(token===epoch){starting=false;$<HTMLButtonElement>('save').disabled=false;}
  }catch(e){if(token===epoch){stop();fail(e);}}
 })());
 $('stop').addEventListener('click',stop);
 $('still').addEventListener('click',()=>{metrics.beginStationary();$('status').textContent='카메라를 고정한 상태로 10초 유지한 뒤 결과를 저장하세요. 추적 상실 시 측정을 중단합니다.';});
 const comparisons:Record<string,unknown>[]=[];
 function showComparisons():void{
  const table=document.createElement('table');const header=document.createElement('tr');for(const text of ['방식','기기','키/거리(m)','엔진 준비→첫 인식(ms)','상실','상실→재인식(ms)','정지 RMS(m)']){const th=document.createElement('th');th.textContent=text;header.appendChild(th);}table.appendChild(header);
  for(const r of comparisons){const s=r.summary as Record<string,unknown>,settings=r.settings as Record<string,unknown>|undefined;const row=document.createElement('tr');for(const value of [r.engine,r.device,settings?`${settings.height}/${settings.distanceFromWall}`:'미기록',s.firstRecognitionFromEngineMs,s.lossCount,JSON.stringify(s.reacquisitionMs),s.translationRmsMeters]){const cell=document.createElement('td');cell.textContent=String(value??'미측정');row.appendChild(cell);}table.appendChild(row);}
  $('comparison').replaceChildren(table);
 }
 $('save').addEventListener('click',()=>{const data=report();$('metrics').textContent=JSON.stringify(data.summary,null,2);comparisons.push(data);showComparisons();
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`tracking-${engine}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
 });
 $('import').addEventListener('click',()=>$<HTMLInputElement>('import-file').click());
 $('import-file').addEventListener('change',()=>void(async()=>{try{for(const file of Array.from($<HTMLInputElement>('import-file').files??[]).slice(0,10)){
  if(file.size>2*1024*1024)throw Error('결과 JSON은 2MiB 이하여야 합니다');const data=JSON.parse(await file.text());
  if(data.experiment!=='image-tracking-comparison'||data.targetSha256!==target.imageSha256||data.modelSha256!==target.modelSha256||data.targetWidthMeters!==target.widthMeters||!data.summary||!['nft','mindar'].includes(data.engine))throw Error('동일한 사진·모델·표적 폭의 결과만 비교할 수 있습니다');comparisons.push(data);
 }showComparisons();}catch(e){fail(e);}})());
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stop();});
 window.addEventListener('pagehide',()=>{disposed=true;stop();observer.disconnect();actor.dispose();renderer.dispose();},{once:true});
 $<HTMLImageElement>('target').src=base+'building.png';$<HTMLAnchorElement>('image-download').href=base+'building.png';$<HTMLAnchorElement>('manifest-download').href=base+'target.json';$('identity').textContent=`사진 SHA256 ${target.imageSha256}\nGLB SHA256 ${target.modelSha256}`;
 const licenses=document.createElement('p');licenses.className='lab-note';licenses.append('추적 엔진 라이선스·원본 소스: ');
 for(const name of ['THIRD_PARTY.md','LICENSE.AR-js','LICENSE.ARToolkit','LICENSE.mind-ar','LICENSE.apache-2.0']){const a=document.createElement('a');a.href=base+name;a.textContent=name;a.target='_blank';a.rel='noopener';licenses.append(a,' · ');}root.appendChild(licenses);
 $('status').textContent=`${engine==='nft'?'AR.js NFT':'MindAR'} 준비 완료 · 카메라 시작을 누르세요.`;$<HTMLButtonElement>('start').disabled=false;
 // Read-only observability for reproducible browser tests. No synthetic pose injection.
 Object.defineProperty(root,'trialSnapshot',{value:()=>{anchor.updateMatrixWorld(true);const w=container.clientWidth,h=container.clientHeight;return {...report(),anchorVisible:anchor.visible,latestPose,videoActive:!!stream,rendererCalls:renderer.info.render.calls,
  projectedTargetCorners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{const v=new THREE.Vector3(x*target.widthMeters/2,y*target.height/target.width*target.widthMeters/2,0).applyMatrix4(anchor.matrixWorld).project(camera);return [(v.x+1)*w/2,(1-v.y)*h/2];}),
  normalTowardCamera:new THREE.Vector3(0,0,1).transformDirection(anchor.matrixWorld).dot(position.clone().normalize().negate()),
  boneQuaternion:(()=>{let q:number[]=[];actor.model.traverse(n=>{if(n instanceof THREE.SkinnedMesh&&!q.length)q=n.skeleton.bones.find(b=>b.name==='LeftUpperArm')?.quaternion.toArray()??[];});return q;})()};}});
}
