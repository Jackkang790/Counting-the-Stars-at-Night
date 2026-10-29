// AR 엔진 오케스트레이션 — contracts/ar-api.md 구현.
// 1순위: Android Chrome / WebXR immersive-ar + hit-test. 미지원은 checkSupport로 안내.
import * as THREE from "three";
import type {
  ARExperience,
  ARExperienceEventMap,
  AREngineOptions,
  StartRequest,
  ARSupportReport,
  CalibrationDelta,
  LayerVisibility,
  ARDebugInfo,
} from "./types";
import { EventBus } from "./events";
import { checkSupport } from "./core/support";
import { collectDiagnostics, formatDiagnostics, describeSessionError } from "./core/diagnostics";
import { Reticle } from "./core/reticle";
import { PlacementGroup, type CalibrationState } from "./core/placement";
import { loadGLB } from "./loaders/gltf";
import {
  loadAssetManifest,
  loadCatalog,
  loadStandaloneManifest,
  findAsset,
  resolveExperience,
  type AssetEntry,
} from "./loaders/manifest";
import { EmergingArtworkScene } from "./scenes/emergingArtwork";
import { AlignmentScene } from "./scenes/alignmentScene";
import { buildPlaceholderArtwork } from "./scenes/placeholder";

const DEFAULT_MANIFEST_URL = "/models/asset-manifest.json";

// 배포 base 경로(GitHub Pages 서브경로 등) 대응 — 루트 절대 경로(/models/..)를 base 기준으로 해석.
// 매니페스트의 절대 url("/models/..")도 동일하게 정규화하므로 Codex 에셋 파일을 수정하지 않는다.
const BASE_URL: string = import.meta.env.BASE_URL || "/";
function withBase(url: string): string {
  if (!url.startsWith("/")) return url; // 상대/절대 URL은 그대로
  const b = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return b + url;
}

export class AREngine implements ARExperience {
  private readonly bus = new EventBus();
  private readonly options: AREngineOptions;

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private session?: XRSession;
  private refSpace?: XRReferenceSpace;
  private hitTestSource?: XRHitTestSource;
  private controller?: THREE.Group;

  private reticle = new Reticle();
  private placement = new PlacementGroup();
  private artwork?: EmergingArtworkScene;
  private alignment?: AlignmentScene;
  private calibKey = "";
  private alignInitialCalib?: CalibrationState;

  private request?: StartRequest;
  private assetId = "";
  private usedPlaceholder = false;
  private pendingPlaceMatrix?: number[];
  private experienceStartTime = 0;
  private completedEmitted = false;
  private clock = new THREE.Clock();

  // 런타임 텔레메트리 상태
  private telemFrames = 0;
  private lastTelemetryAt = 0;
  private viewerLostFrames = 0;
  private trackingLostEmitted = false;
  private reticleWasVisible = false;
  private readonly tmpVec = new THREE.Vector3();

  // 디버그(테스트 전용) 상태 — 지시 A/B/C.
  private readonly debug: boolean;
  private debugCube?: THREE.Object3D;
  private debugAxes?: THREE.AxesHelper;
  private debugBox?: THREE.Box3Helper;
  private debugMeshCount = 0;
  private readonly debugBoxSize = new THREE.Vector3();
  private readonly debugProjScreen = new THREE.Matrix4();
  private readonly debugFrustum = new THREE.Frustum();

  constructor(options: AREngineOptions = {}) {
    this.options = { mode: "geo", ...options };
    this.debug = this.options.debug ?? false;
  }

  checkSupport(): Promise<ARSupportReport> {
    return checkSupport();
  }

  async runDiagnostics(): Promise<unknown> {
    const d = await collectDiagnostics();
    console.info(formatDiagnostics(d));
    return d;
  }

