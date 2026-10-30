import * as THREE from "three";
import { PlacementGroup } from "../core/placement";
import { FloorPlacementGuide } from "./floorGuide";
import type { TrackingHost, TrackingCallbacks } from "./tracking";
import { placementIssue,type PlacementPolicy } from "./placementPolicy";
import { fitFloorStage } from "./stageFit";
import { manualStagePose } from "./manualPlacement";

type Hit = { type: string; position: { x: number; y: number; z: number }; distance: number };
type Reality = { trackingStatus: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number }; intrinsics: number[] };
interface XR8SDK {
  loadChunk(name: string): Promise<void>;
  addCameraPipelineModules(modules: unknown[]): void;
  removeCameraPipelineModules(names: string[]): void;
  run(config: Record<string, unknown>): Promise<void> | void;
  stop(): void; pause(): void; resume(): void;
  XrConfig: { device(): { MOBILE: string }; camera(): { BACK: string } };
  XrController: { configure(config: Record<string, unknown>): void; pipelineModule(): unknown; hitTest(x: number, y: number, types?: string[]): Hit[]; updateCameraProjectionMatrix(config: Record<string, unknown>): void };
  GlTextureRenderer: { pipelineModule(): unknown };
  Threejs: { pipelineModule(): unknown; configure(config: Record<string, unknown>): void; xrScene(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } };
}
declare global { interface Window { XR8?: XR8SDK; THREE?: typeof THREE } }
let sdkLoad: Promise<XR8SDK> | undefined;
export function loadWorldSDK(): Promise<XR8SDK> {
  if (sdkLoad) return sdkLoad;
  sdkLoad = new Promise<XR8SDK>((resolve,reject) => {
    window.THREE = THREE;
    const timer = window.setTimeout(() => reject(new Error("공간 추적 엔진 로딩 시간 초과. 네트워크를 확인하고 새로고침하세요.")),60000);
    const ready = () => { if (window.XR8) { clearTimeout(timer); resolve(window.XR8); } };
    if (window.XR8) { ready(); return; }
    window.addEventListener("xrloaded",ready,{once:true});
    const script = document.createElement("script");
    script.src = `${import.meta.env.BASE_URL}xr8/xr.js`; script.async = true; script.dataset.preloadChunks = "slam";
    script.onerror = () => { clearTimeout(timer); reject(new Error("공간 추적 엔진을 내려받지 못했습니다.")); };
    document.head.appendChild(script);
  }).then(async sdk => { await sdk.loadChunk("slam"); return sdk; });
  return sdkLoad;
}

/** 6DoF SLAM. Both measured-point and explicit estimated placement store a world
 * transform once. Neither follows the camera; estimates are labelled as such. */
