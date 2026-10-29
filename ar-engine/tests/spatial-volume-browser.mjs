import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const repo = resolve(import.meta.dirname, "../..");
const { chromium } = await import(pathToFileURL(resolve(repo, process.env.PLAYWRIGHT_MODULE ?? ".tmp/musical-qa/node_modules/playwright/index.mjs")).href);
const base = process.argv[2] ?? "https://localhost:5187/";
const out = resolve(repo, ".tmp/spatial-volume-evidence"); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-certificate-errors"] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage(), errors = [];
page.on("pageerror", error => errors.push(error.message));
const report = { testedUrl: base, browser: browser.version(), physicalDeviceARVerified: false, realHumanVolumetricFootageProvided: false, calibrationContent: "Nonhuman asymmetric 3D box/cone; never represented as a real performer", checks: [] };
const nearMatrix = (a,b) => assert.ok(a.length === b.length && a.every((n,i) => Math.abs(n-b[i]) < 1e-8));
async function openDetails(id) { const el = page.locator(id); if (!(await el.getAttribute("open") !== null)) await el.locator("summary").click(); }
async function diagnostics(name) {
  await openDetails("#musical-developer");
  const event = page.waitForEvent("download"); await page.locator("#musical-report").click();
  const file = await event, stream = await file.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const result = JSON.parse(Buffer.concat(chunks).toString()); writeFileSync(resolve(out, `${name}.json`), JSON.stringify(result,null,2)); return result;
}
async function assertPlacement(before, after) {
  assert.equal(after.deviceARVerified, false); assert.equal(after.trueVolumetricHumanFootageVerified, false);
  for (let i = 0; i < 2; i++) {
    const a = before.performers[i], b = after.performers[i];
    assert.equal(b.belongsToStage,true); assert.equal(b.attachedToCamera,false);
    nearMatrix(a.buildingRelativeMatrix,b.buildingRelativeMatrix); nearMatrix(a.worldMatrix,b.worldMatrix);
  }
}
try {
  const url = new URL(base); url.searchParams.set("musical","1"); await page.goto(url.href);
  await page.locator("#musical-samples").click();
  await page.waitForFunction(() => document.querySelector("#musical-app").dataset.mediaSource === "samples");
  await page.locator("#musical-preview").click();
  const video = await diagnostics("video-spatial");
  assert.equal(video.poseTrackedNow,false); assert.ok(video.performers.every(a => a.representation === "spatial-video-plane"));
  await page.locator('[data-view="-35"]').click(); const leftVideo = await diagnostics("video-left");
  await page.locator('[data-view="35"]').click(); const rightVideo = await diagnostics("video-right");
  await assertPlacement(video,leftVideo); await assertPlacement(video,rightVideo);
  report.checks.push("Both real-video planes are under building anchors, never camera children; preview camera movement leaves placement unchanged");

  await page.locator("#musical-volume-test").click();
  await page.waitForFunction(() => document.querySelector("#musical-app").dataset.mediaSource === "volume-calibration");
  const volume = await diagnostics("volume-spatial"); await assertPlacement(video,volume);
  assert.ok(volume.performers.every(a => a.representation === "mesh-sequence" && a.contentKind === "synthetic-calibration" && a.frameCount === 12));
  assert.equal(await page.locator("#musical-play").isDisabled(),true);
  assert.match(await page.locator("#musical-representation").textContent(),/실사 인물 아님/);
  report.checks.push("Renderer swap preserves each actor transform; nonhuman 3D calibration cannot start a real-human show");

  await openDetails("#musical-setup"); await page.locator("#musical-test").click();
  await page.waitForFunction(() => Number(document.querySelector("#musical-app").dataset.time) > 11.2, undefined, { timeout: 20000 });
  const framesBefore = await page.locator("#musical-app").getAttribute("data-frame-indices");
  await page.waitForFunction(previous => document.querySelector("#musical-app").dataset.frameIndices !== previous, framesBefore);
  report.checks.push("Both changing 3D frame sequences advance on the common audio/timeline clock after their separate entrance times");
  await page.locator("#musical-pause").click();
  const pausedFrames = await page.locator("#musical-app").getAttribute("data-frame-indices");
  await page.waitForTimeout(450); assert.equal(await page.locator("#musical-app").getAttribute("data-frame-indices"),pausedFrames);
  const volumePaused = await diagnostics("volume-paused"); await assertPlacement(volume,volumePaused);
  const images = [];
  for (const angle of [-35,0,35]) {
    await page.locator(`[data-view="${angle}"]`).click(); await page.waitForTimeout(150);
    // Read the compositor: WebGL's drawing buffer is intentionally not preserved.
    images.push((await page.screenshot({clip:{x:0,y:150,width:830,height:600}})).toString("base64"));
    await page.screenshot({ path: resolve(out, `nonhuman-3d-view-${angle}.png`) });
    await assertPlacement(volumePaused, await diagnostics(`volume-view-${angle}`));
  }
  assert.equal(new Set(images).size,3);
  report.checks.push("Paused 3D geometry renders different perspectives from left/front/right while building-relative matrices stay fixed");

  // Exercise the public local-file path, not only the bundled fixture adapter.
  const fixture = resolve(repo,"ar-engine/musical-assets/volume-calibration");
  const files = ["calibration.vseq.json", ...Array.from({length:12},(_,i)=>`frame-${String(i).padStart(2,"0")}.glb`)].map(f=>resolve(fixture,f));
  await page.locator("#musical-volume-0").setInputFiles(files);
  await page.waitForFunction(() => document.querySelector("#musical-status").textContent.includes("12프레임 준비"));
  await assertPlacement(volumePaused, await diagnostics("volume-local-files"));
  report.checks.push("Local manifest + all GLB file selection uses the same bounded loader and preserves registration");

  await openDetails("#musical-setup"); await page.locator("#musical-samples").click();
  await page.waitForFunction(() => document.querySelector("#musical-app").dataset.mediaSource === "samples");
  const restored = await diagnostics("video-restored"); await assertPlacement(video,restored);
  assert.ok(restored.performers.every(a => a.representation === "spatial-video-plane"));
  assert.equal(await page.locator("#musical-play").isDisabled(),false);
  assert.deepEqual(errors,[]); report.checks.push("Returning to both licensed human video planes restores show controls without moving either actor");
  report.result = "PASS";
} catch (error) { report.result = "FAIL"; report.error = String(error); await page.screenshot({path:resolve(out,"failure.png")}).catch(()=>{}); throw error; }
finally { report.browserErrors = errors; writeFileSync(resolve(out,"browser-report.json"),JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2)); await browser.close(); }
