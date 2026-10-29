import {Matrix4,Vector3} from 'three';
import type {Controller} from '../musical/vendor/mindar-image.prod.js';
export type TargetInfo={width:number;height:number;widthMeters:number;imageSha256:string;modelSha256?:string};
export interface Tracker {start():Promise<void>;dispose():void}
export type TrackerCallbacks={projection:(matrix:number[])=>void;pose:(matrix:number[]|null)=>void;error:(message:string)=>void;ready:()=>void};
export function canonicalImagePose(raw:number[],width:number,height:number,unitsPerMeter:number):number[] {
  return new Matrix4().fromArray(raw).multiply(new Matrix4().makeTranslation(width/2,height/2,0)).scale(new Vector3(unitsPerMeter,unitsPerMeter,unitsPerMeter)).elements.slice();
}
export class MindTracker implements Tracker {
  private controller?:Controller;private alive=true;
  constructor(private video:HTMLVideoElement,private bytes:ArrayBuffer,private target:TargetInfo,private cb:TrackerCallbacks){}
  async start():Promise<void>{
    const {Controller}=await import('../musical/vendor/mindar-image.prod.js');if(!this.alive)return;
    this.controller=new Controller({inputWidth:this.video.videoWidth,inputHeight:this.video.videoHeight,maxTrack:1,warmupTolerance:2,missTolerance:2,filterMinCF:.001,filterBeta:1000,onUpdate:data=>{
      if(!this.alive||data.type!=='updateMatrix')return;
      const raw=data.worldMatrix;this.cb.pose(raw?canonicalImagePose(raw,this.target.width,this.target.height,this.target.width/this.target.widthMeters):null);
    }});
    const dimensions=this.controller.addImageTargetsFromBuffer(this.bytes).dimensions[0];
    if(!dimensions||dimensions[0]!==this.target.width||dimensions[1]!==this.target.height)throw Error('MindAR 표적 크기가 사진과 다릅니다');
    this.controller.worker.addEventListener('error',()=>this.cb.error('MindAR worker 오류'));
    this.cb.projection(this.controller.getProjectionMatrix());await this.controller.dummyRun(this.video);
    if(!this.alive)return;this.cb.ready();this.controller.processVideo(this.video);
  }
  dispose():void{this.alive=false;this.controller?.stopProcessVideo();this.controller?.dispose();const worker=this.controller?.worker;if(worker)setTimeout(()=>worker.terminate(),150);}
}
export class NftTracker implements Tracker {
  private worker?:Worker;private alive=true;private scheduled=0;
  private canvas=document.createElement('canvas');private units=1;private iw=0;private ih=0;
  constructor(private video:HTMLVideoElement,private base:string,private target:TargetInfo,private cb:TrackerCallbacks){}
  async start():Promise<void>{
    // Same camera feed as MindAR. NFT's independent recognition worker uses a
    // contained 4:3 processing image; projection is corrected for the padding.
    const scale=640/Math.max(this.video.videoWidth,this.video.videoHeight*4/3);
    const vw=this.video.videoWidth*scale,vh=this.video.videoHeight*scale;
    this.canvas.width=640;this.canvas.height=480;
    const worker=this.worker=new Worker(new URL('nft-worker.js',this.base));
    let projection:number[]|undefined;
    const project=()=>{if(!projection)return;const p=projection.slice(),near=this.units*.03,far=this.units*100;
      // Preserve calibrated intrinsics, but use meter-equivalent clipping.
      // The toolkit's 0.1mm near plane wastes skin/eye depth precision at meters.
      p[10]=-(far+near)/(far-near);p[14]=-2*far*near/(far-near);this.cb.projection(p);};
    const context=this.canvas.getContext('2d',{willReadFrequently:true})!;
    const process=()=>{if(!this.alive)return;context.fillStyle='black';context.fillRect(0,0,640,480);context.drawImage(this.video,(640-vw)/2,(480-vh)/2,vw,vh);const image=context.getImageData(0,0,640,480);worker.postMessage({type:'process',imagedata:image},[image.data.buffer]);};
    const relative=(url:URL)=>url.pathname.replace(/^\//,'');
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('NFT 초기화 45초 초과: 표적/보정 파일을 확인하세요')),45000);
      worker.onerror=()=>{clearTimeout(timer);reject(Error('NFT worker 오류'));this.cb.error('NFT worker 오류');};
      worker.onmessage=event=>{
        if(!this.alive)return;const data=event.data;
        if(data.type==='loaded'){
          projection=JSON.parse(data.proj) as number[];
          // Remove processing padding before the shared display's contain fit.
          for(const i of [0,4,8,12])projection[i]*=640/vw;
          for(const i of [1,5,9,13])projection[i]*=480/vh;project();
        }else if(data.type==='markerInfos'){
          const info=JSON.parse(data.marker);this.iw=info.width/info.dpi*25.4;this.ih=info.height/info.dpi*25.4;this.units=this.iw/this.target.widthMeters;
          project();
          if(!Number.isFinite(this.units)||this.units<=0){clearTimeout(timer);reject(Error('NFT 표적 단위 오류'));}
        }else if(data.type==='endLoading'){
          clearTimeout(timer);this.cb.ready();resolve();process();
        }else if(data.type==='found'||data.type==='not found'){
          const raw=data.type==='found'?JSON.parse(data.matrix) as number[]:null;
          // AR.js applies Ry(pi)*Rz(pi) to ARToolKit's camera (+Y down,+Z
          // forward). Rx(pi) is the same conversion to Three.js camera space.
          const cameraSpace=raw?new Matrix4().makeRotationX(Math.PI).multiply(new Matrix4().fromArray(raw)).elements:null;
          this.cb.pose(cameraSpace?canonicalImagePose(cameraSpace,this.iw,this.ih,this.units):null);
          // One frame in flight; no stale camera frame queue.
          this.scheduled=requestAnimationFrame(process);
        }
      };
      worker.postMessage({type:'init',pw:640,ph:480,marker:relative(new URL('building',this.base)),param:relative(new URL('camera_para.dat',this.base))});
    });
  }
  dispose():void{this.alive=false;cancelAnimationFrame(this.scheduled);this.worker?.terminate();}
}