export class WorldTrackingHost implements TrackingHost {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  private readonly placement = new PlacementGroup();
  private readonly guide:FloorPlacementGuide;
  private candidate?:Hit;
  private lastProbe=0;
  private readonly canvas = document.createElement("canvas");
  private sdk?: XR8SDK;
  private alive = true;
  private normal = false;
  private lastPose = 0;
  private found = false;
  private resizeObserver: ResizeObserver;
  private startReject?: (reason: Error) => void;
  private readonly watchdog: number;
  get tracked(): boolean { return this.found; }
  get canPlaceManually():boolean{return this.alive&&this.normal&&!document.hidden&&!this.placement.isPlaced&&performance.now()-this.lastPose<700;}
  placeManually(distance:number):boolean{if(!this.canPlaceManually)return false;return this.placeCandidate(manualStagePose(this.camera,distance),performance.now(),'manual');}
  constructor(private readonly root: HTMLElement, private readonly container: HTMLElement, content: THREE.Object3D, private readonly callbacks: TrackingCallbacks, private readonly policy?:PlacementPolicy) {
    this.guide=new FloorPlacementGuide(container,(matrix,time)=>{this.placeCandidate(matrix,time);},policy?.stageWidthMeters,policy?.requireGround!==false);
    this.placement.attach(content); this.placement.reset(); this.canvas.id = "musical-world-camera"; container.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
    this.canvas.addEventListener("pointerup",this.place);
    document.addEventListener("visibilitychange",this.visibility);
    this.watchdog = window.setInterval(() => {
      if (performance.now()-this.lastPose > 700) { this.normal = false; this.setFound(false); this.canvas.style.visibility = "hidden"; this.guide.hide();this.root.dataset.placementReady='false'; }
    },250);
  }
  private resize(): void {
    const ratio = Math.min(2,devicePixelRatio || 1);
    this.canvas.width = Math.round(this.container.clientWidth*ratio); this.canvas.height = Math.round(this.container.clientHeight*ratio);
  }
  async start(): Promise<void> {
    if (!isSecureContext) throw new Error("공간 AR은 HTTPS 연결이 필요합니다.");
    const permissions = [window.DeviceMotionEvent,window.DeviceOrientationEvent] as unknown as Array<{requestPermission?: () => Promise<string>} | undefined>;
    const grants = permissions.filter(p => p?.requestPermission).map(p => p!.requestPermission!());
    if ((await Promise.all(grants)).some(value => value !== "granted")) throw new Error("공간 추적에는 동작 센서 권한이 필요합니다. Safari에서 허용한 뒤 다시 시작하세요.");
    const sdk = this.sdk = await loadWorldSDK(); if (!this.alive) return;
    sdk.XrController.configure({disableWorldTracking:false,scale:"absolute",enableWorldPoints:true});
    sdk.Threejs.configure({renderCameraTexture:true}); this.resize();
    await new Promise<void>((resolve,reject) => {
      this.startReject = reject;
      const timer = window.setTimeout(() => reject(new Error("카메라 시작 시간 초과. Safari의 카메라·동작 센서 권한을 확인하세요.")),45000);
      sdk.addCameraPipelineModules([
        sdk.XrController.pipelineModule(),sdk.GlTextureRenderer.pipelineModule(),sdk.Threejs.pipelineModule(),
        { name:"musical-world-stage",
          onStart: () => {
            if (!this.alive) return;
            ({renderer:this.renderer,scene:this.scene,camera:this.camera} = sdk.Threejs.xrScene());
            this.scene.add(this.placement.group,this.guide.mesh,new THREE.HemisphereLight(0xfff4e2,0x39485a,2.3));
            const light = new THREE.DirectionalLight(0xffffff,1.3); light.position.set(0,4,-5); this.scene.add(light);
            this.camera.position.set(0,1.5,0);
            sdk.XrController.updateCameraProjectionMatrix({origin:this.camera.position,facing:this.camera.quaternion});
            clearTimeout(timer); this.startReject = undefined; resolve();
          },
          onUpdate: ({processCpuResult}: { processCpuResult: { reality?: Reality } }) => {
            if (!this.alive) return;
            const pose = processCpuResult?.reality;
            this.canvas.style.visibility = "";
            const valid = !!pose && pose.trackingStatus === "NORMAL" && Object.values(pose.position).every(Number.isFinite) && Object.values(pose.rotation).every(Number.isFinite);
            if (valid) this.lastPose = performance.now();
            this.normal = valid && !document.hidden && performance.now()-this.lastPose < 700;
            this.root.dataset.worldTracking = this.normal ? "normal" : "limited";
            this.setFound(this.normal && this.placement.isPlaced);
            if (!this.placement.isPlaced && this.normal) {
              const now=performance.now();
              if(now-this.lastProbe>120){
                this.lastProbe=now;this.candidate=undefined;
                const samples=this.policy?.requireGround===false?[[.5,.5],[.35,.5],[.65,.5],[.5,.65],[.35,.65],[.65,.65],[.5,.35],[.35,.35],[.65,.35]]:[[.5,.65],[.35,.65],[.65,.65],[.5,.8],[.5,.5]];
                for(const [x,y] of samples){
                  const hit=this.hit(x,y);if(hit){this.candidate={...hit,position:{...hit.position}};break;}
                }
              }
              const hit=this.candidate;
              if(hit){
                const matrix=this.matrix(hit);
                const ready=this.guide.show(matrix,this.camera,now,fitFloorStage(matrix,this.camera,this.policy?.stageWidthMeters),this.callbacks.canPlace?.()??true);
                this.root.dataset.placementReady=String(ready);
                this.root.dataset.placementHint=ready?'노란 표시를 누르거나 직접 놓기를 선택하세요':this.policy?.requireGround===false?'다른 지점을 비추거나 직접 놓기를 선택하세요':'바닥 쪽으로 조금 더 비춰 주세요';
              }else{this.guide.searching();this.root.dataset.placementReady='false';}
            }else{
              this.guide.hide();this.root.dataset.placementReady='false';
              if(!this.placement.isPlaced)this.guide.searching();
            }
            this.callbacks.frame();
          },
          onException: (error: unknown) => { clearTimeout(timer); const e = new Error(String(error)); this.startReject?.(e); this.setFound(false); this.callbacks.error(e.message); },
        },
      ]);
      try { Promise.resolve(sdk.run({canvas:this.canvas,webgl2:true,allowedDevices:sdk.XrConfig.device().MOBILE,cameraConfig:{direction:sdk.XrConfig.camera().BACK},glContextConfig:{alpha:false,preserveDrawingBuffer:true}})).catch(reject); }
      catch (e) { clearTimeout(timer); reject(e); }
    });
  }
  private hit(x: number,y: number): Hit | undefined {
    const hits = this.sdk?.XrController.hitTest(x,y,["FEATURE_POINT"]) ?? [];
    let issue:string|null=null;
    const valid=hits.filter(h=>{
      if(![h.position.x,h.position.y,h.position.z,h.distance].every(Number.isFinite)||h.distance<=.15||h.distance>=15)return false;
      if(this.policy){const error=placementIssue(this.camera.position,h.position,this.policy);if(error){issue=error;return false;}}return true;
    }).sort((a,b)=>a.distance-b.distance);
    if(this.policy)this.root.dataset.placementHint=valid.length?"노란 무대 표시를 눌러 주세요":issue??"벽·탁자·주변 공간을 비추거나 직접 놓기를 선택하세요";
    return valid[0];
  }
  private matrix(hit: Hit): THREE.Matrix4 {
    const p = new THREE.Vector3(hit.position.x,hit.position.y,hit.position.z), toward = this.camera.position.clone().sub(p);
    const yaw = Math.atan2(-toward.x,-toward.z);
    return new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1));
  }
  private place = (event: PointerEvent): void => {
    if (!this.alive || !this.normal || this.placement.isPlaced || performance.now()-this.lastPose > 700) return;
    if(this.guide.selectAt(event.clientX,event.clientY,this.camera))return;
    // Quartet placement is limited to the highlighted pad/button. Tapping an
    // unrelated wall or an invisible feature must not move the stage elsewhere.
    if(this.policy)return;
    const rect = this.canvas.getBoundingClientRect(), hit = this.hit((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);
    if (!hit) { if(!this.policy)this.root.dataset.placementHint = "바닥 특징점을 아직 찾지 못했습니다. 바닥을 천천히 비추고 다시 탭하세요."; return; }
    this.placeCandidate(this.matrix(hit),performance.now());
  };
  private placeCandidate(matrix:THREE.Matrix4,time:number,method='point'):boolean{
    if(!this.alive||!this.normal||this.placement.isPlaced||performance.now()-this.lastPose>700||performance.now()-time>700)return false;
    if(this.callbacks.canPlace&&!this.callbacks.canPlace())return false;
    const point=new THREE.Vector3().setFromMatrixPosition(matrix);
    if(this.policy&&placementIssue(this.camera.position,point,this.policy))return false;
    const scale=fitFloorStage(matrix,this.camera,this.policy?.stageWidthMeters);
    this.placement.setUniformScale(scale);this.placement.placeAt(matrix.elements,true);
    this.root.dataset.stageScale=scale.toFixed(3);this.root.dataset.placementReady='false';
    this.root.dataset.stageScaleExact=String(scale);
    this.root.dataset.placementMethod=method;
    this.guide.hide();this.setFound(true);this.callbacks.placed?.();return true;
  }
  private setFound(value: boolean): void {
    this.placement.group.visible = value;
    if (this.found !== value) { this.found = value; this.callbacks.tracking(value); }
  }
  reposition():void{this.setFound(false);this.placement.reset();this.candidate=undefined;this.lastProbe=0;delete this.root.dataset.placementMethod;this.guide.searching();this.root.dataset.placementHint="새 표시를 누르거나 직접 놓기를 선택하세요";}
  private visibility = (): void => {
    if (!this.sdk || !this.alive) return;
    this.normal = false; this.setFound(false);
    this.guide.hide();this.root.dataset.placementReady='false';
    if (document.hidden) this.sdk.pause(); else this.sdk.resume();
  };
  async capture(): Promise<Blob> {
    if (!this.tracked || performance.now()-this.lastPose > 700 || document.hidden) throw new Error("무대를 배치하고 공간 추적 중에 촬영하세요.");
    // The SDK draws the real camera and Three.js into this same WebGL canvas.
    return new Promise((resolve,reject) => this.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("사진 생성 실패")),"image/png"));
  }
  dispose(): void {
    this.alive = false; this.setFound(false); this.startReject?.(new Error("공간 AR 시작을 취소했습니다."));
    clearInterval(this.watchdog);
    this.resizeObserver.disconnect(); this.canvas.removeEventListener("pointerup",this.place); document.removeEventListener("visibilitychange",this.visibility);
    this.sdk?.stop(); this.sdk?.removeCameraPipelineModules(["musical-world-stage"]); this.renderer?.dispose(); this.canvas.remove();
    this.guide.dispose();
  }
}
