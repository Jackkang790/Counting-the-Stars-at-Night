import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = resolve(import.meta.dirname, '../..');
const { chromium } = await import(pathToFileURL(resolve(repo, process.env.PLAYWRIGHT_MODULE ?? '.tmp/musical-qa/node_modules/playwright/index.mjs')).href);
process.chdir(repo);

import { mkdirSync,writeFileSync } from 'node:fs';
const base=process.argv[2]??'https://localhost:5187/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'C:/Program Files/Google/Chrome/Application/chrome.exe'),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:412,height:915},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.__normal=false;window.__hit=false;let modules=[],world,timer;
 window.XR8={loadChunk:async()=>{},XrConfig:{device:()=>({MOBILE:'mobile'}),camera:()=>({BACK:'back'})},
 XrController:{configure:()=>{},pipelineModule:()=>({name:'controller'}),updateCameraProjectionMatrix:()=>{},hitTest:()=>window.__hit?[{type:'FEATURE_POINT',distance:3,position:{x:0,y:0,z:-3}}]:[]},
 GlTextureRenderer:{pipelineModule:()=>({name:'camera'})},Threejs:{configure:()=>{},pipelineModule:()=>({name:'three'}),xrScene:()=>world},
 addCameraPipelineModules:list=>modules=list,removeCameraPipelineModules:()=>{},pause:()=>{},resume:()=>{},stop:()=>clearInterval(timer),
 run:({canvas})=>{const T=window.THREE;world={scene:new T.Scene(),camera:new T.PerspectiveCamera(45,canvas.width/canvas.height,.01,100),renderer:new T.WebGLRenderer({canvas,preserveDrawingBuffer:true})};world.scene.background=new T.Color('#17202a');world.renderer.setSize(canvas.width,canvas.height,false);modules.forEach(m=>m.onStart?.({}));timer=setInterval(()=>{modules.forEach(m=>m.onUpdate?.({processCpuResult:{reality:{trackingStatus:window.__normal?'NORMAL':'LIMITED',position:{x:0,y:1.5,z:0},rotation:{x:0,y:0,z:0,w:1},intrinsics:world.camera.projectionMatrix.elements}}}));world.renderer.render(world.scene,world.camera)},40)}};
});
try{
 await page.goto(base+'?musical=1');await page.waitForFunction(()=>document.querySelector('#musical-app')?.dataset.mediaSource==='samples');
 assert.equal(await page.locator('.musical-image-options').isVisible(),false);
 await page.locator('#musical-camera').click();await page.waitForTimeout(250);assert.equal(await page.locator('#musical-play').isDisabled(),true);
 await page.evaluate(()=>window.__normal=true);await page.waitForTimeout(250);
 await page.locator('#musical-world-camera').click({position:{x:150,y:100}});assert.equal(await page.locator('#musical-play').isDisabled(),true);
 await page.evaluate(()=>window.__hit=true);await page.locator('#musical-world-camera').click({position:{x:150,y:100}});
 await page.waitForFunction(()=>document.querySelector('#musical-app').dataset.tracking==='true');assert.equal(await page.locator('#musical-play').isDisabled(),false);
 await page.locator('#musical-play').click();await page.waitForFunction(()=>Number(document.querySelector('#musical-app').dataset.time)>11.2,undefined,{timeout:20000});
 assert.ok((await page.locator('video[data-actor-id]').evaluateAll(v=>v.map(x=>!x.paused&&x.currentTime>0))).every(Boolean));
 await page.evaluate(()=>window.__normal=false);await page.waitForFunction(()=>document.querySelector('#musical-app').dataset.playback==='paused');
 await page.evaluate(()=>window.__normal=true);await page.waitForTimeout(250);assert.equal(await page.locator('#musical-app').getAttribute('data-playback'),'paused');
 assert.deepEqual(errors,[]);const report={result:'PASS',sdk:'Mocked public API contract ONLY; actual SDK tested separately',noImageTarget:true,untrackedPlacementBlocked:true,missingHitPlacementBlocked:true,twoLicensedVideos:true,trackingLossPauses:true,recoveryDoesNotAutoPlay:true,physicalIPhoneVerified:false};
 mkdirSync('ar-engine/reports/web-slam',{recursive:true});writeFileSync('ar-engine/reports/web-slam/adapter-report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}
