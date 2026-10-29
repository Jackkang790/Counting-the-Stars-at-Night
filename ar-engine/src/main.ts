// 실기기 테스트 사이트 — 기존 AR 엔진을 재사용하는 최소 UI(전체 게임 UI 아님).
import { createARExperience } from "./index";
import type { StartRequest } from "./types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const supportEl = $("support");
const logEl = $("log");
const stopBtn = $<HTMLButtonElement>("ar-stop");
const dismissBtn = $<HTMLButtonElement>("ar-dismiss");
const appEl = $("app");
const overlayEl = $("ar-overlay");
const hintEl = $("ar-hint");
const telemetryEl = $("ar-telemetry");
const glbEl = $("ar-glb");
const errorEl = $("ar-error");
const loadStatusEl = $("loadStatus");
const alignPanel = $("ar-align");
const alignLayersEl = $("align-layers");
const diagBanner = $("diag-banner");
const envInfoEl = $("env-info");

// 빌드 식별자(vite define) — 두 기기가 동일 배포본인지 확인용(지시 #1).
declare const __BUILD_ID__: string;
const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

// 테스트 전용 디버그 모드: URL 에 ?debug 가 있을 때만 활성(지시: 테스트 모드에서만).
const DEBUG = new URLSearchParams(location.search).has("debug");
const debugToggleBtn = $<HTMLButtonElement>("ar-debug-toggle");
const debugHudEl = $("ar-debug");
let lastDebugText = ""; // 복사/요약용 최신 디버그 스냅샷.
let debugCubeOn = true;

const LAYER_LABELS: Record<string, string> = {
  REFERENCE_Facade: "기준 외벽",
  CALIBRATION_Grid: "격자",
  CALIBRATION_Markers: "기준 마커",
  OVERLAY_Architecture: "반투명 오버레이",
  POINTS_Facade: "기준점",
};

// 고정 컨텍스트(테스트 사이트는 단일 스팟 기준; GPS/지도/게임 UI는 범위 밖).
const BUILDING_ID = "residence-16";
const SPOT_ID = "spot-01";
const ASSET_BY_EXPERIENCE: Record<string, string> = { "emergent-artwork": "starseed_sculpture" };
const MANIFEST_BY_EXPERIENCE: Record<string, string> = {
  "facade-alignment": "/models/alignment_test_facade.manifest.json",
};
const TRANSLATE_STEP = 0.05; // m
const ROTATE_STEP = Math.PI / 180; // 1°
const SCALE_UP = 1.02;
const SCALE_DOWN = 1 / 1.02;

let isAlignment = false;

function log(msg: string): void {
  const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  logEl.textContent += `[${time}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

/** 치명적/주목 오류를 화면 상단 배너로 노출(접힌 로그에만 묻히지 않도록, 지시 #10). */
function showDiag(msg: string): void {
  diagBanner.textContent = msg;
  diagBanner.style.display = "block";
}

// ---- 실기기 진단 계측(지시 #2,#3,#4,#10) ----
// 조기 인라인 스크립트가 모은 모듈 로드/파싱 오류를 화면 로그로 흡수.
interface DiagWindow extends Window {
  __arDiag?: string[];
}
const early = (window as DiagWindow).__arDiag;
if (early && early.length) early.forEach((m) => log(m));

// 런타임 전역 오류를 화면 로그로(배너는 조기 인라인 스크립트가 처리).
window.addEventListener("error", (e) => log(`✗ window.error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => {
  const r = (e as PromiseRejectionEvent).reason;
  log(`✗ unhandledrejection: ${r instanceof Error ? `${r.name}: ${r.message}` : String(r)}`);
});

// 모든 버튼의 pointerdown/pointerup/click 발생 여부를 비교(지시 #4).
// 캡처 단계 '로깅 전용' — 실제 동작 핸들러(아래 click)와 분리되어 중복 실행이 없다(주의사항 준수).
(["pointerdown", "pointerup", "click"] as const).forEach((type) => {
  document.addEventListener(
    type,
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("button");
      if (!btn) return;
      const id = btn.id || btn.getAttribute("data-cal") || (btn.textContent ?? "").trim().slice(0, 10);
      log(`· ${type} → #${id}`);
    },
    true
  );
});

