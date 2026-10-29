// REAL recognition engines, SYNTHETIC Chrome video input. Never phone AR proof.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';
const repo=resolve(import.meta.dirname,'../..'),out=resolve(repo,'ar-engine/reports/tracking-lab');await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(resolve(repo,process.env.PLAYWRIGHT_MODULE??'.tmp/musical-qa/node_modules/playwright/index.mjs')).href);
const base=process.argv[2]??'https://localhost:5187/';const results=[];
for(const engine of (process.argv[3]?[process.argv[3]]:['nft','mindar'])){
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+resolve(repo,'.tmp/nft-tools/camera.y4m')]});
 const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1000,height:960},permissions:['camera']});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 const snapshot=()=>page.evaluate(()=>document.querySelector('#tracking-lab').trialSnapshot());
 try{
 await page.goto(base+'?trackingLab=1&engine='+engine);await page.waitForFunction(()=>!document.querySelector('#lab-start')?.disabled,undefined,{timeout:30000});
 await page.locator('#lab-start').click();await page.waitForFunction(()=>document.querySelector('#tracking-lab').dataset.tracked==='true',undefined,{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#tracking-lab').trialSnapshot().rendererCalls>=9,undefined,{timeout:10000});
 const found=await snapshot();assert.equal(found.anchorVisible,true);assert.equal(found.videoActive,true);assert.ok(found.poseCount>0);assert.equal(found.physicalPhoneARVerified,false);
 assert.ok(found.projectedTargetCorners[0][0]<found.projectedTargetCorners[1][0],'Image +X must project right');
 assert.ok(found.projectedTargetCorners[0][1]>found.projectedTargetCorners[3][1],'Image +Y must project up');
 assert.ok(found.normalTowardCamera>0,'Positive distance must move the actor towards the camera');
 await page.locator('#lab-still').click();await page.waitForTimeout(1200);const before=await snapshot();
 await page.locator('#lab-height').fill('1.25');await page.locator('#lab-height').dispatchEvent('input');await page.locator('#lab-depth').fill('0.6');await page.locator('#lab-depth').dispatchEvent('input');
 const changed=await snapshot();assert.equal(changed.settings.height,1.25);assert.equal(changed.settings.distanceFromWall,.6);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(out,engine+'-synthetic-found.png')});
 await page.waitForFunction(()=>document.querySelector('#tracking-lab').trialSnapshot().summary.lossCount>0&&!document.querySelector('#tracking-lab').trialSnapshot().anchorVisible,undefined,{timeout:30000});
 const lost=await snapshot();const paused=lost.boneQuaternion;
 await page.waitForTimeout(150);const during=await snapshot();if(!during.anchorVisible)assert.deepEqual(during.boneQuaternion,paused);
 await page.screenshot({path:join(out,engine+'-synthetic-lost.png')});
 await page.waitForFunction(()=>document.querySelector('#tracking-lab').trialSnapshot().summary.reacquisitionMs.length>0&&document.querySelector('#tracking-lab').dataset.tracked==='true',undefined,{timeout:35000});
 const reacquired=await snapshot();assert.notDeepEqual(reacquired.boneQuaternion,before.boneQuaternion);
 await page.locator('#lab-stop').click();assert.equal((await snapshot()).videoActive,false);
 const result={engine,result:'PASS',testedUrl:base,actualEngineRecognition:true,cameraSource:'Chrome synthetic y4m',physicalPhoneARVerified:false,found,lost,reacquired,pageErrors:errors};
 await writeFile(join(out,engine+'-synthetic.json'),JSON.stringify(result,null,2));results.push({engine,result:'PASS',physicalPhoneARVerified:false});console.log(JSON.stringify(results.at(-1)));
 }catch(e){await page.screenshot({path:join(out,engine+'-failure.png')}).catch(()=>{});await writeFile(join(out,engine+'-failure.json'),JSON.stringify({status:await page.locator('#lab-status').textContent().catch(()=>''),errors,snapshot:await snapshot().catch(()=>null)},null,2));throw e;}finally{await browser.close();}
}
await writeFile(join(out,'browser.json'),JSON.stringify({results,testedUrl:base,physicalPhoneARVerified:false,source:'real engines / synthetic camera stimulus'},null,2));
