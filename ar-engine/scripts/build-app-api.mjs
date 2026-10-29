// Additive build wrapper. Original package/Vite/stager and AR engine stay intact.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv.includes('--skip-build')) {
  // npm's unchanged prebuild stages the original model sources.
  execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
}
const dist=resolve(root,'dist'),out=resolve(dist,'api/ar/v1');
const basePath=(process.env.AR_BASE??'/').replace(/\/$/,'');
const publicPath=path=>basePath+path;
if(!existsSync(resolve(dist,'index.html')))throw Error('Build the web application first');
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const asset=url=>{const bytes=readFileSync(resolve(dist,'.'+url));return {url:publicPath(url),sha256:sha(bytes),bytes:bytes.length,mimeType:({'.glb':'model/gltf-binary','.json':'application/json','.m4a':'audio/mp4','.jpg':'image/jpeg','.md':'text/markdown'})[extname(url)]??'application/octet-stream'};};
const hashed=(stem,extension)=>{
 const matches=readdirSync(resolve(dist,'assets')).filter(n=>n.startsWith(stem+'-')&&n.endsWith(extension)&&n.length===stem.length+1+8+extension.length);
 if(matches.length!==1)throw Error(`Expected exactly one ${stem}${extension}; found ${matches.length}`);
 return asset('/assets/'+matches[0]);
};
// Vite inlines small depth models into JavaScript; native clients need a file.
const depthBytes=readFileSync(resolve(root,'musical-assets/quartet/facade-depth.glb'));
const depthUrl=`/api/ar/v1/assets/facade-depth-${sha(depthBytes).slice(0,16)}.glb`;
mkdirSync(resolve(out,'assets'),{recursive:true});writeFileSync(resolve(dist,'.'+depthUrl),depthBytes);
const common={schemaVersion:1,coordinates:{units:'meters',up:'+Y',rotation:'radians'},gps:{authority:'host-app',provides6DoF:false},verification:{physicalPhoneARVerified:false},remotePlaybackControl:false};
const starManifest=json('dist/models/starseed_sculpture.manifest.json');
const star={...common,id:'starseed',title:'별의 새싹',launch:{path:publicPath('/'),userGestureRequired:true},
 coordinates:{...common.coordinates,placement:'horizontal-hit-test-or-Quick-Look-placement'},
 assets:{model:asset('/models/starseed_sculpture.glb'),manifest:asset('/models/starseed_sculpture.manifest.json')},
 platforms:{android:{runtime:'WebXR',animations:['Emerge','Idle','Disappear']},ios:{runtime:'AR Quick Look',usdz:'generated-in-browser',webTimeline:false,exportedSkinAnimation:false}},
 scene:{assetId:'starseed_sculpture',experienceId:'emergent-artwork',manifest:starManifest},
 limitations:['임시 창작 조형물이며 확정된 실제 작품 재현이 아님','Quick Look 실행과 복귀를 체험 완료나 보상 근거로 사용하지 않음','GPS는 접근 조건이며 공간 정합 좌표를 제공하지 않음']};
const source=json('musical-assets/quartet/show.json');
const assets={audio:hashed('performance','.m4a'),facade:hashed('facade','.glb'),occlusion:asset(depthUrl),photo:hashed('facade','.jpg')};
for(let i=1;i<=4;i++){const id=`performer-${String(i).padStart(2,'0')}`;assets[id]=hashed(id,'.glb');}
const quartet={...common,id:'black-uniform',title:'검정 교복 · 4인 뮤지컬',launch:{path:publicPath('/?musical=1&show=quartet'),userGestureRequired:true},
 coordinates:{...common.coordinates,placement:'BuildingAnchor-local'},assets,
 platforms:{android:{runtime:['WebXR','web-world-tracking'],sharedAudioTimeline:true},ios:{runtime:['web-world-tracking'],quickLookPerformance:false,sharedAudioTimeline:true}},
 scene:{...source,audio:assets.audio.url,actors:source.actors.map(a=>({...a,model:assets[a.id].url}))},
 hierarchy:['BuildingAnchor/BuildingGroup','BuildingAnchor/PerformerGroup','BuildingAnchor/EffectsGroup'],
 capture:{webWorldTracking:true,webxr:false,output:'local-photo-download',nativeCaptureAPI:false},
 limitations:['원본 배우의 얼굴을 복원한 모델이 아닌 CC0 인체 기반','단안 영상 추정 동작이며 실사 볼류메트릭 캡처가 아님','건물 치수는 임시값이며 현장 수동 정합 필요','iOS Quick Look 경로로 이 공연을 실행하지 않음','사진 촬영은 현재 웹 공간 추적 경로에서만 제공','새 버전 실기기 정합·발열·드리프트 미검증']};
for(const experience of [star,quartet])experience.revision=sha(JSON.stringify(experience)).slice(0,16);
const catalog={schemaVersion:1,basePath:basePath+'/',experiences:[star,quartet].map(({id,title,revision,launch})=>({id,title,revision,launch,url:publicPath(`/api/ar/v1/experiences/${id}.json`)}))};
catalog.revision=sha(JSON.stringify(catalog)).slice(0,16);
mkdirSync(resolve(out,'experiences'),{recursive:true});
writeFileSync(resolve(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
for(const experience of [star,quartet])writeFileSync(resolve(out,`experiences/${experience.id}.json`),JSON.stringify(experience,null,2)+'\n');
for(const name of ['client.mjs','client.d.ts'])copyFileSync(resolve(root,'integration',name),resolve(out,name));
copyFileSync(resolve(root,'contracts/app-integration.md'),resolve(out,'README.md'));
console.log(JSON.stringify({schemaVersion:1,revision:catalog.revision,experiences:catalog.experiences.map(e=>e.id),output:out},null,2));
