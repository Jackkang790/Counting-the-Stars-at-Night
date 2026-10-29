import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const repo = resolve(import.meta.dirname, "../..");
const { chromium } = await import(pathToFileURL(resolve(repo, process.env.PLAYWRIGHT_MODULE ?? ".tmp/musical-qa/node_modules/playwright/index.mjs")).href);
const base = process.argv[2] ?? process.env.MUSICAL_TEST_URL ?? "https://localhost:5187/";
const out = resolve(repo, ".tmp/musical-evidence"); mkdirSync(out, { recursive: true });
const videoFixture = resolve(out, "synthetic-packed-test.mp4");
if (!existsSync(videoFixture)) execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-f", "lavfi", "-i", "testsrc2=size=160x240:rate=24:duration=2", "-f", "lavfi", "-i", "color=white:size=160x240:rate=24:duration=2", "-filter_complex", "[1:v]drawbox=x=0:y=0:w=20:h=ih:color=black:t=fill[a];[0:v][a]hstack=inputs=2[v]", "-map", "[v]", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoFixture]);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-certificate-errors"] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 412, height: 915 }, acceptDownloads: true });
const page = await context.newPage(), errors = [];
page.on("pageerror", e => { errors.push(e.message); console.log("PAGE ERROR", e.message); });
const report = { testedUrl: base, browser: browser.version(), realPhoneTests: "NOT RUN", projectPerformerMedia: "NOT PROVIDED", licensedStockSamples: "included; tested below", checks: [] };
try {
  await page.goto(base); await page.locator("#musical-launcher").waitFor();
  assert.ok(await page.locator("#start-star").isVisible()); assert.ok(await page.locator("#start-align").isVisible()); report.checks.push("existing page and original buttons available");
  await page.locator("#musical-launcher a").click(); await page.locator("#musical-app").waitFor();
  if (await page.locator("#musical-camera").isDisabled()) {
    console.log("Compiling the supplied photo target in real WebGL...");
    await page.locator("#musical-compile").click();
    await page.waitForFunction(() => !document.querySelector("#musical-download-target").disabled, undefined, { timeout: 150000 });
    const downloadEvent = page.waitForEvent("download"); await page.locator("#musical-download-target").click();
    await (await downloadEvent).saveAs(resolve(repo, "ar-engine/musical-assets/panel.mind"));
  }
  report.checks.push("compiled supplied-photo MindAR target loads");
  const targetPng = await page.locator("#musical-target-preview canvas").evaluate(c => c.toDataURL("image/png"));
  await page.screenshot({ path: resolve(out, "mobile-setup.png") });
  await page.locator("#musical-preview").click();
  assert.match(await page.locator("#musical-track").textContent(), /카메라 AR 아님/);
  assert.equal(await page.locator("#musical-play").isDisabled(), true); report.checks.push("real show refuses missing actor videos; preview explicitly marked non-AR");
  await page.locator("#musical-test").click(); await page.waitForFunction(() => Number(document.querySelector("#musical-app").dataset.time) > 1);
  await page.locator("#musical-pause").click();

  await page.locator("#musical-setup summary").click();
  await page.locator("#musical-samples").click();
  await page.waitForFunction(() => document.querySelector("#musical-app").dataset.mediaSource === "samples", undefined, { timeout: 20000 });
  await page.locator("#musical-replay").click();
  await page.waitForFunction(() => Number(document.querySelector("#musical-app").dataset.time) > 11.5, undefined, { timeout: 20000 });
  assert.ok((await page.locator("video[data-actor-id]").evaluateAll(videos => videos.map(v => !v.paused && v.currentTime > 0 && v.readyState >= 2))).every(Boolean));
  await page.screenshot({ path: resolve(out, "licensed-live-performers.png") });
  report.checks.push("two licensed Pexels human performers decode and play as alpha-matted video in the 30-second stage");
  await page.locator("#musical-pause").click();
  const paused = Number(await page.locator("#musical-app").getAttribute("data-time"));
  await new Promise(r => setTimeout(r, 500)); assert.ok(Math.abs(Number(await page.locator("#musical-app").getAttribute("data-time")) - paused) < .1);
  report.checks.push("audio master clock advances and freezes on pause");
  await page.locator("#musical-replay").click(); await page.waitForFunction(() => document.querySelector("#musical-app").dataset.playback === "completed", undefined, { timeout: 45000 });
  report.checks.push("full 30-second timeline completes and replay works");
  await page.screenshot({ path: resolve(out, "mobile-finale.png") });
  await page.locator("#musical-setup summary").click();
  await page.locator("#musical-video-0").setInputFiles(videoFixture); await page.locator("#musical-video-1").setInputFiles(videoFixture);
  await page.waitForFunction(() => document.querySelector("#musical-media-status").textContent.includes("2/2"));
  await page.locator("#musical-play").click();
  await page.waitForFunction(() => document.querySelector("#musical-app").dataset.playback === "playing" && Number(document.querySelector("#musical-app").dataset.time) < 1);
  await page.waitForFunction(() => Number(document.querySelector("#musical-app").dataset.time) > 11.2, undefined, { timeout: 20000 });
  const firstFrames = await page.locator("video[data-actor-id]").evaluateAll(videos => videos.map(v => ({ playing: !v.paused, time: v.currentTime, readyState: v.readyState })));
  assert.ok(firstFrames.every(v => v.playing && v.readyState >= 2));
  await new Promise(r => setTimeout(r, 350));
  const laterFrames = await page.locator("video[data-actor-id]").evaluateAll(videos => videos.map(v => v.currentTime));
  assert.ok(laterFrames.every((t, i) => Math.abs(t - firstFrames[i].time) > .08));
  await page.screenshot({ path: resolve(out, "two-video-slots.png") });
  report.checks.push("two synthetic packed H.264 MP4 clips decode and play on separate alpha-shaded actor planes; not real performers");
  report.previewFpsLabel = await page.locator("#musical-fps").textContent();
  await page.locator("#musical-pause").click();

  // End-to-end image tracking uses real detection against a synthetic camera stream.
  // This validates the image-pose path, never claims real phone/world tracking.
  const trackedPage = await context.newPage(); trackedPage.on("pageerror", e => errors.push(e.message));
  await trackedPage.setViewportSize({ width: 960, height: 720 });
  await trackedPage.addInitScript(({ targetPng }) => {
    window.__cameraVisible = true;
    window.__cameraOffset = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 720;
      const ctx = canvas.getContext("2d"), image = new Image(); image.src = targetPng; await image.decode();
      const draw = () => { ctx.fillStyle = "#888"; ctx.fillRect(0,0,960,720); if(window.__cameraVisible) ctx.drawImage(image,520+window.__cameraOffset,200,440,355); requestAnimationFrame(draw); }; draw();
      return canvas.captureStream(24);
    } });
  }, { targetPng });
  const trackedUrl = new URL(base); trackedUrl.searchParams.set("musical","1"); trackedUrl.searchParams.set("tracking","image");
  await trackedPage.goto(trackedUrl.href); await trackedPage.waitForFunction(() => !document.querySelector("#musical-camera")?.disabled);
  await trackedPage.locator("#musical-samples").click();
  await trackedPage.waitForFunction(() => document.querySelector("#musical-app").dataset.mediaSource === "samples", undefined, { timeout: 20000 });
  await trackedPage.locator("#musical-camera").click();
  await trackedPage.waitForFunction(() => document.querySelector("#musical-app").dataset.tracking === "true", undefined, { timeout: 60000 });
  await trackedPage.locator("#musical-confirm").click();
  assert.equal(await trackedPage.locator("#musical-building").isChecked(), false);
  await trackedPage.locator("#musical-play").click();
  await trackedPage.waitForFunction(() => Number(document.querySelector("#musical-app").dataset.time) > 11.5, undefined, { timeout: 25000 });
  await trackedPage.screenshot({ path: resolve(out, "image-ar-live-performers-ui.png") });
  const photoDownload = trackedPage.waitForEvent("download"); await trackedPage.locator("#musical-photo").click();
  await (await photoDownload).saveAs(resolve(out, "image-ar-two-performers.png"));
  report.checks.push("two licensed human videos run together with actual image-pose estimation on simulated camera; composite PNG exported");
  await trackedPage.locator("#musical-pause").click();
  await trackedPage.locator("#musical-developer summary").click();
  async function trackedDiagnostics(name) {
    const event = trackedPage.waitForEvent("download"); await trackedPage.locator("#musical-report").click();
    const stream = await (await event).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString()); writeFileSync(resolve(out, `${name}.json`),JSON.stringify(data,null,2)); return data;
  }
  const poseBefore = await trackedDiagnostics("image-pose-before");
  await trackedPage.evaluate(() => { window.__cameraOffset = -45; });
  await trackedPage.waitForTimeout(2400);
  const poseAfter = await trackedDiagnostics("image-pose-after");
  assert.equal(poseBefore.poseTrackedNow,true); assert.equal(poseAfter.poseTrackedNow,true);
  for (let i=0;i<2;i++) {
    const a=poseBefore.performers[i], b=poseAfter.performers[i];
    assert.equal(b.belongsToStage,true); assert.equal(b.attachedToCamera,false);
    assert.ok(a.buildingRelativeMatrix.every((n,j)=>Math.abs(n-b.buildingRelativeMatrix[j])<1e-6));
    assert.ok(a.worldMatrix.some((n,j)=>Math.abs(n-b.worldMatrix[j])>.02),"real estimator must respond to simulated camera image movement");
  }
  report.checks.push("moving the simulated camera image changes actual MindAR pose while both performers keep their building-relative transforms");
  await trackedPage.locator("#musical-play").click();
  await trackedPage.evaluate(() => { window.__cameraVisible = false; });
  await trackedPage.waitForFunction(() => document.querySelector("#musical-app").dataset.tracking === "false", undefined, { timeout: 12000 });
  assert.equal(await trackedPage.locator("#musical-app").getAttribute("data-playback"), "paused");
  report.checks.push("real MindAR detection on simulated camera; loss hides stage and pauses timeline");
  await trackedPage.evaluate(() => { window.__cameraVisible = true; });
  await trackedPage.waitForFunction(() => document.querySelector("#musical-app").dataset.tracking === "true", undefined, { timeout: 15000 });
  assert.equal(await trackedPage.locator("#musical-app").getAttribute("data-playback"), "paused");
  await trackedPage.screenshot({ path: resolve(out, "image-tracking.png") });
  report.imageTrackingFpsLabel = await trackedPage.locator("#musical-fps").textContent();
  report.checks.push("reacquisition does not silently resume audio");
  await trackedPage.close();
  const iphoneContext = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  const iphonePage = await iphoneContext.newPage(); iphonePage.on("pageerror", e => errors.push(e.message));
  await iphonePage.goto(base);
  await iphonePage.waitForFunction(() => ["ios-star", "ios-align"].every(id => document.getElementById(id)?.getAttribute("href")?.startsWith("blob:")), undefined, { timeout: 25000 });
  assert.equal(await iphonePage.locator("#ios-star").getAttribute("rel"), "ar");
  assert.equal(await iphonePage.locator("#ios-align img").count(), 1);
  report.checks.push("iPhone-UA original GLB-to-USDZ links generated with rel=ar; native Quick Look NOT executed");
  await iphoneContext.close();
  assert.deepEqual(errors, []); report.result = "PASS";
} catch (e) {
  report.result = "FAIL"; report.error = String(e); await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {}); throw e;
} finally { report.browserErrors = errors; report.compiledTargetExists = existsSync(resolve(repo, "ar-engine/musical-assets/panel.mind")); writeFileSync(resolve(out, "browser-report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await browser.close(); }