  /**
   * iOS(AR Quick Look) 폴백용 USDZ 내보내기. WebXR 세션 없이 GLB만 로드해 USDZ 바이트로 변환한다.
   * (안드로이드 WebXR 경로와 완전히 분리 — iOS 전용 호출. 실제 GLB/매니페스트는 수정하지 않음.)
   */
  async exportExperienceUSDZ(req: StartRequest): Promise<Uint8Array> {
    const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
    let root: THREE.Object3D;
    if (req.overrides?.manifestUrl) {
      const man = await loadStandaloneManifest(withBase(req.overrides.manifestUrl));
      root = (await loadGLB(withBase(man.url))).root;
    } else {
      const assetId = await this.resolveAssetId(req);
      const manifest = await loadAssetManifest(withBase(this.options.assetManifestUrl ?? DEFAULT_MANIFEST_URL));
      const asset = findAsset(manifest, assetId);
      if (!asset?.url) throw new Error(`USDZ 내보내기: 에셋 URL을 찾지 못함 (assetId=${assetId})`);
      root = (await loadGLB(withBase(asset.url))).root;
    }
    root.updateWorldMatrix(true, true);
    const exporter = new USDZExporter();
    return exporter.parseAsync(root);
  }

  on<K extends keyof ARExperienceEventMap>(
    type: K,
    handler: (payload: ARExperienceEventMap[K]) => void
  ): () => void {
    return this.bus.on(type, handler);
  }
  off<K extends keyof ARExperienceEventMap>(
    type: K,
    handler: (payload: ARExperienceEventMap[K]) => void
  ): void {
    this.bus.off(type, handler);
  }

  async start(req: StartRequest): Promise<void> {
    this.request = req;
    this.completedEmitted = false;

    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr) {
      const report = await checkSupport();
      console.error(formatDiagnostics(await collectDiagnostics()));
      this.emitError("no-webxr", report.guidanceMessage, false);
      throw new Error(report.guidanceMessage);
    }

