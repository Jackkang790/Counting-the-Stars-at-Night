import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
const repo = resolve(import.meta.dirname, "../..");
const { chromium } = await import(pathToFileURL(resolve(repo, process.env.PLAYWRIGHT_MODULE ?? ".tmp/musical-qa/node_modules/playwright/index.mjs")).href);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-certificate-errors"] });
const results = [];
try {
  for (const base of process.argv.slice(2)) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true, viewport: { width: 412, height: 915 } });
    const page = await context.newPage(), failures = [];
    page.on("pageerror", e => failures.push(e.message));
    page.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) failures.push(`${r.status()} ${r.url()}`); });
    await page.goto(base); await page.locator("#musical-launcher a").click();
    await page.waitForFunction(() => !document.querySelector("#musical-camera")?.disabled);
    await page.locator("#musical-samples").click();
    await page.waitForFunction(() => document.querySelector("#musical-app").dataset.mediaSource === "samples");
    await page.locator("#musical-preview").click(); await page.locator("#musical-developer summary").click();
    const downloaded = page.waitForEvent("download"); await page.locator("#musical-report").click();
    const stream = await (await downloaded).createReadStream(), buffers = [];
    for await (const chunk of stream) buffers.push(chunk);
    const report = JSON.parse(Buffer.concat(buffers).toString("utf8"));
    assert.equal(report.mode, "preview"); assert.equal(report.poseTrackedNow, false); assert.equal(report.deviceARVerified, false);
    assert.equal(report.performerVideoSlotsLoaded, 2); assert.deepEqual(report.mediaSources, ["sample", "sample"]);
    assert.deepEqual(failures, []);
    results.push({ base, result: "PASS", assetsAndVideosLoad: true, previewDoesNotClaimARTracking: true, errors: failures });
    await context.close();
  }
} finally {
  await browser.close(); const dir = resolve(repo, ".tmp/musical-evidence"); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "route-report.json"), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
}
