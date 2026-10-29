// 공개 타입 — contracts/ar-api.md 와 1:1 대응.
// AR 엔진은 "체험 재생 + 결과 이벤트"만 담당한다. GPS/쿠폰/도장/지도는 외부 서비스.

/** 실행 모드. geo=실제 투어(외부가 GPS 해금 후 호출), demo=행사장 가상 위치. */
export type ARMode = "geo" | "demo";

/**
 * 에셋 카테고리 — contracts/asset-spec.md §2. (Codex 실제 어휘 기준)
 * 현재 확정값은 `emergent-artwork` 하나지만, 건물 복원/담장/역할극 등 향후 유형을
 * 계속 추가할 예정이므로 **확장 가능**하게 둔다. `(string & {})`로 임의 문자열을
 * 허용하면서 알려진 값은 자동완성에 노출한다.
 */
export type SceneCategory =
  | "emergent-artwork"
  | "building_stage"
  | "wall_artwork"
  | "roleplay_scene"
  | (string & {});

/** checkSupport() 실패 원인 코드. */
export type SupportFailureReason =
  | "no-webxr"
  | "no-immersive-ar"
  | "insecure-context"
  | "no-hit-test"
  | "unknown";

export interface ARSupportReport {
  supported: boolean;
  webxr: boolean;
  immersiveAR: boolean;
  secureContext: boolean;
  features: {
    hitTest: boolean; // 세션 시작 전에는 낙관적 추정(요청 시 확정)
    domOverlay: boolean;
    lightEstimation: boolean;
    anchors: boolean;
  };
  reason?: SupportFailureReason;
  /** 사용자 안내 문구(한국어). */
  guidanceMessage: string;
}

export interface StartRequest {
  buildingId: string; // residence-16 | residence-42 | heredium
  spotId: string;
  experienceId: string;
  overrides?: {
    /** 카탈로그 대신 특정 에셋 id를 직접 지정(데모/디버그). */
    assetId?: string;
    /** 에셋 로드 실패/미완성 시에도 임시 모델로 강제 진행. */
    forcePlaceholder?: boolean;
    scale?: number;
  };
}

export interface AREngineOptions {
  /** 체험 라우팅 카탈로그 URL. 미지정 시 overrides.assetId 필수. */
  catalogUrl?: string;
  /** Codex 에셋 매니페스트 URL(기본 /models/asset-manifest.json). */
  assetManifestUrl?: string;
  mode?: ARMode;
  /** DOM 오버레이/안내 UI 루트. 미지정 시 전체화면 오버레이 생성. */
  container?: HTMLElement;
}

// ---- 이벤트 ----

export interface AssetProgressEvent {
  assetId: string;
  loaded: number;
  total: number; // 0 이면 미상
}
export interface ReadyEvent {
  assetId: string;
  usedPlaceholder: boolean;
  /** 실제 로드된 소스. 임시 모델인지 Codex GLB인지 명확히 구분. */
  source: "glb" | "placeholder";
  /** GLB일 때 로드한 URL. */
  url?: string;
  /** GLB에서 실제로 발견한 애니메이션 클립 이름들. */
  clips: string[];
}
export interface PlacedEvent {
  assetId: string;
}
export interface TrackingLostEvent {
  reason: "no-plane" | "alignment-lost" | "low-light";
}
export interface HotspotSelectedEvent {
  hotspotId: string;
}
export interface ExperienceCompletedEvent {
  buildingId: string;
  spotId: string;
  experienceId: string;
  durationMs: number;
  payload?: Record<string, unknown>;
}
export interface ARErrorEvent {
  code: string;
  message: string;
  recoverable: boolean;
}

/** 세션 중 주기적으로 방출되는 런타임 진단(실기기 배치 안정성 확인용). */
export interface ARTelemetry {
  fps: number;
  placed: boolean;
  reticleVisible: boolean;
  /** 뷰어(기기) 포즈 추적 유효 여부. false 지속 시 트래킹 상실. */
  viewerTracked: boolean;
  hitTestActive: boolean;
  animationPhase: "none" | "emerging" | "idle" | "disappearing";
  /** 배치 후 기준점의 월드 좌표(배치 안정성 육안 확인용). */
  anchorWorld?: { x: number; y: number; z: number };
}

export interface ARExperienceEventMap {
  sessionStarted: void;
  assetProgress: AssetProgressEvent;
  ready: ReadyEvent;
  placed: PlacedEvent;
  trackingLost: TrackingLostEvent;
  hotspotSelected: HotspotSelectedEvent;
  experienceCompleted: ExperienceCompletedEvent;
  error: ARErrorEvent;
  telemetry: ARTelemetry;
  sessionEnded: void;
}

export interface ARExperience {
  checkSupport(): Promise<ARSupportReport>;
  /** 환경 진단 정보 수집(실패 원인 분석용). 콘솔에도 출력한다. */
  runDiagnostics(): Promise<unknown>;
  start(req: StartRequest): Promise<void>;
  stop(): Promise<void>;
  on<K extends keyof ARExperienceEventMap>(
    type: K,
    handler: (payload: ARExperienceEventMap[K]) => void
  ): () => void;
  off<K extends keyof ARExperienceEventMap>(
    type: K,
    handler: (payload: ARExperienceEventMap[K]) => void
  ): void;
  // 장면 타입별 제어(후속 장면에서 확장). 미구현 시 안전하게 no-op/throw.
  setTimePhase(value: number): void;
  advanceScene(): void;
  recenter(): void;
  /** 작품 퇴장(Disappear) 재생 후 재배치 가능 상태로 되돌림. */
  dismiss(): void;
}