    // 사용자 제스처(클릭) 활성화를 소비하지 않도록 세션 요청을 먼저 수행한다.
    const root = this.options.container ?? document.body;
    let session: XRSession;
    try {
      session = await xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        // 'local-floor'는 선택 기능으로만 요청 → 미지원 기기에서도 세션 자체는 성립.
        optionalFeatures: ["dom-overlay", "light-estimation", "anchors", "local-floor"],
        domOverlay: { root },
      });
    } catch (err) {
      // 실패 원인을 상세 진단 로그로 드러낸다(가짜 성공으로 감추지 않음).
      const { code, message } = describeSessionError(err);
      console.error(`[ar-engine] 세션 시작 실패 [${code}]: ${message}`);
      console.error(formatDiagnostics(await collectDiagnostics()));
      this.emitError(code, message, false);
      throw err instanceof Error ? err : new Error(message);
    }
    this.session = session;

    this.setupThree(root);

    // 월드(world) 참조 공간: three.js setSession 이 내부적으로 requestReferenceSpace 를
    // 호출하므로 반드시 setSession '이전에' 타입을 확정한다. three.js 기본값은 'local-floor'
    // 인데 이는 선택 공간이라 일부 기기에서 거부된다 → 'local'(immersive 보장) 기준 + 폴백.
    let worldType: XRReferenceSpaceType;
    try {
      worldType = await this.selectWorldReferenceSpace(session);
      this.renderer!.xr.setReferenceSpaceType(worldType);
      await this.renderer!.xr.setSession(session);
      this.refSpace = this.renderer!.xr.getReferenceSpace() ?? undefined;
      if (!this.refSpace) throw new Error(`'${worldType}' 참조 공간 생성 결과가 비어 있습니다`);
    } catch (err) {
      await this.failReferenceSpaceInit(session, "world(local-floor→local)", err);
      throw err instanceof Error ? err : new Error(String(err));
    }
    this.bus.emit("sessionStarted", undefined);
    if (this.debug) {
      this.bus.emit(
        "info",
        `DEBUG XR: enabled=${this.renderer!.xr.enabled} isPresenting=${this.renderer!.xr.isPresenting} ` +
          `referenceSpace=${worldType}`
      );
    }

    // hit-test 전용 'viewer' 참조 공간은 월드 공간과 분리해 관리한다(지시 #5).
    // (월드 공간이 local/local-floor 중 무엇이든 hit-test 결과는 refSpace 기준으로 해석되어
    //  배치 좌표계가 일관되게 유지된다 — 지시 #7.)
    let hitSource: XRHitTestSource | undefined;
    try {
      const viewerSpace = await session.requestReferenceSpace("viewer");
      this.bus.emit("info", "참조 공간 확보: 'viewer' (hit-test 전용)");
      hitSource = await session.requestHitTestSource?.({ space: viewerSpace });
    } catch (err) {
      await this.failReferenceSpaceInit(session, "viewer", err);
      throw err instanceof Error ? err : new Error(String(err));
    }
    if (!hitSource) {
      this.emitError("no-hit-test", "이 기기에서 바닥 인식(hit-test)을 사용할 수 없습니다.", false);
      this.teardownAfterFailedInit();
      try {
        await session.end();
      } catch {
        /* 이미 종료됨 */
      }
      this.session = undefined;
      this.bus.emit("sessionEnded", undefined);
      throw new Error("hit-test unavailable");
    }
    this.hitTestSource = hitSource;

    session.addEventListener("end", this.onSessionEnd);

    this.experienceStartTime = performance.now();
    this.clock.start();
    this.lastTelemetryAt = performance.now();
    this.telemFrames = 0;
    this.renderer!.setAnimationLoop(this.onFrame);

    // 에셋 로드(세션 초기화와 병렬). 완료되면 배치 가능.
    void this.loadExperienceAsset(req);
  }

  async stop(): Promise<void> {
    if (this.session) {
      try {
        await this.session.end();
      } catch {
        /* 이미 종료됨 */
      }
    }
  }

  // ---- 장면 제어(후속 장면에서 확장) ----
  setTimePhase(_value: number): void {
    // building_stage 전용. 현재 프로토타입(emergent-artwork)에서는 미사용.
    console.warn("[ar-engine] setTimePhase: building_stage 장면에서 구현 예정");
  }
  advanceScene(): void {
    console.warn("[ar-engine] advanceScene: roleplay_scene 장면에서 구현 예정");
  }
  recenter(): void {
    this.placement.reset();
    this.pendingPlaceMatrix = undefined;
    this.completedEmitted = false;
    if (this.artwork) {
      // 간단한 재배치: 기존 장면 제거 후 다시 로드하지 않고 숨김 상태로 되돌린다.
      this.placement.group.visible = false;
    }
  }

  /** 작품 퇴장(Disappear) 재생 후 재배치 가능 상태로 복귀. */
  dismiss(): void {
    if (!this.artwork || !this.placement.isPlaced) return;
    this.artwork.dismiss(() => {
      this.placement.reset();
      this.completedEmitted = false;
      // 다음 탭에서 다시 배치/등장 가능.
    });
  }

  // ---- 건물 정합(alignment) 제어 ----
  setLayerVisible(node: string, visible: boolean): void {
    if (!this.alignment) return;
    this.alignment.setLayerVisible(node, visible);
  }
  getLayers(): LayerVisibility[] {
    return this.alignment?.getLayerStates() ?? [];
  }
  calibrate(d: CalibrationDelta): void {
    if (!this.alignment || !this.placement.isPlaced) return;
    if (d.dx || d.dy || d.dz) this.placement.translate(d.dx ?? 0, d.dy ?? 0, d.dz ?? 0);
    if (d.dpitch || d.dyaw || d.droll)
      this.placement.rotate(d.dpitch ?? 0, d.dyaw ?? 0, d.droll ?? 0);
    if (d.dscale && d.dscale > 0) this.placement.scaleBy(d.dscale);
  }
  saveCalibration(): boolean {
    if (!this.alignment || !this.placement.isPlaced || !this.calibKey) return false;
    try {
      localStorage.setItem(this.calibKey, JSON.stringify(this.placement.getCalibration()));
      console.info(`[ar-engine] 보정값 저장: ${this.calibKey}`);
      return true;
    } catch (err) {
      console.warn("[ar-engine] 보정값 저장 실패:", err);
      return false;
    }
  }
  loadCalibration(): boolean {
    if (!this.alignment || !this.calibKey) return false;
    try {
      const raw = localStorage.getItem(this.calibKey);
      if (!raw) return false;
      const c = JSON.parse(raw) as CalibrationState;
      this.placement.applyCalibration(c);
      this.reticle.hide();
      console.info(`[ar-engine] 보정값 불러오기 적용: ${this.calibKey}`);
      return true;
    } catch (err) {
      console.warn("[ar-engine] 보정값 불러오기 실패:", err);
      return false;
    }
  }
  resetCalibration(): void {
    if (!this.alignment || !this.alignInitialCalib) return;
    this.placement.applyCalibration(this.alignInitialCalib);
  }

  setDebugCubeVisible(visible: boolean): void {
    if (this.debugCube) this.debugCube.visible = visible;
  }

  // ---------------------------------------------------------------

  /**
   * 월드 참조 공간 타입 선택(지시 #3,#4,#6). 'local'은 immersive 세션에서 보장되므로 기준으로
   * 사용하고, 'local-floor'(선택 공간)는 지원이 확인될 때만 사용한다(바닥 높이 기준이 필요한 경우).
   */
  private async selectWorldReferenceSpace(session: XRSession): Promise<XRReferenceSpaceType> {
    this.bus.emit("info", "참조 공간 요청: 'local-floor' 지원 확인 → 미지원 시 'local' 폴백");
    try {
      await session.requestReferenceSpace("local-floor");
      this.bus.emit("info", "참조 공간 확정: 'local-floor' (바닥 기준)");
      return "local-floor";
    } catch (err) {
      const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : "Error";
      this.bus.emit("info", `'local-floor' 미지원(${name}) → 'local'로 폴백`);
      return "local";
    }
  }

  /** 참조 공간/세션 초기화 실패 처리(지시 #8,#9): 타입·name·message 로그 + 리소스 정리 + 세션 종료. */
  private async failReferenceSpaceInit(
    session: XRSession,
    requestedType: string,
    err: unknown
  ): Promise<void> {
    const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : "Error";
    const detail = err instanceof Error ? err.message : String(err);
    const message = `참조 공간(${requestedType}) 요청 실패: ${name} — ${detail}`;
    console.error(`[ar-engine] ${message}`);
    console.error(formatDiagnostics(await collectDiagnostics()));
    this.emitError("no-reference-space", message, false);
    this.teardownAfterFailedInit();
    try {
      await session.end();
    } catch {
      /* 이미 종료됨 */
    }
    this.session = undefined;
    this.bus.emit("sessionEnded", undefined);
  }

  /**
   * 세션 'end' 리스너가 아직 연결되기 전(초기화 도중) 실패 시의 수동 정리.
   * (정상 종료 경로는 onSessionEnd 가 담당한다.)
   */
  private teardownAfterFailedInit(): void {
    this.renderer?.setAnimationLoop(null);
    window.removeEventListener("resize", this.onResize);
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
    this.renderer = undefined;
    this.hitTestSource = undefined;
    this.refSpace = undefined;
  }

  private setupThree(root: HTMLElement): void {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.inset = "0";
    (root === document.body ? document.body : root).appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(1, 3, 2);
    scene.add(dir);
    scene.add(this.reticle.mesh);
    scene.add(this.placement.group);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);

    // 탭(select) 입력: 배치 전엔 배치, 배치 후엔 작품 상호작용.
    const controller = renderer.xr.getController(0);
    controller.addEventListener("select", this.onSelect);
    scene.add(controller);
    this.controller = controller;

    window.addEventListener("resize", this.onResize);

    if (this.debug) this.setupDebug();
  }

  // ---- 디버그(테스트 전용) 계측 ----

  /** A. 카메라 전방 테스트 큐브 + B. 배치 축. (실제 장면과 독립) */
  private setupDebug(): void {
    if (!this.scene) return;
    // A. 불투명·고대비·조명 무관(MeshBasic) 25cm 큐브. 매 프레임 카메라 전방 1m로 이동.
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xff2d95 })
    );
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cube.geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    cube.add(edges);
    cube.renderOrder = 999;
    this.scene.add(cube);
    this.debugCube = cube;

    // B. 배치 위치 RGB(XYZ) 축. placement Group 자식 → 배치 시 함께 표시/이동.
    const axes = new THREE.AxesHelper(0.5);
    this.placement.group.add(axes);
    this.debugAxes = axes;

    this.bus.emit("info", "DEBUG 모드: 전방 1m 테스트 큐브(마젠타) + 배치 축 생성.");
  }

  /** C. 모델 bounding box + 메시 수 집계. attach 직후 호출. */
  private setupModelDebug(root: THREE.Object3D): void {
    if (!this.debug) return;
    let meshCount = 0;
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshCount++;
    });
    this.debugMeshCount = meshCount;

    const box = new THREE.Box3().setFromObject(root);
    box.getSize(this.debugBoxSize);
    if (this.debugBox) {
      this.placement.group.remove(this.debugBox);
      this.debugBox.dispose();
    }
    const helper = new THREE.Box3Helper(box, new THREE.Color(0x00ffff));
    this.placement.group.add(helper);
    this.debugBox = helper;

    this.bus.emit(
      "info",
      `DEBUG 모델: meshCount=${meshCount} · bbox=[${round3(this.debugBoxSize.x)}×` +
        `${round3(this.debugBoxSize.y)}×${round3(this.debugBoxSize.z)}]m · scale=${round3(this.placement.group.scale.x)}`
    );
  }

  /** 매 프레임: 테스트 큐브를 XR 카메라 전방 1m에 유지(렌더링 정상 여부 확인용). */
  private updateDebugCube(): void {
    if (!this.renderer || !this.debugCube) return;
    const cam = this.renderer.xr.getCamera();
    const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const camQuat = new THREE.Quaternion().setFromRotationMatrix(cam.matrixWorld);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    this.debugCube.position.copy(camPos).addScaledVector(forward, 1.0);
    this.debugCube.quaternion.copy(camQuat);
  }

  /** C. 가시성/거리/시야 진단 수집(텔레메트리에 실어 화면 표시). */
  private collectDebugInfo(): ARDebugInfo | undefined {
    if (!this.debug || !this.renderer || !this.scene) return undefined;
    const modelRoot = this.alignment?.object ?? this.artwork?.object;
    const group = this.placement.group;
    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);

    const cam = this.renderer.xr.getCamera();
    const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const cameraDistanceM = camPos.distanceTo(worldPos);

    // 대략적 절두체 내부 판정(대표 뷰 기준).
    this.debugProjScreen.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.debugFrustum.setFromProjectionMatrix(this.debugProjScreen);
    const inView = this.debugFrustum.containsPoint(worldPos);

    return {
      inScene: group.parent === this.scene,
      modelVisible: group.visible && (modelRoot?.visible ?? false),
      meshCount: this.debugMeshCount,
      worldPos: { x: round3(worldPos.x), y: round3(worldPos.y), z: round3(worldPos.z) },
      scale: round3(group.scale.x),
      bboxSize: {
        x: round3(this.debugBoxSize.x),
        y: round3(this.debugBoxSize.y),
        z: round3(this.debugBoxSize.z),
      },
      cameraDistanceM: round3(cameraDistanceM),
      inView,
    };
  }

  private disposeDebug(): void {
    if (this.debugCube) {
      this.scene?.remove(this.debugCube);
      (this.debugCube as THREE.Mesh).geometry?.dispose?.();
      const mat = (this.debugCube as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
      this.debugCube = undefined;
    }
    if (this.debugAxes) {
      this.placement.group.remove(this.debugAxes);
      this.debugAxes.dispose();
      this.debugAxes = undefined;
    }
    if (this.debugBox) {
      this.placement.group.remove(this.debugBox);
      this.debugBox.dispose();
      this.debugBox = undefined;
    }
  }

  private async loadExperienceAsset(req: StartRequest): Promise<void> {
    // 단일 에셋 전용 매니페스트(정합 시험물 등)를 명시한 경우 별도 경로로 처리.
    if (req.overrides?.manifestUrl) {
      await this.loadStandaloneExperience(req, req.overrides.manifestUrl);
      return;
    }

    let asset: AssetEntry | undefined;
    const manifestUrl = this.options.assetManifestUrl ?? DEFAULT_MANIFEST_URL;

    try {
      const assetId = await this.resolveAssetId(req);
      this.assetId = assetId;
      if (!req.overrides?.forcePlaceholder) {
        const manifest = await loadAssetManifest(withBase(manifestUrl));
        asset = findAsset(manifest, assetId);
      }
    } catch (err) {
      console.warn("[ar-engine] 에셋 메타 로드 실패 — 임시 모델 사용:", err);
    }

    // 모델 로드: 실 에셋 우선, 실패/미완성 시 임시 모델 폴백.
    let model;
    let loadedUrl: string | undefined;
    this.usedPlaceholder = false;
    if (asset?.url && !req.overrides?.forcePlaceholder) {
      const t0 = performance.now();
      try {
        model = await loadGLB(withBase(asset.url), (loaded, total) =>
          this.bus.emit("assetProgress", { assetId: this.assetId, loaded, total })
        );
        loadedUrl = asset.url;
        console.info(`[ar-engine] GLB 로드 시간: ${Math.round(performance.now() - t0)}ms (${asset.url})`);
      } catch (err) {
        console.warn("[ar-engine] GLB 로드 실패 — 임시 모델 사용:", err);
      }
    }
    if (!model) {
      model = buildPlaceholderArtwork();
      this.usedPlaceholder = true;
    }

    const scale = req.overrides?.scale ?? asset?.recommended_scale ?? 1;
    this.artwork = new EmergingArtworkScene(model, asset);
    this.placement.attach(this.artwork.object, scale);
    this.setupModelDebug(this.artwork.object);

    // 실제 Codex GLB 로드 여부를 명확히 로깅(지시 #6).
    if (this.usedPlaceholder) {
      console.warn(`[ar-engine] ⚠ 임시 모델 사용 중 (Codex GLB 아님). assetId=${this.assetId || "-"}`);
    } else {
      console.info(
        `[ar-engine] ✓ Codex GLB 로드: ${loadedUrl} | assetId=${this.assetId} | ` +
          `clips=[${this.artwork.clipNames.join(", ")}]`
      );
    }

    this.bus.emit("ready", {
      assetId: this.assetId || "placeholder",
      usedPlaceholder: this.usedPlaceholder,
      source: this.usedPlaceholder ? "placeholder" : "glb",
      url: loadedUrl,
      clips: this.artwork.clipNames,
    });

    // 로드 전에 사용자가 이미 탭해 둔 경우 즉시 배치.
    if (this.pendingPlaceMatrix) {
      this.placeAndEmerge(this.pendingPlaceMatrix);
      this.pendingPlaceMatrix = undefined;
    }
  }

  /** 정합 시험물 등 단일 에셋 전용 매니페스트 로드 경로. 별의 새싹 경로와 분리. */
  private async loadStandaloneExperience(req: StartRequest, manifestUrl: string): Promise<void> {
    let man;
    try {
      man = await loadStandaloneManifest(withBase(manifestUrl));
    } catch (err) {
      const msg = `정합 매니페스트 로드 실패: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[ar-engine] ${msg}`);
      this.emitError("manifest-load-failed", msg, false);
      return;
    }
    this.assetId = man.id;

    let model;
    const t0 = performance.now();
    try {
      model = await loadGLB(withBase(man.url), (loaded, total) =>
        this.bus.emit("assetProgress", { assetId: this.assetId, loaded, total })
      );
      console.info(`[ar-engine] GLB 로드 시간: ${Math.round(performance.now() - t0)}ms (${man.url})`);
    } catch (err) {
      const msg = `정합 GLB 로드 실패: ${man.url} — ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[ar-engine] ${msg}`);
      this.emitError("asset-load-failed", msg, false);
      return; // 정합은 임시 모델 폴백 없음(기준물이 핵심)
    }

    const scale = req.overrides?.scale ?? man.recommended_scale ?? 1;
    this.alignment = new AlignmentScene(model, man);
    this.placement.attach(this.alignment.object, scale);
    this.setupModelDebug(this.alignment.object);
    this.calibKey = `ar-calib:${req.buildingId}:${req.spotId}:${man.id}`;
    this.usedPlaceholder = false;

    console.info(
      `[ar-engine] ✓ 정합 GLB 로드: ${man.url} | id=${man.id} | category=${man.category} | ` +
        `layers=[${this.alignment.getLayerStates().map((l) => l.node).join(", ")}] | ` +
        `refPoints=${this.alignment.referencePoints.length}`
    );

    this.bus.emit("ready", {
      assetId: this.assetId,
      usedPlaceholder: false,
      source: "glb",
      url: man.url,
      clips: [], // 정합 시험물은 애니메이션 없음(정적)
    });

    if (this.pendingPlaceMatrix) {
      this.placeAlignment(this.pendingPlaceMatrix);
      this.pendingPlaceMatrix = undefined;
    }
  }

  private async resolveAssetId(req: StartRequest): Promise<string> {
    if (req.overrides?.assetId) return req.overrides.assetId;
    if (this.options.catalogUrl) {
      const catalog = await loadCatalog(this.options.catalogUrl);
      const exp = resolveExperience(catalog, req.buildingId, req.spotId, req.experienceId);
      if (exp?.assetId) return exp.assetId;
    }
    // 카탈로그/override 없음: experienceId를 assetId로 간주(데모 편의).
    return req.experienceId;
  }

  private onSelect = (): void => {
    if (!this.placement.isPlaced) {
      if (!this.reticle.visible) return; // 바닥 미인식 상태에서는 무시
      const matrix = Array.from(this.reticle.mesh.matrix.elements);
      if (this.artwork) this.placeAndEmerge(matrix);
      else if (this.alignment) this.placeAlignment(matrix);
      else this.pendingPlaceMatrix = matrix; // 로드 완료 후 배치
      return;
    }
    // 배치 후: 작품을 레이캐스트하여 상호작용(별의 새싹). 정합은 UI로 보정.
    if (this.controller && this.artwork) {
      const raycaster = new THREE.Raycaster();
      const m = new THREE.Matrix4().extractRotation(this.controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(this.controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
      const hits = raycaster.intersectObject(this.artwork.object, true);
      if (hits.length > 0) {
        this.artwork.pulse();
        this.bus.emit("hotspotSelected", { hotspotId: this.assetId || "artwork" });
      }
    }
  };

  private placeAndEmerge(matrix: number[]): void {
    this.placement.placeAt(matrix, true);
    this.reticle.hide();
    this.bus.emit("placed", { assetId: this.assetId || "placeholder" });
    this.artwork?.emerge(() => this.emitCompleted());
  }

  private placeAlignment(matrix: number[]): void {
    this.placement.placeAt(matrix, true);
    this.reticle.hide();
    this.alignInitialCalib = this.placement.getCalibration();
    this.bus.emit("placed", { assetId: this.assetId });
    // 저장된 보정값이 있으면 자동 적용(있을 때만).
    this.loadCalibration();
  }

  private emitCompleted(): void {
    if (this.completedEmitted || !this.request) return;
    this.completedEmitted = true;
    this.bus.emit("experienceCompleted", {
      buildingId: this.request.buildingId,
      spotId: this.request.spotId,
      experienceId: this.request.experienceId,
      durationMs: performance.now() - this.experienceStartTime,
      payload: { usedPlaceholder: this.usedPlaceholder },
    });
  }

  private onFrame = (_t: number, frame?: XRFrame): void => {
    const dt = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    // 뷰어(기기) 포즈 추적 유효성 — 배치 안정성/트래킹 상실 진단.
    let viewerTracked = true;
    if (frame && this.refSpace) {
      const vp = frame.getViewerPose(this.refSpace);
      if (!vp) {
        viewerTracked = false;
        this.viewerLostFrames++;
        if (this.viewerLostFrames === 30 && !this.trackingLostEmitted) {
          this.trackingLostEmitted = true;
          console.warn("[ar-engine] ⚠ 뷰어 포즈 추적 상실(약 30프레임) — 배치 흔들림 가능");
          this.bus.emit("trackingLost", { reason: "alignment-lost" });
        }
      } else {
        this.viewerLostFrames = 0;
        this.trackingLostEmitted = false;
      }
    }

    if (frame && this.hitTestSource && this.refSpace && !this.placement.isPlaced) {
      const results = frame.getHitTestResults(this.hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(this.refSpace);
        if (pose) this.reticle.updateFromMatrix(pose.transform.matrix);
      } else {
        this.reticle.hide();
      }
      // 바닥 인식 전환 로깅(처음 발견/소실).
      if (this.reticle.visible !== this.reticleWasVisible) {
        this.reticleWasVisible = this.reticle.visible;
        console.info(`[ar-engine] hit-test ${this.reticle.visible ? "바닥 인식됨 ✓" : "바닥 소실"}`);
      }
    }

    this.artwork?.update(dt, elapsed);
    if (this.debug) this.updateDebugCube();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.emitTelemetry(viewerTracked);
  };

  private emitTelemetry(viewerTracked: boolean): void {
    this.telemFrames++;
    const now = performance.now();
    const span = now - this.lastTelemetryAt;
    if (span < 500) return; // ~2회/초
    const fps = Math.round((this.telemFrames * 1000) / span);
    this.telemFrames = 0;
    this.lastTelemetryAt = now;

    let anchorWorld: { x: number; y: number; z: number } | undefined;
    if (this.placement.isPlaced) {
      this.placement.group.getWorldPosition(this.tmpVec);
      anchorWorld = { x: round3(this.tmpVec.x), y: round3(this.tmpVec.y), z: round3(this.tmpVec.z) };
    }

    this.bus.emit("telemetry", {
      fps,
      placed: this.placement.isPlaced,
      reticleVisible: this.reticle.visible,
      viewerTracked,
      hitTestActive: !!this.hitTestSource,
      animationPhase: this.artwork?.phase ?? "none",
      anchorWorld,
      debug: this.collectDebugInfo(),
    });
  }

  private onResize = (): void => {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onSessionEnd = (): void => {
    this.renderer?.setAnimationLoop(null);
    this.disposeDebug();
    this.artwork?.dispose();
    this.alignment?.dispose();
    window.removeEventListener("resize", this.onResize);
    this.hitTestSource = undefined;
    this.refSpace = undefined;
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
    this.placement.reset();
    this.artwork = undefined;
    this.alignment = undefined;
    this.alignInitialCalib = undefined;
    this.session = undefined;
    this.bus.emit("sessionEnded", undefined);
  };

  private emitError(code: string, message: string, recoverable: boolean): void {
    this.bus.emit("error", { code, message, recoverable });
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
