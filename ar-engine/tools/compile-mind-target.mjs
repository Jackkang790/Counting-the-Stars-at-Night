// Uses the existing locally-vendored MindAR 1.2.5 compiler, no remote service.
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
const repo=resolve(import.meta.dirname,'../..');
const {chromium}=await import(pathToFileURL(resolve(repo,process.env.PLAYWRIGHT_MODULE??'.tmp/musical-qa/node_modules/playwright/index.mjs')).href);
const base=process.argv[2]??'https://localhost:5187/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({ignoreHTTPSErrors:true});await page.goto(base);
const bytes=await page.evaluate(async imageData=>{
 const {Compiler}=await import('/src/musical/vendor/mindar-image.prod.js');
 const image=new Image();image.src=imageData;await image.decode();
 const compiler=new Compiler();await compiler.compileImageTargets([image],()=>{});
 return Array.from(new Uint8Array(compiler.exportData()));
},'data:image/png;base64,'+readFileSync(resolve(repo,'ar-engine/tracking-lab-assets/building.png')).toString('base64'));
writeFileSync(resolve(repo,'ar-engine/tracking-lab-assets/building.mind'),Buffer.from(bytes));console.log('Compiled actual common MindAR target:',bytes.length,'bytes');
}finally{await browser.close();}
