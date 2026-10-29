import * as THREE from "three";
import showUrl from "../../musical-assets/show.json?url";
import "./style.css";
import mindLicenseUrl from "./vendor/LICENSE.mind-ar?url";
import apacheLicenseUrl from "./vendor/LICENSE.apache-2.0?url";
import actorASampleUrl from "../../musical-assets/actor-a-demo.mp4?url";
import actorBSampleUrl from "../../musical-assets/actor-b-demo.mp4?url";
import mediaCreditsUrl from "../../musical-assets/MEDIA-CREDITS.md?url";
import { PlacementGroup, type CalibrationState } from "../core/placement";
import { validateShow, cueAt } from "./timeline";
import { makePanelReference, loadImage, roomPhoto, panelPhoto } from "./reference";
import { MusicalStage } from "./stage";
import { PerformerSlot } from "./performerSlot";
import { mountSpatialPerformer, spatialSnapshot } from "./spatial";
import { loadVolumeCalibration } from "./volumeCalibration";
import { ShowDirector } from "./director";
import { ImageTrackingHost, WebXRTrackingHost, type TrackingHost, type TrackingCallbacks } from "./tracking";
import type { VideoMode } from "./types";

const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function validCalibration(v: unknown): v is CalibrationState {
  const c = v as CalibrationState;
  return !!c && [c.position, c.rotation].every(a => Array.isArray(a) && a.length === 3 && a.every(n => Number.isFinite(n) && Math.abs(n) <= 30)) && Number.isFinite(c.scale) && c.scale >= 0.05 && c.scale <= 10;
}

