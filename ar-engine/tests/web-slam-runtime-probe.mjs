import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = resolve(import.meta.dirname, '../..');
const { chromium } = await import(pathToFileURL(resolve(repo, process.env.PLAYWRIGHT_MODULE ?? '.tmp/musical-qa/node_modules/playwright/index.mjs')).href);
process.chdir(repo);

import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'C:/Program Files/Google/Chrome/Application/chrome.exe'),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:412,height:915},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
const page=await context.newPage(), report={errors:[],console:[],failed:[],physicalIPhoneVerified:false};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.console.push(m.text())});page.on('requestfailed',r=>report.failed.push(r.url()+':'+r.failure()?.errorText));
try {
 await page.goto(process.argv[2]??'https://localhost:5187/?musical=1');
 await page.waitForFunction(()=>window.XR8 && !document.querySelector('#musical-camera').disabled,undefined,{timeout:90000});
 report.sdkLoaded=true;report.threeAPI=await page.evaluate(()=>typeof window.XR8.Threejs.pipelineModule);
 await page.locator('#musical-camera').click();await page.waitForTimeout(18000);
 report.state=await page.locator('#musical-app').evaluate(el=>({...el.dataset}));report.body=(await page.locator('body').innerText()).slice(0,1600);
 mkdirSync('ar-engine/reports/web-slam',{recursive:true}); await page.screenshot({path:'ar-engine/reports/web-slam/runtime-probe.png'});
}catch(error){report.failure=String(error);report.body=(await page.locator('body').innerText()).slice(0,1600)}finally{mkdirSync('ar-engine/reports/web-slam',{recursive:true});writeFileSync('ar-engine/reports/web-slam/runtime-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close()}

if(report.failure || report.errors.length || !report.sdkLoaded || report.state?.mode !== 'world') process.exitCode=1;
