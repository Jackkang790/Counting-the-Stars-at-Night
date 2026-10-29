import * as THREE from "three";
import type { ActorConfig, PerformerRenderer, VideoMode } from "./types";
import { actorOpacity, mediaTime } from "./timeline";

const vertexShader = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const fragmentShader = `
uniform sampler2D videoMap; uniform float opacity; uniform float texelX; uniform int mode; varying vec2 vUv;
void main(){
  vec4 c = texture2D(videoMap, mode==0 ? vec2(clamp(vUv.x*0.5,texelX*0.5,0.5-texelX*0.5),vUv.y) : vUv);
  float a = c.a;
  if(mode==0) a=texture2D(videoMap,vec2(clamp(0.5+vUv.x*0.5,0.5+texelX*0.5,1.0-texelX*0.5),vUv.y)).r;
  if(mode==2){ float green=c.g-max(c.r,c.b); a=1.0-smoothstep(0.08,0.25,green); c.g=min(c.g,max(c.r,c.b)+0.08); }
  if(a*opacity<0.015) discard;
  c.rgb=mix(c.rgb/12.92,pow((c.rgb+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c.rgb));
  gl_FragColor=vec4(c.rgb,a*opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Flat recorded humans, never a camera-facing HUD. Future volumetric renderers use the same interface. */
export class VideoPerformer implements PerformerRenderer {
  readonly representation = "spatial-video-plane" as const;
  readonly contentKind = "video" as const;
  readonly group = new THREE.Group();
  readonly video = document.createElement("video");
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly placeholder: THREE.Mesh;
  loaded = false;
  private url?: string;
  private texture?: THREE.VideoTexture;
  private generation = 0;
  private lastSync = -1;
  private playPending = false;
  private stalledAt = 0;
  private priming = false;

  constructor(readonly config: ActorConfig, private readonly onError: (message: string) => void) {
    this.group.name = config.id;
    this.video.muted = true; this.video.playsInline = true; this.video.preload = "auto"; this.video.loop = false;
    this.video.setAttribute("playsinline", ""); this.video.setAttribute("webkit-playsinline", "");
    this.video.addEventListener("error", () => { if (this.loaded) this.onError(`${config.label} 영상 디코딩 실패`); });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(config.width, config.height), new THREE.ShaderMaterial({
      uniforms: { videoMap: { value: null }, opacity: { value: 0 }, texelX: { value: 0.001 }, mode: { value: 0 } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.mesh.position.y = config.height / 2; this.mesh.rotation.y = Math.PI; this.group.add(this.mesh);
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(14,20,27,.7)"; ctx.fillRect(0, 0, 320, 480);
    ctx.strokeStyle = "#f6cb83"; ctx.lineWidth = 6; ctx.strokeRect(5, 5, 310, 470);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(config.label, 160, 185); ctx.font = "23px sans-serif"; ctx.fillText("실사 영상 대기", 160, 240); ctx.fillText("교체용 테스트 카드", 160, 280);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.placeholder = new THREE.Mesh(new THREE.PlaneGeometry(config.width, config.height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.placeholder.position.y = config.height / 2; this.placeholder.rotation.y = Math.PI; this.group.add(this.placeholder); this.applyTransform();
  }
  applyTransform(): void {
    this.group.position.fromArray(this.config.position);
    this.group.rotation.set(...this.config.rotation);
    this.group.scale.setScalar(1);
  }
  async load(file: File, mode: VideoMode): Promise<void> {
    const generation = ++this.generation; this.loaded = false; this.pause();
    if (this.url) URL.revokeObjectURL(this.url);
    this.texture?.dispose(); this.texture = undefined;
    if (file.type && !this.video.canPlayType(file.type)) throw new Error(`${file.type} 형식을 이 브라우저에서 재생할 수 없습니다. H.264 MP4를 사용하세요.`);
    this.url = URL.createObjectURL(file); this.video.src = this.url; this.video.load();
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.video.removeEventListener("loadeddata", ready); this.video.removeEventListener("error", failed); };
      const ready = () => { cleanup(); resolve(); }; const failed = () => { cleanup(); reject(new Error(`${this.config.label} 영상 로드 실패`)); };
      const timer = window.setTimeout(() => { cleanup(); reject(new Error("영상 로드 시간 초과")); }, 20000);
      this.video.addEventListener("loadeddata", ready); this.video.addEventListener("error", failed);
    });
    if (generation !== this.generation) return;
    if (!Number.isFinite(this.video.duration) || this.video.duration <= 0) throw new Error("길이를 확인할 수 있는 녹화 영상이 필요합니다.");
    this.config.mode = mode; this.texture = new THREE.VideoTexture(this.video); this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh.material.uniforms.videoMap.value = this.texture;
    this.mesh.material.uniforms.texelX.value = 1 / this.video.videoWidth;
    this.mesh.material.uniforms.mode.value = mode === "packed" ? 0 : mode === "alpha" ? 1 : 2;
    this.loaded = true; this.lastSync = -1;
  }
  async prime(): Promise<void> {
    if (!this.loaded) return;
    let timer = 0; this.priming = true;
    try { await Promise.race([this.video.play(), new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(`${this.config.label} 재생 준비 시간 초과`)), 8000); })]); }
    finally { clearTimeout(timer); this.video.pause(); this.priming = false; }
  }
  sample(time: number, playing: boolean): void {
    const alpha = actorOpacity(this.config, time);
    this.group.visible = alpha > 0;
    this.placeholder.visible = !this.loaded; this.mesh.visible = this.loaded;
    (this.placeholder.material as THREE.MeshBasicMaterial).opacity = alpha;
    this.mesh.material.uniforms.opacity.value = alpha;
    if (!this.loaded) return;
    // A pending play() must decode its first frame. Pausing it from the RAF rejects it on replay.
    if (this.priming) return;
    if (playing && alpha > 0 && this.video.readyState < 2) {
      if (!this.stalledAt) this.stalledAt = performance.now();
      else if (performance.now() - this.stalledAt > 1200) { this.stalledAt = 0; this.onError(`${this.config.label} 영상이 지연되어 공연을 멈췄습니다. 준비 후 재개하세요.`); }
      return;
    }
    this.stalledAt = 0;
    if (alpha === 0 || !playing) this.video.pause();
    if (this.lastSync < 0 || Math.abs(time - this.lastSync) >= 0.25 || !playing) {
      const target = mediaTime(this.config, time, this.video.duration);
      if (!this.video.seeking && Math.abs(this.video.currentTime - target) > 0.12) this.video.currentTime = target;
      this.lastSync = time;
    }
    if (playing && alpha > 0 && this.video.paused && !this.playPending) {
      this.playPending = true;
      void this.video.play().catch(e => { if (this.loaded && !(e instanceof DOMException && e.name === "AbortError")) this.onError(`${this.config.label} 재생 거부: ${String(e)}`); }).finally(() => { this.playPending = false; });
    }
  }
  pause(): void { this.video.pause(); }
  dispose(): void {
    this.generation++; this.pause(); this.video.removeAttribute("src"); this.video.load(); this.texture?.dispose();
    if (this.url) URL.revokeObjectURL(this.url);
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.placeholder.geometry.dispose();
    const material = this.placeholder.material as THREE.MeshBasicMaterial; material.map?.dispose(); material.dispose();
  }
}
