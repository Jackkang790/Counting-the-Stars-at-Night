// 독립 테스트 하네스 — 엔진을 수동 검증하기 위한 최소 UI.
import { createARExperience } from "./index";
import type { StartRequest, ARMode } from "./types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const supportEl = $("support");
const logEl = $("log");
const startBtn = $<HTMLButtonElement>("start");
const stopBtn = $<HTMLButtonElement>("ar-stop");
const dismissBtn = $<HTMLButtonElement>("ar-dismiss");
const appEl = $("app");
const overlayEl = $("ar-overlay");
const hintEl = $("ar-hint");
const telemetryEl = $("ar-telemetry");
const loadStatusEl = $("loadStatus");

function log(msg: string): void {
  const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  logEl.textContent += `[${time}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// 체험 → Codex 에셋 id 매핑(테스트용). 실제 서비스에서는 catalog.json이 담당.
const ASSET_BY_EXPERIENCE: Record<string, string> = {
  "emergent-artwork": "starseed_sculpture",
};

const engine = createARExperience({
  // assetManifestUrl 기본값: /models/asset-manifest.json (Codex 산출물)
});

// 이벤트 배선 (contracts/ar-api.md)
engine.on("sessionStarted", () => { log("▶ sessionStarted"); showAR(true); });
engine.on("assetProgress", (e) =>
  log(`… assetProgress ${e.total ? Math.round((e.loaded / e.total) * 100) + "%" : e.loaded + "B"}`)
);
engine.on("ready", (e) => {
  if (e.source === "glb") {
    log(`✓ ready — Codex GLB 로드됨: ${e.url}`);
    log(`   clips=[${e.clips.join(", ")}]`);
    loadStatusEl.innerHTML = `에셋 로드 상태: <span class="ok">Codex GLB</span> · clips=[${e.clips.join(", ")}]`;
  } else {
    log(`✓ ready — ⚠ 임시 모델(Codex GLB 아님)`);
    loadStatusEl.innerHTML = `에셋 로드 상태: <span class="warn">임시 모델(폴백)</span>`;
  }
  hintEl.textContent = "바닥을 비추고 화면을 탭하세요 (배치 → Emerge→Idle)";
});
engine.on("placed", () => { log("📍 placed"); hintEl.textContent = "작품이 솟아오릅니다 · 작품을 탭해보세요"; });
engine.on("trackingLost", (e) => log(`⚠ trackingLost: ${e.reason}`));
engine.on("telemetry", (t) => {
  const a = t.anchorWorld ? `anchor(${t.anchorWorld.x},${t.anchorWorld.y},${t.anchorWorld.z})` : "anchor —";
  telemetryEl.textContent =
    `fps ${t.fps} | ${t.placed ? "placed" : t.reticleVisible ? "reticle" : "searching"} | ` +
    `phase ${t.animationPhase} | track ${t.viewerTracked ? "ok" : "LOST"}\n${a}`;
});
engine.on("hotspotSelected", (e) => log(`👆 hotspotSelected: ${e.hotspotId}`));
engine.on("experienceCompleted", (e) =>
  log(`🏁 experienceCompleted (${Math.round(e.durationMs)}ms) — 외부 서비스가 보상 처리`)
);
engine.on("error", (e) => log(`✗ error[${e.code}] ${e.message}`));
engine.on("sessionEnded", () => { log("■ sessionEnded"); showAR(false); });

function showAR(on: boolean): void {
  appEl.style.display = on ? "none" : "";
  overlayEl.style.display = on ? "block" : "none";
}

async function refreshSupport(): Promise<void> {
  const r = await engine.checkSupport();
  if (r.supported) {
    supportEl.innerHTML = `<span class="ok">● AR 지원</span> — WebXR immersive-ar OK`;
    startBtn.disabled = false;
  } else {
    supportEl.innerHTML =
      `<span class="bad">● AR 미지원</span><br><span class="warn">${r.guidanceMessage}</span>` +
      `<br><small>webxr=${r.webxr} immersive-ar=${r.immersiveAR} secure=${r.secureContext}</small>`;
    startBtn.disabled = true;
  }
}

startBtn.addEventListener("click", async () => {
  const experienceId = $<HTMLSelectElement>("experienceId").value;
  const req: StartRequest = {
    buildingId: $<HTMLSelectElement>("buildingId").value,
    spotId: $<HTMLSelectElement>("spotId").value,
    experienceId,
    overrides: {
      assetId: ASSET_BY_EXPERIENCE[experienceId],
      forcePlaceholder: $<HTMLSelectElement>("forcePlaceholder").value === "true",
    },
  };
  // mode는 엔진 옵션이지만 데모 편의로 로그만 남김(현 프로토타입은 geo/demo 동일 배치).
  const mode = $<HTMLSelectElement>("mode").value as ARMode;
  log(`start ${req.buildingId}/${req.spotId}/${req.experienceId} (mode=${mode})`);
  try {
    await engine.start(req);
  } catch (err) {
    log(`start 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
});

dismissBtn.addEventListener("click", () => {
  log("퇴장(Disappear) 요청 — 완료 후 다시 탭하면 재배치/재등장");
  engine.dismiss();
});
stopBtn.addEventListener("click", () => { void engine.stop(); });
$("clear").addEventListener("click", () => { logEl.textContent = ""; });
$("diag").addEventListener("click", async () => {
  log("환경 진단 실행 (상세는 콘솔)…");
  const d = (await engine.runDiagnostics()) as {
    hasNavigatorXR: boolean; immersiveARSupported: unknown; isSecureContext: boolean; webglAvailable: boolean;
  };
  log(`  xr=${d.hasNavigatorXR} immersive-ar=${d.immersiveARSupported} secure=${d.isSecureContext} webgl=${d.webglAvailable}`);
});

void refreshSupport();