export async function mountMusical(): Promise<void> {
  const response = await fetch(showUrl); if (!response.ok) throw new Error("공연 데이터를 읽지 못했습니다.");
  const show = validateShow(await response.json());
  const panel = await makePanelReference();
  document.body.classList.add("musical-body");
  document.title = "목재 무대 · 실사 AR 뮤지컬 MVP";
  const root = document.createElement("main"); root.id = "musical-app";
  root.innerHTML = `
    <div id="musical-view"></div>
    <header class="musical-header"><div><span class="musical-kicker">LIVE STAGE · MVP</span><h1>목재 무대, 30초의 공연</h1></div><button id="musical-exit" aria-label="기존 AR 화면으로 돌아가기">종료 ↗</button></header>
    <div class="musical-badges"><span id="musical-track">카메라 시작 전</span><span id="musical-fps">실기기 미검증</span></div>
    <section class="musical-console" aria-label="공연 제어">
      <p id="musical-status" role="status" aria-live="polite">사진 속 산수화 패널을 표적으로 준비하세요.</p>
      <p id="musical-error" role="alert" hidden></p>
      <div class="musical-progress"><progress id="musical-progress" max="30" value="0"></progress><output id="musical-time">0.0 / 30초</output></div>
      <div class="musical-actions musical-primary"><button id="musical-camera" class="gold">1. AR 카메라 시작</button><button id="musical-confirm" disabled>2. 정합 확정</button><button id="musical-play" class="gold" disabled>3. 공연 시작</button></div>
      <div class="musical-actions"><button id="musical-pause" disabled>일시정지</button><button id="musical-replay" disabled>다시 보기</button><button id="musical-photo" disabled>사진 촬영</button></div>
      <p class="musical-note" id="musical-media-status">실사 영상 없음 · 아래에서 배우 영상 2개를 선택하세요.</p>
      <p class="musical-note" id="musical-representation">1단계: 건물 좌표에 고정한 실사 영상 평면 · 완전한 입체 인물 아님</p>
      <details id="musical-setup" open><summary>공연 준비 · 영상과 추적</summary><div class="musical-settings">
        <label>실행 경로<select id="musical-backend"><option value="image">iPhone·Android 공통 — 이미지 표적 추적</option><option value="webxr">Android — WebXR 바닥 배치 후 벽 정합</option></select></label>
        <p class="musical-note">공통 경로는 표적의 위치·회전을 추적합니다. 표적이 안 보이면 숨김·정지하며, 화면 밖에서도 유지되는 SLAM은 아닙니다. 평면 영상은 옆에서 보면 얇아 보입니다.</p>
        <div class="musical-references"><a target="_blank" rel="noopener" href="${roomPhoto}"><img src="${roomPhoto}" alt="목재 격자문과 기둥 참고 사진" /></a><a target="_blank" rel="noopener" href="${panelPhoto}"><img src="${panelPhoto}" alt="산수화 패널 참고 사진" /></a><div id="musical-target-preview" title="보정된 산수화 표적"></div></div>
        <label>표적 실제 너비(m) <input id="musical-target-width" type="number" min="0.1" max="10" step="0.01" value="${show.building.target.widthMeters}" /></label>
        <p class="musical-note">사진 기반 치수·깊이는 임시값입니다. 기본 표적은 사진 2의 산수화 패널을 원근 보정했습니다. 반복 격자보다 패널 전체를 비추세요. 인식이 어려우면 정면에서 찍은 패널 사진으로 교체하세요.</p>
        <label>정면 표적 사진 교체<input id="musical-target-image" type="file" accept="image/*" /></label>
        <div class="musical-actions"><button id="musical-compile">표적 준비</button><button id="musical-download-target" disabled>표적 파일 저장</button><button id="musical-download-image">보정 표적 이미지</button></div>
        <label>기존 .mind 표적 불러오기<input id="musical-target-file" type="file" accept=".mind" /></label>
        <button id="musical-samples">실사 샘플 배우 2명 불러오기</button>
        <p class="musical-note">Pexels 허용 조건을 확인한 움직이는 실사 샘플입니다. Yoshi Mura / SERGEY ZIMA 촬영. 지역 공연자의 최종 공연본이 아닙니다. <a href="${mediaCreditsUrl}" download="MEDIA-CREDITS.md">영상 출처·사용 조건</a></p>
        ${show.actors.map((a, i) => `<label>${a.label} 실사 영상 교체<input id="musical-video-${i}" type="file" accept="video/mp4,video/webm,video/quicktime" /></label><label>${a.label} 배경 처리<select id="musical-video-mode-${i}"><option value="packed">MP4 좌:컬러 / 우:흑백 알파 (권장)</option><option value="alpha">네이티브 알파 영상 (기기별 확인)</option><option value="chroma">녹색 배경 크로마키</option></select></label>`).join("")}
        <label>공연 음악(30초 이상, 선택)<input id="musical-audio" type="file" accept="audio/*" /></label>
        <p class="musical-note">권리가 확인된 파일만 선택하세요. 파일은 이 기기에서만 재생하며 서버에 업로드하지 않습니다. 미선택 시 합성 테스트 음악을 사용합니다. 짧은 배우 영상은 타임라인 동안 반복합니다.</p>
        <div class="musical-actions"><button id="musical-test" disabled>카드·조명 테스트</button><button id="musical-preview">개발 무대 미리보기</button></div>
      </div></details>
      <details id="musical-developer"><summary>개발자 정합 · 임시 치수</summary><div class="musical-settings">
        <label>조정 대상<select id="musical-selection"><option value="stage">무대 전체</option>${show.actors.map((a, i) => `<option value="${i}">${a.label}</option>`).join("")}</select></label>
        <div class="musical-nudges">${["x−", "x+", "y−", "y+", "z−", "z+", "yaw−", "yaw+", "pitch−", "pitch+", "roll−", "roll+", "작게", "크게"].map((n, i) => `<button data-nudge="${i}">${n}</button>`).join("")}</div>
        <div class="musical-toggles"><label><input id="musical-building" type="checkbox" /> 정합 모델 표시</label><label><input id="musical-occlusion" type="checkbox" /> 임시 기둥 가림 모델</label></div>
        <p class="musical-note">위치 ±0.05m · 회전 ±1° · 크기 ±2%. 가림 모델은 실물과 맞춘 뒤에 켜세요. 배우 배치는 door/panel 앵커의 로컬 좌표입니다.</p>
        <div class="musical-actions"><button id="musical-save">정합 저장</button><button id="musical-load">불러오기</button><button id="musical-reset">초기화</button><button id="musical-report">진단 저장</button></div>
        <output id="musical-transform"></output>
        ${show.actors.map((a, i) => `<label>${a.label} 등장 시각(초)<input id="musical-start-${i}" type="number" min="0" max="${a.end - .1}" step=".1" value="${a.start}" /></label><label>${a.label} 3D 캡처 시퀀스 (.vseq.json + 모든 GLB)<input id="musical-volume-${i}" type="file" multiple accept=".json,.glb" /></label>`).join("")}
        <button id="musical-volume-test">3D 시퀀스 로더 검증 — 도형·실사 인물 아님</button>
        <p class="musical-note">실사 3D 캡처는 아직 미제공입니다. 검증 도형은 실사 공연 시작으로 재생하지 않습니다. 3D 입력은 배우별 48MiB 이내의 사전 로드 방식입니다.</p>
        <div class="musical-actions"><button data-view="-35" disabled>미리보기 왼쪽</button><button data-view="0" disabled>미리보기 정면</button><button data-view="35" disabled>미리보기 오른쪽</button></div>
        <output id="musical-spatial"></output>
        <p class="musical-note">MindAR 1.2.5 · <a href="${mindLicenseUrl}" download="LICENSE.mind-ar">MIT 라이선스</a> · <a href="${apacheLicenseUrl}" download="LICENSE.apache-2.0">TensorFlow.js Apache 2.0</a></p>
      </div></details>
    </section>`;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#musical-${id}`)!;
  $("target-preview").appendChild(panel);
  root.querySelectorAll("button, input, select, summary").forEach(el => el.addEventListener("beforexrselect", e => e.preventDefault()));
  const status = (text: string) => { $("status").textContent = text; };
  let host: TrackingHost | undefined, preview = false, confirmed = false, target: Uint8Array | undefined;
  let targetCanvas: HTMLCanvasElement | HTMLImageElement = panel, targetHash = "", compiling = false, active = false, disposed = false;
  let epoch = 0, lastUi = 0, lastFps = performance.now(), frames = 0, fps = 0, decoderFailures = 0, mediaBusy = false;
  const actorSources: string[] = show.actors.map(() => "none");
  const stage = new MusicalStage(show.building, panel), placement = new PlacementGroup();
  placement.attach(stage.root); placement.placeAt(new THREE.Matrix4().elements, true);
  const actors = show.actors.map(a => new PerformerSlot(a, message => fail(message)));
  for (const actor of actors) {
    actor.video.dataset.actorId = actor.config.id; actor.video.setAttribute("aria-hidden", "true");
    actor.video.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none";
    root.appendChild(actor.video);
    mountSpatialPerformer(stage.root, stage.anchors, actor);
  }
  const director = new ShowDirector(show, actors, (time, state) => {
    const cue = cueAt(show, time); stage.sample(time, cue.light, cue.particles);
    $("progress").setAttribute("value", String(time)); $("time").textContent = `${time.toFixed(1)} / ${show.duration}초`;
    root.dataset.playback = state; root.dataset.time = time.toFixed(3);
    if (state === "completed") status(`${director.testMode ? "테스트" : "공연"} 종료 · 다시 보기를 누르세요.`);
  });
  function fail(message: string): void {
    decoderFailures++; $("error").hidden = false; $("error").textContent = message; director.pause(); updateButtons();
  }
  function updateButtons(): void {
    const ready = !!host?.tracked && confirmed;
    $<HTMLButtonElement>("camera").disabled = active || compiling || ($<HTMLSelectElement>("backend").value === "image" && !target);
    $<HTMLButtonElement>("confirm").disabled = !host?.tracked || confirmed;
    const missingMedia = actors.some(a => !a.loaded), synthetic = actors.some(a => a.contentKind === "synthetic-calibration");
    $<HTMLButtonElement>("play").disabled = !ready || mediaBusy || synthetic || (missingMedia && !director.testMode) || director.state === "playing";
    $("play").textContent = director.testMode && missingMedia ? "테스트 재개" : director.state === "paused" ? "공연 재개" : "3. 공연 시작";
    $<HTMLButtonElement>("test").disabled = !ready || mediaBusy || director.state === "playing";
    $<HTMLButtonElement>("pause").disabled = director.state !== "playing";
    $<HTMLButtonElement>("replay").disabled = !ready || mediaBusy || director.state === "playing";
    $<HTMLButtonElement>("photo").disabled = !host?.tracked || preview || $<HTMLSelectElement>("backend").value === "webxr";
    $<HTMLButtonElement>("preview").disabled = active || compiling;
    $<HTMLButtonElement>("samples").disabled = mediaBusy || director.state === "playing";
    $<HTMLButtonElement>("volume-test").disabled = mediaBusy || director.state === "playing";
    root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => { button.disabled = !preview; });
    for (const id of ["target-image", "target-file", "target-width", "backend", "compile"]) $<HTMLInputElement>(id).disabled = active || compiling;
    $("media-status").textContent = `${actors.filter(a => a.loaded).length}/${actors.length} 공연 객체 로드${actorSources.includes("sample") ? " · 라이선스 샘플 포함" : ""} · ${director.audioLabel}${director.testMode ? " · 카드 테스트 모드" : ""}`;
    $("representation").textContent = actors.map(a => `${a.config.label}: ${a.representation === "spatial-video-plane" ? "공간 고정 영상 평면(입체 인물 아님)" : a.contentKind === "synthetic-calibration" ? "3D 검증 도형(실사 인물 아님)" : "3D 캡처 시퀀스(제공자 메타데이터)"}`).join(" · ");
    $("test").textContent = synthetic ? "3D 도형 기술 테스트(실사 아님)" : "카드·조명 테스트";
    const spatial = spatialSnapshot(stage.root, actors, host?.camera);
    root.dataset.spatialAnchored = String(spatial.every(a => a.belongsToStage && !a.attachedToCamera));
    root.dataset.frameIndices = JSON.stringify(actors.map(a => a.frameIndex));
    root.dataset.representations = JSON.stringify(actors.map(a => a.representation));
    $("spatial").textContent = spatial.every(a => a.belongsToStage && !a.attachedToCamera) ? "배우 객체: 건물 로컬 앵커에 연결됨 · 카메라 자식/화면 오버레이 아님" : "공간 연결 오류";
  }
  async function useTarget(bytes: Uint8Array): Promise<void> {
    if (bytes.length < 100 || bytes.length > 30_000_000) throw new Error("표적 데이터 크기를 확인하세요.");
    target = bytes; const hash = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    targetHash = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("").slice(0, 20);
    $<HTMLButtonElement>("download-target").disabled = false; status("표적 준비 완료 · 영상 2개를 선택하고 AR 카메라를 시작하세요."); updateButtons();
  }
  async function compileTarget(): Promise<void> {
    if (compiling || active) return;
    compiling = true; updateButtons(); status("표적 특징점 준비 중… 처음에는 시간이 걸릴 수 있습니다.");
    try {
      const { Compiler } = await import("./vendor/mindar-image.prod.js"); const compiler = new Compiler();
      let timer = 0;
      try {
        await Promise.race([compiler.compileImageTargets([targetCanvas], percent => status(`표적 준비 ${percent.toFixed(0)}%`)), new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error("표적 준비 시간 초과. PC에서 준비한 .mind 파일을 불러오세요.")), 120000); })]);
      } finally { clearTimeout(timer); }
      if (!disposed) await useTarget(compiler.exportData());
    } catch (e) { fail(errorText(e)); }
    finally { compiling = false; updateButtons(); }
  }
  $("compile").addEventListener("click", () => void compileTarget());
  $("download-target").addEventListener("click", () => { if (target) download(new Blob([new Uint8Array(target)]), "panel.mind"); });
  $("download-image").addEventListener("click", () => panel.toBlob(blob => { if (blob) download(blob, "panel-reference.png"); }));
  $("target-image").addEventListener("change", () => void (async () => {
    const file = $<HTMLInputElement>("target-image").files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    try { const image = await loadImage(url); const c = document.createElement("canvas"), scale = Math.min(1, 900 / Math.max(image.width, image.height)); c.width = Math.round(image.width * scale); c.height = Math.round(image.height * scale); c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height); targetCanvas = c; $("target-preview").replaceChildren(c); target = undefined; updateButtons(); status("새 표적 사진의 ‘표적 준비’를 누르세요."); } catch (e) { fail(errorText(e)); } finally { URL.revokeObjectURL(url); }
  })());
  $("target-file").addEventListener("change", () => void (async () => { const file = $<HTMLInputElement>("target-file").files?.[0]; if (file) try { await useTarget(new Uint8Array(await file.arrayBuffer())); } catch (e) { fail(errorText(e)); } })());
  actors.forEach((actor, i) => {
    const load = async () => {
      const file = $<HTMLInputElement>(`video-${i}`).files?.[0]; if (!file) return;
      director.pause(); status(`${actor.config.label} 로딩 중…`);
      try { await actor.load(file, $<HTMLSelectElement>(`video-mode-${i}`).value as VideoMode); actorSources[i] = "local"; root.dataset.mediaSource = "local"; status(`${actor.config.label} 영상 준비 완료`); } catch (e) { fail(errorText(e)); } updateButtons();
    };
    $(`video-${i}`).addEventListener("change", () => void load()); $(`video-mode-${i}`).addEventListener("change", () => void load());
    $(`start-${i}`).addEventListener("change", () => {
      const time = Number($<HTMLInputElement>(`start-${i}`).value);
      if (!Number.isFinite(time) || time < 0 || time >= actor.config.end) { fail("등장 시각은 0초 이상, 퇴장 시각보다 앞이어야 합니다."); return; }
      director.pause(); actor.config.start = time; director.tick(); updateButtons();
    });
    $(`volume-${i}`).addEventListener("change", () => void (async () => {
      const files = $<HTMLInputElement>(`volume-${i}`).files; if (!files?.length || mediaBusy) return;
      director.pause(); mediaBusy = true; updateButtons(); status(`${actor.config.label} 3D 프레임 로드 중…`);
      try { await actor.loadSequenceFiles(files); actorSources[i] = actor.contentKind; status(`${actor.config.label} 3D 시퀀스 ${actor.frameCount}프레임 준비. 실사 여부는 입력 출처를 확인하세요.`); }
      catch (e) { fail(errorText(e)); } finally { mediaBusy = false; updateButtons(); }
    })());
  });
  $("volume-test").addEventListener("click", () => void (async () => {
    if (mediaBusy) return; director.restart(); mediaBusy = true; updateButtons(); status("인물이 아닌 3D 검증 도형을 로드합니다…");
    try { await loadVolumeCalibration(actors); actorSources.fill("synthetic-calibration"); root.dataset.mediaSource = "volume-calibration"; status("3D 도형 준비 · 기술 테스트 버튼으로 재생하세요. 실사 볼류메트릭 촬영본은 아직 없습니다."); }
    catch (e) { fail(errorText(e)); } finally { mediaBusy = false; updateButtons(); }
  })());
  $("samples").addEventListener("click", () => void (async () => {
    if (mediaBusy) return;
    director.pause(); mediaBusy = true; root.dataset.mediaSource = "loading-samples"; updateButtons(); status("라이선스 확인된 실사 샘플 2개 로드 중…");
    try {
      await Promise.all([actorASampleUrl, actorBSampleUrl].map(async (url, i) => {
        const response = await fetch(url); if (!response.ok) throw new Error(`샘플 영상 로드 실패 (${response.status})`);
        const file = new File([await response.blob()], `licensed-sample-${i + 1}.mp4`, { type: "video/mp4" });
        if (disposed) return;
        await actors[i].load(file, "packed"); actorSources[i] = "sample";
        $<HTMLSelectElement>(`video-mode-${i}`).value = "packed"; $<HTMLInputElement>(`video-${i}`).value = "";
      }));
      root.dataset.mediaSource = "samples"; status("실사 샘플 2명 준비 완료 · AR 카메라와 정합을 확인한 뒤 공연을 시작하세요.");
    } catch (e) { root.dataset.mediaSource = "sample-error"; fail(errorText(e)); }
    finally { mediaBusy = false; updateButtons(); }
  })());
  $("audio").addEventListener("change", () => void (async () => {
    const file = $<HTMLInputElement>("audio").files?.[0]; if (!file) return;
    try { await director.loadAudio(file); status("공연 음악 준비 완료"); } catch (e) { fail(errorText(e)); } updateButtons();
  })());
  const callbacks: TrackingCallbacks = {
    frame: () => {
      director.tick(); const now = performance.now(); frames++;
      if (now - lastFps >= 1000) { fps = Math.round(frames * 1000 / (now - lastFps)); frames = 0; lastFps = now; }
      if (now - lastUi >= 250) { $("fps").textContent = `${fps} fps · ${preview ? "개발 미리보기" : "실기기 검증 기록 전"}`; if (director.state === "playing") status(`${director.testMode ? "카드 테스트 · " : ""}${director.cue}`); updateButtons(); lastUi = now; }
    },
    tracking: tracked => {
      $("track").textContent = tracked ? "표적 추적 중 · 이미지 기준 6DoF" : "표적 찾는 중 · 공연 숨김";
      root.dataset.tracking = String(tracked);
      if (!tracked) { director.pause(); status("표적을 다시 비추세요. 복귀 후 시작 버튼으로 재개합니다."); }
      else status(confirmed ? "추적 복귀 · 시작 버튼으로 공연을 재개하세요." : "정합 모델을 확인하고 ‘정합 확정’을 누르세요."); updateButtons();
    }, error: fail, ended: () => { director.pause(); $("track").textContent = "AR 세션 종료"; updateButtons(); },
  };
  async function startCamera(): Promise<void> {
    if (active) return;
    const width = Number($<HTMLInputElement>("target-width").value);
    if (!Number.isFinite(width) || width < 0.1 || width > 10) { fail("표적 너비는 0.1~10m 안에서 입력하세요."); return; }
    show.building.target.widthMeters = width; active = true; preview = false; confirmed = false; const generation = ++epoch;
    stage.building.visible = true; $<HTMLInputElement>("building").checked = true;
    $("error").hidden = true; updateButtons();
    const mode = $<HTMLSelectElement>("backend").value;
    host = mode === "webxr" ? new WebXRTrackingHost(root, $("view"), placement.group, { ...callbacks, tracking: tracked => { callbacks.tracking(tracked); $("track").textContent = tracked ? "WebXR 월드 좌표 배치" : "바닥을 비추고 링을 탭하세요"; } }) : new ImageTrackingHost($("view"), placement.group, target!, show.building, callbacks);
    root.dataset.mode = mode; status(mode === "webxr" ? "바닥 링을 탭해 무대를 배치한 뒤 개발자 정합으로 벽에 맞추세요." : "카메라 준비 중… 산수화 패널 전체를 비추세요.");
    try { await host.start(); if (generation !== epoch) return; $("track").textContent = mode === "webxr" ? "바닥을 비추고 링을 탭하세요" : "산수화 패널 표적 찾는 중"; }
    catch (e) { host.dispose(); host = undefined; active = false; fail(errorText(e)); updateButtons(); }
  }
  $("camera").addEventListener("click", () => void startCamera());
  $("backend").addEventListener("change", updateButtons);
  $("confirm").addEventListener("click", () => { if (!host?.tracked) return; confirmed = true; stage.building.visible = false; $<HTMLInputElement>("building").checked = false; $<HTMLDetailsElement>("setup").open = false; status("정합 완료 · 실사 영상을 준비했다면 공연을 시작하세요."); updateButtons(); });
  async function play(testMode: boolean): Promise<void> {
    if (!host?.tracked || !confirmed || mediaBusy) return;
    $("error").hidden = true;
    try { await director.play(testMode); $<HTMLDetailsElement>("setup").open = false; } catch (e) { fail(errorText(e)); } updateButtons();
  }
  $("play").addEventListener("click", () => void play(director.testMode && actors.some(a => !a.loaded || a.contentKind === "synthetic-calibration")));
  $("test").addEventListener("click", () => void play(true));
  $("pause").addEventListener("click", () => { director.pause(); status("일시정지 · 시작 버튼으로 재개"); updateButtons(); });
  $("replay").addEventListener("click", () => { const test = director.testMode; director.restart(); void play(test); });
  $("photo").addEventListener("click", () => void (async () => { try { if (host) download(await host.capture(), "ar-musical.png"); } catch (e) { fail(errorText(e)); } })());

  // Explicit desktop rehearsal, no camera or spatial-tracking success claim.
  $("preview").addEventListener("click", () => {
    if (active) return;
    preview = true; confirmed = true; active = true; root.dataset.mode = "preview";
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize($("view").clientWidth, $("view").clientHeight);
    $("view").appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x17202a); scene.add(placement.group, new THREE.HemisphereLight(0xfff6e5, 0x536376, 3));
    const camera = new THREE.PerspectiveCamera(46, $("view").clientWidth / $("view").clientHeight, 0.01, 100);
    const fit = Math.max(6, show.building.width / (2 * Math.tan(THREE.MathUtils.degToRad(23)) * camera.aspect) * 1.08);
    camera.position.set(0, 1.5, -fit); camera.lookAt(0, 1.3, 0);
    stage.building.visible = true; $<HTMLInputElement>("building").checked = true;
    host = { renderer, scene, camera, tracked: true, start: async () => {}, capture: async () => { throw new Error("개발 미리보기는 AR 촬영이 아닙니다."); }, dispose: () => { renderer.setAnimationLoop(null); renderer.dispose(); renderer.domElement.remove(); } };
    renderer.setAnimationLoop(() => { callbacks.frame(); renderer.render(scene, camera); });
    $("track").textContent = "개발 미리보기 · 카메라 AR 아님"; status("무대·타임라인 개발 미리보기입니다. 실기기 AR 검증으로 기록하지 않습니다."); updateButtons();
  });
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => button.addEventListener("click", () => {
    if (!preview || !host) return;
    const center = new THREE.Vector3(0, 1.3, 0), distance = host.camera.position.distanceTo(center), angle = THREE.MathUtils.degToRad(Number(button.dataset.view));
    host.camera.position.set(Math.sin(angle) * distance, 1.5, -Math.cos(angle) * distance); host.camera.lookAt(center);
    root.dataset.previewAngle = button.dataset.view; updateButtons();
  }));
  $("building").addEventListener("change", () => { stage.building.visible = $<HTMLInputElement>("building").checked; });
  $("occlusion").addEventListener("change", () => { stage.occlusion.visible = $<HTMLInputElement>("occlusion").checked; });
  const selected = () => { const value = $<HTMLSelectElement>("selection").value; return value === "stage" ? placement.group : actors[Number(value)].group; };
  function showTransform(): void { const o = selected(); $("transform").textContent = `위치 ${o.position.toArray().map(n => n.toFixed(2)).join(", ")} m · yaw ${(o.rotation.y * 180 / Math.PI).toFixed(1)}° · 배율 ${o.scale.x.toFixed(2)}`; }
  $("selection").addEventListener("change", showTransform);
  root.querySelectorAll<HTMLButtonElement>("[data-nudge]").forEach(button => button.addEventListener("click", () => {
    const i = Number(button.dataset.nudge), o = selected(), sign = i % 2 ? 1 : -1;
    if (i < 6) o.position.setComponent(Math.floor(i / 2), o.position.getComponent(Math.floor(i / 2)) + sign * 0.05);
    else if (i < 12) { const axis = ["y", "x", "z"][Math.floor((i - 6) / 2)] as "x" | "y" | "z"; o.rotation[axis] += sign * Math.PI / 180; }
    else o.scale.setScalar(THREE.MathUtils.clamp(o.scale.x * (i === 13 ? 1.02 : 1 / 1.02), 0.05, 10)); showTransform();
  }));
  const key = () => `musical-calib:v1:${show.building.id}:${targetHash || "webxr"}:${show.building.target.widthMeters}`;
  const serialize = (o: THREE.Object3D): CalibrationState => ({ position: o.position.toArray() as [number, number, number], rotation: [o.rotation.x, o.rotation.y, o.rotation.z], scale: o.scale.x });
  const apply = (o: THREE.Object3D, c: CalibrationState) => { o.position.fromArray(c.position); o.rotation.set(...c.rotation); o.scale.setScalar(c.scale); };
  $("save").addEventListener("click", () => { try { localStorage.setItem(key(), JSON.stringify({ stage: placement.getCalibration(), actors: actors.map(a => serialize(a.group)) })); status("표적 기준 로컬 정합값을 저장했습니다. WebXR 세션 위치는 저장하지 않습니다."); } catch (e) { fail(errorText(e)); } });
  $("load").addEventListener("click", () => { try { const data = JSON.parse(localStorage.getItem(key()) ?? "null"); if (!data || !validCalibration(data.stage) || !Array.isArray(data.actors) || data.actors.length !== actors.length || !data.actors.every(validCalibration)) throw new Error("이 표적의 유효한 저장값이 없습니다."); placement.applyCalibration(data.stage); actors.forEach((a, i) => apply(a.group, data.actors[i])); showTransform(); status("로컬 정합값 적용 완료 · 실물과 일치하는지 확인하세요."); } catch (e) { fail(errorText(e)); } });
  $("reset").addEventListener("click", () => { placement.reset(); placement.placeAt(new THREE.Matrix4().elements, true); actors.forEach(a => a.applyTransform()); showTransform(); });
  $("report").addEventListener("click", () => download(new Blob([JSON.stringify({ show: show.id, userAgent: navigator.userAgent, secure: isSecureContext, mode: root.dataset.mode, target: targetHash, targetWidthMeters: show.building.target.widthMeters, provisionalDimensions: true, poseTrackedNow: !preview && (host?.tracked ?? false), performerVideoSlotsLoaded: actors.filter(a => a.loaded).length, mediaSources: actorSources, duration: director.time, playback: director.state, testMode: director.testMode, fps, decoderFailures, deviceARVerified: false, trueVolumetricHumanFootageVerified: false, performers: spatialSnapshot(stage.root, actors, host?.camera), note: "진단 수치는 기기 검증 합격을 자동 선언하지 않습니다. 실제 움직임·정합·고정·동기를 수동 확인하세요." }, null, 2)], { type: "application/json" }), "musical-diagnostics.json"));
  function cleanup(): void { if (disposed) return; disposed = true; epoch++; director.dispose(); host?.dispose(); actors.forEach(a => { a.dispose(); a.group.removeFromParent(); }); stage.dispose(); }
  $("exit").addEventListener("click", () => { cleanup(); const url = new URL(location.href); url.searchParams.delete("musical"); location.assign(url.href); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { director.pause(); updateButtons(); } });
  window.addEventListener("pagehide", cleanup, { once: true });
  window.addEventListener("unhandledrejection", e => { if (!disposed) fail(`실행 오류: ${errorText(e.reason)}`); });
  showTransform(); updateButtons();
  // Precompiled target is optional during development; no expensive compilation on a phone by default.
  const bundled = new URL("../../musical-assets/panel.mind", import.meta.url);
  try { const r = await fetch(bundled); if (r.ok && !r.headers.get("content-type")?.includes("text/html")) await useTarget(new Uint8Array(await r.arrayBuffer())); } catch { /* Offer explicit compiler/upload controls. */ }
}
