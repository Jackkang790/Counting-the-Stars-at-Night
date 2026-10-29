export type PoseSample={t:number;p:number[];q:number[]};
export class TrialMetrics {
  readonly startedAt=new Date().toISOString();
  cameraReady:number|null=null;engineReady:number|null=null;firstPose:number|null=null;
  found=false;losses=0;reacquisitions:number[]=[];private lostAt:number|null=null;
  events:{type:string;t:number}[]=[];samples:PoseSample[]=[];
  stationary=false;droppedSamples=0;
  transition(found:boolean,now:number):void {
    if(this.found===found)return;this.found=found;
    if(found){if(this.firstPose===null)this.firstPose=now;else if(this.lostAt!==null)this.reacquisitions.push(now-this.lostAt);this.lostAt=null;}
    else {this.losses++;this.lostAt=now;this.stationary=false;}
    if(this.events.length<2000)this.events.push({type:found?'found':'lost',t:now});
  }
  sample(p:number[],q:number[],now:number):void {
    if(!this.stationary||!this.found)return;
    if(this.samples.length>=1200){this.droppedSamples++;return;}
    if(this.samples.length&&now-this.samples[this.samples.length-1].t<45)return;
    this.samples.push({t:now,p:[...p],q:[...q]});
  }
  beginStationary():void {this.samples=[];this.droppedSamples=0;this.stationary=this.found;}
  summary():Record<string,unknown> {
    const n=this.samples.length,mean=[0,0,0];for(const s of this.samples)for(let i=0;i<3;i++)mean[i]+=s.p[i]/n;
    let variance=0,angleVariance=0;const reference=this.samples[0]?.q;
    for(const s of this.samples){variance+=s.p.reduce((sum,v,i)=>sum+(v-mean[i])**2,0)/n;
      // Pose matrices can yield quaternions a few ULPs away from unit length.
      // Normalize the dot product so a fixed pose is not reported as jitter.
      const denominator=Math.hypot(...s.q)*Math.hypot(...reference);
      const dot=Math.min(1,Math.abs(s.q.reduce((sum,v,i)=>sum+v*reference[i],0))/denominator);angleVariance+=(2*Math.acos(dot))**2/n;}
    return {firstRecognitionFromCameraMs:this.firstPose!==null&&this.cameraReady!==null?this.firstPose-this.cameraReady:null,
      firstRecognitionFromEngineMs:this.firstPose!==null&&this.engineReady!==null?this.firstPose-this.engineReady:null,
      lossCount:this.losses,reacquisitionMs:this.reacquisitions,stationarySamples:n,
      translationRmsMeters:n>=10?Math.sqrt(variance):null,rotationRmsFromFirstDegrees:n>=10?Math.sqrt(angleVariance)*180/Math.PI:null,
      provisionalMetricScale:true,stationaryRequested:this.stationary,droppedSamples:this.droppedSamples,
      note:'정지 구간의 카메라 상대 포즈 변동. 카메라/피사체 움직임과 실제 정합 오차를 구분할 수 없음. 카메라를 고정해 비교해야 함.'};
  }
}
