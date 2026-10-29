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

const engine = createARExperience({});

// ---- 이벤트 배선 (contracts/ar-api.md) ----
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
});
engine.on("hotspotSelected", (e) => log(`👆 hotspotSelected: ${e.hotspotId}`));
engine.on("experienceCompleted", (e) =>
  log(`🏁 experienceCompleted (${Math.round(e.durationMs)}ms)`)
);
engine.on("error", (e) => {
  log(`✗ error[${e.code}] ${e.message}`);
  errorEl.textContent = `⚠ ${e.message}`;
  errorEl.style.display = "block";
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

async function startExperience(experienceId: string): Promise<void> {
  isAlignment = experienceId === "facade-alignment";
  errorEl.style.display = "none";
  const req: StartRequest = {
    buildingId: BUILDING_ID,
    spotId: SPOT_ID,
    experienceId,
    overrides: {
      assetId: ASSET_BY_EXPERIENCE[experienceId],
      manifestUrl: MANIFEST_BY_EXPERIENCE[experienceId],
    },
  };
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

void refreshSupport();
