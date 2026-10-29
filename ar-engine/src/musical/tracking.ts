import * as THREE from "three";
import { PlacementGroup } from "../core/placement";
import { Reticle } from "../core/reticle";
import type { BuildingConfig } from "./types";
import type { Controller } from "./vendor/mindar-image.prod.js";

export interface TrackingHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly tracked: boolean;
  start(): Promise<void>;
  dispose(): void;
  capture(): Promise<Blob>;
}
export type TrackingCallbacks = { frame: () => void; tracking: (tracked: boolean) => void; error: (message: string) => void; ended: () => void };

function setup(container: HTMLElement, content: THREE.Object3D) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(container.clientWidth, container.clientHeight); container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.add(content, new THREE.HemisphereLight(0xfff4e2, 0x39485a, 2.3));
  const light = new THREE.DirectionalLight(0xffffff, 1.3); light.position.set(0, 4, -5); scene.add(light);
  return { renderer, scene, camera: new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 100) };
}

export class ImageTrackingHost implements TrackingHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly video = document.createElement("video");
  private readonly anchor = new THREE.Group();
  private controller?: Controller;
  private stream?: MediaStream;
  private alive = true;
  private found = false;
  private lastPose = 0;
  private dimensions?: [number, number];
  private readonly resizeObserver: ResizeObserver;
  get tracked(): boolean { return this.found; }

  constructor(private readonly container: HTMLElement, content: THREE.Object3D, private readonly target: Uint8Array, private readonly building: BuildingConfig, private readonly callbacks: TrackingCallbacks) {
    const origin = new THREE.Group(); origin.position.fromArray(building.target.center).multiplyScalar(-1); origin.add(content);
    this.anchor.matrixAutoUpdate = false; this.anchor.visible = false; this.anchor.add(origin);
    ({ renderer: this.renderer, scene: this.scene, camera: this.camera } = setup(container, this.anchor));
    this.video.muted = true; this.video.playsInline = true; this.video.autoplay = true;
    this.video.setAttribute("playsinline", ""); this.video.className = "musical-camera"; container.prepend(this.video);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
  }
  async start(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("카메라 AR에는 HTTPS 또는 localhost가 필요합니다. iPhone은 Safari로 열어 주세요.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment", width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
    if (!this.alive) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream; this.video.srcObject = stream;
    await this.video.play();
    if (!this.video.videoWidth) await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("카메라 준비 시간 초과")), 15000);
      this.video.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    if (!this.alive) return;
    this.video.width = this.video.videoWidth; this.video.height = this.video.videoHeight;
    const { Controller: ControllerClass } = await import("./vendor/mindar-image.prod.js");
    if (!this.alive) return;
    this.controller = new ControllerClass({ inputWidth: this.video.videoWidth, inputHeight: this.video.videoHeight, maxTrack: 1, warmupTolerance: 2, missTolerance: 2, filterMinCF: 0.001, filterBeta: 1000,
      onUpdate: data => {
        if (!this.alive || data.type !== "updateMatrix" || !this.dimensions) return;
        if (data.worldMatrix && data.worldMatrix.length === 16 && data.worldMatrix.every(Number.isFinite)) {
          const [w, h] = this.dimensions;
          // MindAR has pixel units and +Z toward viewer. Adapt to existing meter/Y-up/-Z-front stage.
          const post = new THREE.Matrix4().makeTranslation(w / 2, h / 2, 0);
          post.scale(new THREE.Vector3(w / this.building.target.widthMeters, w / this.building.target.widthMeters, w / this.building.target.widthMeters));
          post.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
          this.anchor.matrix.fromArray(data.worldMatrix).multiply(post); this.anchor.matrixWorldNeedsUpdate = true;
          this.lastPose = performance.now(); this.setFound(true);
        } else this.setFound(false);
      } });
    const bytes = this.target.buffer.slice(this.target.byteOffset, this.target.byteOffset + this.target.byteLength) as ArrayBuffer;
    this.dimensions = this.controller.addImageTargetsFromBuffer(bytes).dimensions[0];
    if (!this.dimensions) throw new Error("표적 데이터가 비어 있습니다.");
    this.controller.worker.addEventListener("error", () => { this.setFound(false); this.callbacks.error("이미지 추적 작업이 중단됐습니다. 종료 후 다시 시작하세요."); });
    this.resize(); await this.controller.dummyRun(this.video);
    if (!this.alive) return;
    this.controller.processVideo(this.video);
    this.renderer.setAnimationLoop(() => {
      if (performance.now() - this.lastPose > 650) this.setFound(false);
      this.callbacks.frame(); this.renderer.render(this.scene, this.camera);
    });
  }
  private setFound(found: boolean): void {
    this.anchor.visible = found;
    if (this.found !== found) { this.found = found; this.callbacks.tracking(found); }
  }
  private resize(): void {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    if (!this.controller || !this.video.videoWidth) return;
    const scale = Math.max(width / this.video.videoWidth, height / this.video.videoHeight);
    this.camera.projectionMatrix.fromArray(this.controller.getProjectionMatrix());
    this.camera.projectionMatrix.elements[0] *= this.video.videoWidth * scale / width;
    this.camera.projectionMatrix.elements[5] *= this.video.videoHeight * scale / height;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }
  async capture(): Promise<Blob> {
    if (!this.found) throw new Error("표적을 인식한 상태에서 촬영하세요.");
    // Both layers use the identical CSS cover crop; this is image-pose AR, not an untracked overlay.
    const canvas = document.createElement("canvas"), width = this.container.clientWidth, height = this.container.clientHeight;
    const scale = Math.min(1, 1280 / Math.max(width, height)); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d")!, cover = Math.max(canvas.width / this.video.videoWidth, canvas.height / this.video.videoHeight);
    const vw = this.video.videoWidth * cover, vh = this.video.videoHeight * cover;
    ctx.drawImage(this.video, (canvas.width - vw) / 2, (canvas.height - vh) / 2, vw, vh);
    this.renderer.render(this.scene, this.camera); ctx.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("사진 생성 실패")), "image/png"));
  }
  dispose(): void {
    this.alive = false; this.renderer.setAnimationLoop(null); this.resizeObserver.disconnect(); this.setFound(false);
    this.controller?.dispose();
    // Let an in-flight worker response settle before terminating the dedicated worker.
    const worker = this.controller?.worker; if (worker) window.setTimeout(() => worker.terminate(), 150);
    this.stream?.getTracks().forEach(t => t.stop()); this.video.srcObject = null; this.video.remove();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

export class WebXRTrackingHost implements TrackingHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private readonly placement = new PlacementGroup();
  private readonly reticle = new Reticle();
  private session?: XRSession;
  private reference?: XRReferenceSpace;
  private hit?: XRHitTestSource;
  private found = false;
  private alive = true;
  get tracked(): boolean { return this.found; }
  constructor(private readonly overlay: HTMLElement, container: HTMLElement, content: THREE.Object3D, private readonly callbacks: TrackingCallbacks) {
    this.placement.attach(content); ({ renderer: this.renderer, scene: this.scene, camera: this.camera } = setup(container, this.placement.group));
    this.renderer.xr.enabled = true; this.scene.add(this.reticle.mesh);
    const controller = this.renderer.xr.getController(0); this.scene.add(controller);
    controller.addEventListener("select", () => {
      if (!this.placement.isPlaced && this.reticle.visible) { this.placement.placeAt(this.reticle.mesh.matrix.elements, true); this.reticle.hide(); }
    });
  }
  async start(): Promise<void> {
    // First gated call runs before any await. No changes to the existing AREngine session path.
    if (!navigator.xr) throw new Error("이 브라우저는 WebXR을 지원하지 않습니다. 공통 이미지 추적을 선택하세요.");
    const session = await navigator.xr.requestSession("immersive-ar", { requiredFeatures: ["hit-test", "dom-overlay"], optionalFeatures: ["local-floor"], domOverlay: { root: this.overlay } });
    this.session = session;
    if (!this.alive) { await session.end(); return; }
    session.addEventListener("end", () => { this.found = false; this.placement.group.visible = false; this.callbacks.tracking(false); this.callbacks.ended(); }, { once: true });
    let type: XRReferenceSpaceType = "local";
    try { await session.requestReferenceSpace("local-floor"); type = "local-floor"; } catch { /* local is the existing engine's fallback */ }
    this.renderer.xr.setReferenceSpaceType(type); await this.renderer.xr.setSession(session);
    this.reference = this.renderer.xr.getReferenceSpace() ?? undefined;
    const viewer = await session.requestReferenceSpace("viewer"); this.hit = await session.requestHitTestSource?.({ space: viewer });
    if (!this.reference || !this.hit) throw new Error("공간 참조 또는 hit-test를 사용할 수 없습니다.");
    this.renderer.setAnimationLoop((_time, frame?: XRFrame) => {
      if (frame && this.reference) {
        const tracked = !!frame.getViewerPose(this.reference) && this.placement.isPlaced;
        this.placement.group.visible = tracked;
        if (tracked !== this.found) { this.found = tracked; this.callbacks.tracking(tracked); }
        if (!this.placement.isPlaced && this.hit) {
          const pose = frame.getHitTestResults(this.hit)[0]?.getPose(this.reference);
          if (pose) this.reticle.updateFromMatrix(pose.transform.matrix); else this.reticle.hide();
        }
      }
      this.callbacks.frame(); this.renderer.render(this.scene, this.camera);
    });
  }
  async capture(): Promise<Blob> { throw new Error("WebXR 경로는 OS 스크린샷을 사용하세요. 실경 없는 캔버스를 사진으로 저장하지 않습니다."); }
  dispose(): void {
    this.alive = false; this.renderer.setAnimationLoop(null); this.hit?.cancel();
    void this.session?.end().catch(() => {}); this.renderer.dispose(); this.renderer.domElement.remove();
    this.reticle.mesh.geometry.dispose(); (this.reticle.mesh.material as THREE.Material).dispose();
  }
}
