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
    /** 단일 에셋 전용 매니페스트 URL(정합 시험물 등). 지정 시 이 경로로 로드. */
    manifestUrl?: string;
    /** 에셋 로드 실패/미완성 시에도 임시 모델로 강제 진행. */
    forcePlaceholder?: boolean;
    scale?: number;
  };
}

/** 수동 보정 증분(건물 정합). 미지정 필드는 0. */
export interface CalibrationDelta {
  dx?: number;
  dy?: number;
  dz?: number;
  dpitch?: number; // X축(rad)
  dyaw?: number; // Y축(rad)
  droll?: number; // Z축(rad)
  dscale?: number; // 곱셈 계수(예: 1.01 = +1%)
}

export interface LayerVisibility {
  node: string;
  visible: boolean;
}

export interface AREngineOptions {
  /** 체험 라우팅 카탈로그 URL. 미지정 시 overrides.assetId 필수. */
  catalogUrl?: string;
  /** Codex 에셋 매니페스트 URL(기본 /models/asset-manifest.json). */
  assetManifestUrl?: string;
  mode?: ARMode;
  /** DOM 오버레이/안내 UI 루트. 미지정 시 전체화면 오버레이 생성. */
  container?: HTMLElement;
  /**
   * 테스트 전용 디버그 모드(지시: 테스트 모드에서만). 카메라 전방 테스트 큐브,
   * 배치 축(RGB=XYZ), 모델 bounding box, 가시성/거리/시야 진단을 활성화한다.
   * 실제 GLB·장면 동작에는 영향을 주지 않는다.
   */
  debug?: boolean;
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
  /** debug 모드에서만 채워지는 모델 가시성 진단(지시 B,C). */
  debug?: ARDebugInfo;
}

/** debug 모드 모델 가시성/위치 진단(지시 B,C). */
export interface ARDebugInfo {
  /** placement Group 이 scene 그래프에 연결돼 있는가. */
  inScene: boolean;
  /** 모델+Group 이 모두 visible 인가. */
  modelVisible: boolean;
  /** 렌더 대상 메시 수. */
  meshCount: number;
  /** placement Group 월드 좌표. */
  worldPos: { x: number; y: number; z: number };
  /** placement Group 균일 스케일. */
  scale: number;
  /** 모델 bounding box 크기(m). */
  bboxSize: { x: number; y: number; z: number };
  /** XR 카메라 ↔ 모델(Group) 거리(m). */
  cameraDistanceM: number;
  /** 모델(Group) 월드 좌표가 카메라 절두체 내부인가(대략). */
  inView: boolean;
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
  /** 실기기 진단용 정보 로그(예: 선택된 reference space 타입). 사람이 읽는 문자열. */
  info: string;
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

  // --- 건물 정합(alignment) 제어. 정합 장면이 아닐 때는 no-op. ---
  /** 레이어(기준벽/격자/마커/오버레이/기준점) 표시·숨김. */
  setLayerVisible(node: string, visible: boolean): void;
  /** 현재 레이어 가시 상태 목록. */
  getLayers(): LayerVisibility[];
  /** 위치·회전·크기 수동 보정(증분). */
  calibrate(delta: CalibrationDelta): void;
  /** 현재 보정값 저장(localStorage). 성공 여부 반환. */
  saveCalibration(): boolean;
  /** 저장된 보정값 불러오기·적용. 존재 여부 반환. */
  loadCalibration(): boolean;
  /** 보정값을 배치 직후 상태로 초기화. */
  resetCalibration(): void;

  /** [debug 전용] 카메라 전방 테스트 큐브 표시/숨김. debug 모드가 아니면 no-op. */
  setDebugCubeVisible(visible: boolean): void;

  /** iOS(AR Quick Look) 폴백용 USDZ 바이트 생성. WebXR 세션을 시작하지 않는다. */
  exportExperienceUSDZ(req: StartRequest): Promise<Uint8Array>;
}