// 환경 보고: 빌드 식별자, 보안 컨텍스트, 인앱 브라우저 감지(지시 #1,#2).
function reportEnv(): void {
  const ua = navigator.userAgent;
  const inApp = /; wv\)|KAKAOTALK|NAVER|FB_IAB|FBAN|FBAV|Instagram|Line\/|DaumApps|Snapchat/i.test(ua);
  envInfoEl.textContent =
    `build ${BUILD_ID} · secure=${window.isSecureContext} · ${inApp ? "⚠ 인앱 브라우저 추정" : "일반 브라우저"}` +
    `${DEBUG ? " · 🐞 DEBUG" : ""}\n${ua}`;
  log(`env build=${BUILD_ID} secure=${window.isSecureContext} inApp=${inApp} debug=${DEBUG}`);
  if (inApp) {
    showDiag(
      "⚠ 인앱 브라우저(카카오톡/네이버/페이스북 등)로 열린 것으로 보입니다.\n" +
        "WebXR immersive-ar은 보통 Chrome 정식 앱에서만 동작합니다.\n" +
        "우측 상단 메뉴 → 'Chrome으로 열기(다른 브라우저로 열기)'를 사용해 주세요."
    );
  }
}
reportEnv();

const engine = createARExperience({ debug: DEBUG });

// ---- 이벤트 배선 (contracts/ar-api.md) ----
engine.on("info", (m) => log(`ℹ ${m}`));
engine.on("sessionStarted", () => { log("▶ sessionStarted"); showAR(true); });
engine.on("assetProgress", (e) =>
  log(`… assetProgress ${e.total ? Math.round((e.loaded / e.total) * 100) + "%" : e.loaded + "B"}`)
);
engine.on("ready", (e) => {
  const file = e.url ? e.url.split("/").pop() : "(임시 모델)";
  glbEl.textContent = `GLB: ${file}${e.source === "placeholder" ? " ⚠임시" : ""}`;
  if (e.source === "glb") {
    log(`✓ ready — Codex GLB 로드됨: ${e.url}`);
    if (e.clips.length) log(`   clips=[${e.clips.join(", ")}]`);
    loadStatusEl.innerHTML = `에셋 로드 상태: <span class="ok">Codex GLB</span> (${file})${e.clips.length ? " · clips=[" + e.clips.join(", ") + "]" : ""}`;
  } else {
    log(`✓ ready — ⚠ 임시 모델(Codex GLB 아님)`);
    loadStatusEl.innerHTML = `에셋 로드 상태: <span class="warn">임시 모델(폴백)</span>`;
  }
  if (isAlignment) {
    populateLayers();
    alignPanel.style.display = "block";
    dismissBtn.style.display = "none";
    hintEl.textContent = "바닥을 탭해 외벽(시험용) 배치 → 아래 패널로 보정";
  } else {
    hintEl.textContent = "바닥을 비추고 화면을 탭하세요 (배치 → Emerge→Idle)";
  }
});
engine.on("placed", () => {
  log("📍 placed");
  hintEl.textContent = isAlignment ? "레이어 토글·수동 보정 가능" : "작품이 솟아오릅니다 · 작품을 탭해보세요";
});
engine.on("trackingLost", (e) => log(`⚠ trackingLost: ${e.reason}`));
engine.on("telemetry", (t) => {
  const a = t.anchorWorld ? `anchor(${t.anchorWorld.x},${t.anchorWorld.y},${t.anchorWorld.z})` : "anchor —";
  telemetryEl.textContent =
    `fps ${t.fps} | ${t.placed ? "placed" : t.reticleVisible ? "reticle" : "searching"} | ` +
    `phase ${t.animationPhase} | track ${t.viewerTracked ? "ok" : "LOST"}\n${a}`;
  // D. 디버그 가시성 요약(화면 표시 + 복사용 스냅샷).
  if (DEBUG && t.debug) {
    const d = t.debug;
    lastDebugText =
      `inScene=${d.inScene} visible=${d.modelVisible} inView=${d.inView} meshes=${d.meshCount}\n` +
      `pos(${d.worldPos.x},${d.worldPos.y},${d.worldPos.z}) scale=${d.scale} dist=${d.cameraDistanceM}m\n` +
      `bbox[${d.bboxSize.x}×${d.bboxSize.y}×${d.bboxSize.z}]m`;
    debugHudEl.textContent = lastDebugText;
  }
});
engine.on("hotspotSelected", (e) => log(`👆 hotspotSelected: ${e.hotspotId}`));
engine.on("experienceCompleted", (e) =>
  log(`🏁 experienceCompleted (${Math.round(e.durationMs)}ms)`)
);
engine.on("error", (e) => {
  log(`✗ error[${e.code}] ${e.message}`);
  errorEl.textContent = `⚠ ${e.message}`;
  errorEl.style.display = "block";
  // 세션 시작(requestSession) 실패는 오버레이가 아직 숨김 상태라 화면 배너로도 노출(지시 #7,#10).
  showDiag(`AR 오류[${e.code}]: ${e.message}`);
});
engine.on("sessionEnded", () => {
  log("■ sessionEnded");
  showAR(false);
  alignPanel.style.display = "none";
  dismissBtn.style.display = "";
  glbEl.textContent = "GLB: —";
});

