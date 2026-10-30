import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const base=(process.argv[2]||'http://localhost:8190').replace(/\/$/,'');
const out=resolve(import.meta.dirname,'../.tmp/floor-placement');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
  window.__normal=false;window.__floor=false;window.__distance=.8;window.__floorY=0;window.__cameraX=0;window.__probes=[];
  let modules=[],world,timer;
  window.XR8={loadChunk:async()=>{},XrConfig:{device:()=>({MOBILE:'mobile'}),camera:()=>({BACK:'back'})},
    XrController:{configure(){},pipelineModule:()=>({name:'controller'}),updateCameraProjectionMatrix(){},
      hitTest:(x)=>{window.__probes.push(x);return window.__floor&&x<.4?[{type:'FEATURE_POINT',distance:Math.hypot(window.__distance,1.5-window.__floorY),position:{x:0,y:window.__floorY,z:-window.__distance}}]:[];}},
    GlTextureRenderer:{pipelineModule:()=>({name:'camera'})},Threejs:{configure(){},pipelineModule:()=>({name:'three'}),xrScene:()=>world},
    addCameraPipelineModules:list=>{modules=list;},removeCameraPipelineModules(){},pause(){},resume(){},stop:()=>clearInterval(timer),
    run:({canvas})=>{
      const T=window.THREE;world=window.__world={scene:new T.Scene(),camera:new T.PerspectiveCamera(45,canvas.width/canvas.height,.01,100),renderer:new T.WebGLRenderer({canvas,preserveDrawingBuffer:true})};
      world.scene.background=new T.Color('#243333');world.renderer.setSize(canvas.width,canvas.height,false);
      modules.forEach(module=>module.onStart?.({}));
      timer=setInterval(()=>{
        world.camera.position.set(window.__cameraX,1.5,0);world.camera.lookAt(0,0,-window.__distance);world.camera.updateMatrixWorld(true);
        modules.forEach(module=>module.onUpdate?.({processCpuResult:{reality:{trackingStatus:window.__normal?'NORMAL':'LIMITED',position:{x:0,y:1.5,z:0},rotation:{x:0,y:0,z:0,w:1},intrinsics:world.camera.projectionMatrix.elements}}}));
        world.renderer.render(world.scene,world.camera);
      },40);
    }};
});
try{
  await page.goto(base+'/ar/?musical=1&show=quartet');
  await expect(page.locator('#musical-app')).toHaveAttribute('data-media-source','quartet',{timeout:60000});
  await page.locator('#musical-camera').click();
  await expect(page.locator('#musical-place-here')).toBeHidden();
  await page.evaluate(()=>{window.__normal=true;});
  await expect(page.locator('#musical-app')).toHaveAttribute('data-world-tracking','normal');
  await expect(page.locator('.musical-floor-hint')).toBeVisible();
  await expect(page.locator('#musical-place-here')).toBeHidden();
  checks.push('no tracking or no measured hit never produces a false clickable floor');
  await page.evaluate(()=>{window.__floor=true;window.__floorY=1.49;});
  await expect(page.locator('#musical-place-here')).toBeHidden();
  await page.evaluate(()=>{window.__floorY=0;});
  await expect(page.getByRole('button',{name:'여기에 공연 보기',exact:true})).toBeVisible();
  assert.ok(await page.evaluate(()=>window.__probes.includes(.35)));
  await page.screenshot({path:resolve(out,'floor-ready-mobile.png')});
  checks.push('searches visible floor samples beyond the center; a nearby 0.8m floor shows a large tap target and stage footprint');
  await page.locator('#musical-world-camera').click({position:{x:8,y:300}});
  await expect(page.locator('#musical-app')).not.toHaveAttribute('data-tracking','true');
  checks.push('tapping unhighlighted scenery cannot place a different invisible point');
  const floorPoint=await page.evaluate(()=>{
    const T=window.THREE,guide=window.__world.scene.getObjectByName('FloorPlacementGuide');guide.updateMatrixWorld(true);
    const pad=guide.children.find(object=>object.geometry?.type==='PlaneGeometry');
    const point=new T.Vector3().setFromMatrixPosition(pad.matrixWorld).project(window.__world.camera);
    const rect=document.querySelector('#musical-world-camera').getBoundingClientRect();
    return{x:rect.left+(point.x+1)*.5*rect.width,y:rect.top+(1-point.y)*.5*rect.height};
  });
  await page.mouse.click(floorPoint.x,floorPoint.y);
  await expect(page.locator('#musical-app')).toHaveAttribute('data-playback','playing');
  await expect(page.locator('#musical-place-here')).toBeHidden();
  const first=await page.evaluate(()=>{const actor=window.__world.scene.getObjectByName('BuildingAnchor'),anchor=actor.parent.parent;return{position:anchor.position.toArray(),scale:anchor.scale.x};});
  assert.deepEqual(first.position,[0,0,-.8]);assert.ok(first.scale>=.03&&first.scale<1);
  await expect.poll(async()=>Number(await page.locator('#musical-app').getAttribute('data-time')),{timeout:15000}).toBeGreaterThan(4);
  await page.screenshot({path:resolve(out,'one-tap-playing-mobile.png')});
  checks.push('tapping the highlighted floor area uses its displayed real hit, fits the nearby stage, and starts real 4-actor audio playback without another Play tap');
  await page.locator('#musical-pause').click();
  await page.locator('#musical-options').click();
  await page.getByRole('slider',{name:'무대 크기'}).fill('150');
  await page.getByRole('slider',{name:'무대 크기'}).dispatchEvent('input');
  await page.evaluate(()=>{window.__cameraX=.2;});await page.waitForTimeout(200);
  const adjusted=await page.evaluate(()=>{const stage=window.__world.scene.getObjectByName('BuildingAnchor'),anchor=stage.parent.parent;return{position:anchor.position.toArray(),scale:anchor.scale.x,manual:stage.parent.scale.x};});
  assert.deepEqual(adjusted.position,first.position);assert.equal(adjusted.scale,first.scale);assert.equal(adjusted.manual,1.5);
  await page.locator('#musical-options').click();
  checks.push('manual stage size and camera movement retain the world position; automatic fit is frozen after placement');
  await page.evaluate(()=>{window.__normal=false;});
  await expect(page.locator('#musical-app')).toHaveAttribute('data-tracking','false');
  await expect(page.locator('#musical-place-here')).toBeHidden();
  await page.evaluate(()=>{window.__normal=true;});
  await expect(page.locator('#musical-app')).toHaveAttribute('data-tracking','true');
  await expect(page.locator('#musical-app')).toHaveAttribute('data-playback','paused');
  checks.push('tracking recovery preserves an explicit pause and does not start playback by itself');
  await page.locator('#musical-reposition').click();
  await page.evaluate(()=>{window.__distance=.35;window.__cameraX=0;});
  await expect(page.getByRole('button',{name:'여기에 공연 보기',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__world.scene.getObjectByName('FloorPlacementGuide').matrix.elements[14])).toBe(-.35);
  await page.getByRole('button',{name:'여기에 공연 보기',exact:true}).click();
  await expect(page.locator('#musical-app')).toHaveAttribute('data-playback','playing');
  const position=await page.evaluate(()=>window.__world.scene.getObjectByName('BuildingAnchor').parent.parent.position.toArray());
  assert.deepEqual(position,[0,0,-.35]);
  checks.push('choosing a new nearby floor target resumes the performance in one tap');
  assert.deepEqual(errors,[]);
  const report={result:'PASS',testedUrl:base,checks,tracking:'MOCK ONLY',physicalPhoneARVerified:false};
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});console.error('Browser errors:',errors);throw error;}
finally{await browser.close();}
