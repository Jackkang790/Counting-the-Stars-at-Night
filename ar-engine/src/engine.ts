// AR 엔진 오케스트레이션 — contracts/ar-api.md 구현.
// 1순위: Android Chrome / WebXR immersive-ar + hit-test. 미지원은 checkSupport로 안내.
import * as THREE from "three";
import type {
  ARExperience,
  ARExperienceEventMap,
  AREngineOptions,
  StartRequest,
  ARSupportReport,
} from "./types";
import { EventBus } from "./events";
import { checkSupport } from "./core/support";
import { collectDiagnostics, formatDiagnostics, describeSessionError } from "./core/diagnostics";
import { Reticle } from "./core/reticle";
import { PlacementGroup } from "./core/placement";
import { loadGLB } from "./loaders/gltf";
import {
  loadAssetManifest,
  loadCatalog,
  findAsset,
  resolveExperience,
  type AssetEntry,
} from "./loaders/manifest";
import { EmergingArtworkScene } from "./scenes/emergingArtwork";
import { buildPlaceholderArtwork } from "./scenes/placeholder";

const DEFAULT_MANIFEST_URL = "/models/asset-manifest.json";

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

  private request?: StartRequest;
  private assetId = "";
  private usedPlaceholder = false;
  private pendingPlaceMatrix?: number[];
  private experienceStartTime = 0;
  private completedEmitted = false;
  private clock = new THREE.Clock();

  constructor(options: AREngineOptions = {}) {
    this.options = { mode: "geo", ...options };
  }

  checkSupport(): Promise<ARSupportReport> {
    return checkSupport();
  }

  async runDiagnostics(): Promise<unknown> {
    const d = await collectDiagnostics();
    console.info(formatDiagnostics(d));
    return d;
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
        optionalFeatures: ["dom-overlay", "light-estimation", "anchors"],
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
    await this.renderer!.xr.setSession(session);
    this.bus.emit("sessionStarted", undefined);

    // 참조 공간 + hit-test 소스
    this.renderer!.xr.setReferenceSpaceType("local");
    this.refSpace = this.renderer!.xr.getReferenceSpace() ?? undefined;
    const viewerSpace = await session.requestReferenceSpace("viewer");
    const hitSource = await session.requestHitTestSource?.({ space: viewerSpace });
    if (!hitSource) {
      this.emitError("no-hit-test", "이 기기에서 바닥 인식(hit-test)을 사용할 수 없습니다.", false);
      await this.stop();
      throw new Error("hit-test unavailable");
    }
    this.hitTestSource = hitSource;

    session.addEventListener("end", this.onSessionEnd);

    this.experienceStartTime = performance.now();
    this.clock.start();
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

  // ---------------------------------------------------------------

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
  }

  private async loadExperienceAsset(req: StartRequest): Promise<void> {
    let asset: AssetEntry | undefined;
    const manifestUrl = this.options.assetManifestUrl ?? DEFAULT_MANIFEST_URL;

    try {
      const assetId = await this.resolveAssetId(req);
      this.assetId = assetId;
      if (!req.overrides?.forcePlaceholder) {
        const manifest = await loadAssetManifest(manifestUrl);
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
      try {
        model = await loadGLB(asset.url, (loaded, total) =>
          this.bus.emit("assetProgress", { assetId: this.assetId, loaded, total })
        );
        loadedUrl = asset.url;
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
      else this.pendingPlaceMatrix = matrix; // 로드 완료 후 배치
      return;
    }
    // 배치 후: 작품을 레이캐스트하여 상호작용.
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

    if (frame && this.hitTestSource && this.refSpace && !this.placement.isPlaced) {
      const results = frame.getHitTestResults(this.hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(this.refSpace);
        if (pose) this.reticle.updateFromMatrix(pose.transform.matrix);
      } else {
        this.reticle.hide();
      }
    }

    this.artwork?.update(dt, elapsed);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private onResize = (): void => {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onSessionEnd = (): void => {
    this.renderer?.setAnimationLoop(null);
    this.artwork?.dispose();
    window.removeEventListener("resize", this.onResize);
    this.hitTestSource = undefined;
    this.refSpace = undefined;
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
    this.placement.reset();
    this.artwork = undefined;
    this.session = undefined;
    this.bus.emit("sessionEnded", undefined);
  };

  private emitError(code: string, message: string, recoverable: boolean): void {
    this.bus.emit("error", { code, message, recoverable });
  }
}