function showAR(on: boolean): void {
  appEl.style.display = on ? "none" : "";
  overlayEl.style.display = on ? "block" : "none";
  if (on) errorEl.style.display = "none";
}

function populateLayers(): void {
  alignLayersEl.innerHTML = "";
  for (const layer of engine.getLayers()) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = layer.visible;
    cb.addEventListener("change", () => engine.setLayerVisible(layer.node, cb.checked));
    label.appendChild(cb);
    label.appendChild(document.createTextNode(LAYER_LABELS[layer.node] ?? layer.node));
    alignLayersEl.appendChild(label);
  }
}

async function refreshSupport(): Promise<void> {
  const r = await engine.checkSupport();
  if (r.supported) {
    supportEl.innerHTML = `<span class="ok">● AR 지원</span> — WebXR immersive-ar OK`;
  } else {
    supportEl.innerHTML =
      `<span class="bad">● AR 미지원</span><br><span class="warn">${r.guidanceMessage}</span>` +
      `<br><small>webxr=${r.webxr} immersive-ar=${r.immersiveAR} secure=${r.secureContext}</small>`;
  }
}

function buildStartRequest(experienceId: string): StartRequest {
  return {
    buildingId: BUILDING_ID,
    spotId: SPOT_ID,
    experienceId,
    overrides: {
      assetId: ASSET_BY_EXPERIENCE[experienceId],
      manifestUrl: MANIFEST_BY_EXPERIENCE[experienceId],
    },
  };
}

async function startExperience(experienceId: string): Promise<void> {
  isAlignment = experienceId === "facade-alignment";
  errorEl.style.display = "none";
  diagBanner.style.display = "none";
  // 세션 요청이 '사용자 활성화' 상태에서 직접 실행되는지 확인(지시 #8).
  // 이 로그는 클릭 핸들러의 동기 스택에서 실행되므로 user activation을 소비하지 않는다(주의사항 준수).
  const activation = (navigator as Navigator & { userActivation?: { isActive: boolean; hasBeenActive: boolean } })
    .userActivation;
  log(
    `→ start(${experienceId}) userActivation.isActive=${activation ? activation.isActive : "n/a"} ` +
      `hasBeenActive=${activation ? activation.hasBeenActive : "n/a"}`
  );
  const req = buildStartRequest(experienceId);
  log(`start ${experienceId}`);
  try {
    await engine.start(req);
  } catch (err) {
    log(`start 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---- 랜딩 버튼 ----
$("start-star").addEventListener("click", () => void startExperience("emergent-artwork"));
$("start-align").addEventListener("click", () => void startExperience("facade-alignment"));
$("check").addEventListener("click", () => { log("AR 지원 확인…"); void refreshSupport(); });
$("diag").addEventListener("click", async () => {
  log("환경 진단 실행 (상세는 콘솔)…");
  const d = (await engine.runDiagnostics()) as {
    hasNavigatorXR: boolean; immersiveARSupported: unknown; isSecureContext: boolean; webglAvailable: boolean;
  };
  log(`  xr=${d.hasNavigatorXR} immersive-ar=${d.immersiveARSupported} secure=${d.isSecureContext} webgl=${d.webglAvailable}`);
});

// ---- AR 오버레이 버튼 ----
dismissBtn.addEventListener("click", () => {
  log("퇴장(Disappear) 요청 — 완료 후 다시 탭하면 재배치/재등장");
  engine.dismiss();
});
stopBtn.addEventListener("click", () => { void engine.stop(); });
$("clear").addEventListener("click", () => { logEl.textContent = ""; });
// ---- 디버그 UI(테스트 모드에서만 노출) ----
if (DEBUG) {
  debugToggleBtn.style.display = "";
  debugHudEl.style.display = "block";
  debugToggleBtn.addEventListener("click", () => {
    debugCubeOn = !debugCubeOn;
    engine.setDebugCubeVisible(debugCubeOn);
    debugToggleBtn.textContent = debugCubeOn ? "큐브 끄기" : "큐브 켜기";
    log(`디버그 큐브 ${debugCubeOn ? "표시" : "숨김"}`);
  });
}

$("copy-log").addEventListener("click", async () => {
  const dbg = DEBUG && lastDebugText ? `\n[debug]\n${lastDebugText}\n` : "";
  const text = `build ${BUILD_ID}\n${navigator.userAgent}\n${dbg}\n${logEl.textContent ?? ""}`;
  try {
    await navigator.clipboard.writeText(text);
    log("📋 로그 복사됨(클립보드)");
  } catch {
    // 클립보드 API 실패 시(권한/인앱 등) 로그 영역을 선택 상태로 만들어 수동 복사 유도.
    const range = document.createRange();
    range.selectNodeContents(logEl);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    log("📋 클립보드 사용 불가 — 로그가 선택되었습니다. 길게 눌러 '복사'하세요.");
  }
});

// ---- 정합 수동 보정 버튼(data-cal) ----
const CAL: Record<string, Parameters<typeof engine.calibrate>[0]> = {
  "dx-": { dx: -TRANSLATE_STEP }, "dx+": { dx: TRANSLATE_STEP },
  "dy-": { dy: -TRANSLATE_STEP }, "dy+": { dy: TRANSLATE_STEP },
  "dz-": { dz: -TRANSLATE_STEP }, "dz+": { dz: TRANSLATE_STEP },
  "yaw-": { dyaw: -ROTATE_STEP }, "yaw+": { dyaw: ROTATE_STEP },
  "pitch-": { dpitch: -ROTATE_STEP }, "pitch+": { dpitch: ROTATE_STEP },
  "roll-": { droll: -ROTATE_STEP }, "roll+": { droll: ROTATE_STEP },
  "scale-": { dscale: SCALE_DOWN }, "scale+": { dscale: SCALE_UP },
};
alignPanel.querySelectorAll<HTMLButtonElement>("button[data-cal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const delta = CAL[btn.dataset.cal ?? ""];
    if (delta) engine.calibrate(delta);
  });
});
$("cal-save").addEventListener("click", () => log(engine.saveCalibration() ? "보정값 저장됨" : "저장 실패"));
$("cal-load").addEventListener("click", () => log(engine.loadCalibration() ? "보정값 불러옴" : "저장된 보정값 없음"));
$("cal-reset").addEventListener("click", () => { engine.resetCalibration(); log("보정값 초기화"); });

// ---- iPhone(AR Quick Look) 폴백 ----
// iOS Safari/WebKit은 WebXR 미지원 → WebXR 대신 USDZ를 브라우저에서 생성해 네이티브 AR 뷰어로 연다.
const isIOS =
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS 는 Mac 으로 위장
const quickLookSupported = (() => {
  const a = document.createElement("a");
  return !!(a.relList && a.relList.supports && a.relList.supports("ar"));
})();

if (isIOS || quickLookSupported) {
  const iosCard = $("ios-ar");
  const iosStatus = $("ios-status");
  iosCard.style.display = "";
  log(`iOS/AR Quick Look 환경 감지 — USDZ 폴백 표시 (quickLook=${quickLookSupported})`);

  const prepare = async (anchorId: string, experienceId: string, label: string): Promise<boolean> => {
    const anchor = $<HTMLAnchorElement>(anchorId);
    // 준비 전 조기 탭은 무시(앵커 href="#" 네비게이션 방지).
    anchor.addEventListener("click", (e) => {
      if (anchor.getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        return;
      }
      log(`iOS AR Quick Look 열기 시도: #${anchorId}`);
    });
    try {
      const bytes = await engine.exportExperienceUSDZ(buildStartRequest(experienceId));
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([ab], { type: "model/vnd.usdz+zip" });
      anchor.href = URL.createObjectURL(blob);
      anchor.removeAttribute("aria-disabled");
      anchor.dataset.label = label;
      log(`iOS USDZ 준비 완료: ${experienceId} (${Math.round(bytes.byteLength / 1024)}KB)`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      anchor.dataset.label = `${label} · 생성 실패`;
      log(`✗ iOS USDZ 생성 실패(${experienceId}): ${msg}`);
      showDiag(`iOS USDZ 생성 실패(${experienceId}): ${msg}`);
      return false;
    }
  };

  void (async () => {
    const ok1 = await prepare("ios-star", "emergent-artwork", "① 별의 새싹 (iPhone AR)");
    const ok2 = await prepare("ios-align", "facade-alignment", "② 외벽 정합 (iPhone AR)");
    iosStatus.textContent =
      ok1 && ok2
        ? "준비 완료 — 버튼을 탭하면 AR Quick Look이 열립니다."
        : ok1 || ok2
          ? "일부만 준비됨 — 이벤트 로그를 확인하세요."
          : "USDZ 생성 실패 — 이벤트 로그를 확인하세요.";
  })();
}

void refreshSupport();
