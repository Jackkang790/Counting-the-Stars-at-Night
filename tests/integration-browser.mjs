import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const base = (process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const out = resolve(import.meta.dirname, '../.tmp/integration');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
// Real models/audio/playback; tracker input is simulated, never phone AR evidence.
await context.addInitScript(() => {
  let modules = [], world, timer;
  window.XR8 = {
    loadChunk: async () => {}, XrConfig: { device: () => ({ MOBILE: 'mobile' }), camera: () => ({ BACK: 'back' }) },
    XrController: { configure() {}, pipelineModule: () => ({ name: 'controller' }), updateCameraProjectionMatrix() {},
      hitTest: () => [{ type: 'FEATURE_POINT', distance: 4, position: { x: 0, y: 0, z: -4 } }] },
    GlTextureRenderer: { pipelineModule: () => ({ name: 'camera' }) },
    Threejs: { configure() {}, pipelineModule: () => ({ name: 'three' }), xrScene: () => world },
    addCameraPipelineModules: list => { modules = list; }, removeCameraPipelineModules() {}, pause() {}, resume() {},
    stop: () => clearInterval(timer),
    run: ({ canvas }) => {
      const T = window.THREE;
      world = { scene: new T.Scene(), camera: new T.PerspectiveCamera(45, canvas.width / canvas.height, .01, 100),
        renderer: new T.WebGLRenderer({ canvas, preserveDrawingBuffer: true }) };
      world.renderer.setSize(canvas.width, canvas.height, false);
      modules.forEach(m => m.onStart?.({}));
      timer = setInterval(() => {
        world.camera.position.set(0, 1.5, 0); world.camera.lookAt(0, 1.5, -4); world.camera.updateMatrixWorld(true);
        modules.forEach(m => m.onUpdate?.({ processCpuResult: { reality: { trackingStatus: 'NORMAL',
          position: { x: 0, y: 1.5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, intrinsics: world.camera.projectionMatrix.elements } } }));
        world.renderer.render(world.scene, world.camera);
      }, 40);
    },
  };
});
const page = await context.newPage(), errors = [], completions = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.method() === 'POST' && request.url().endsWith('/experiences/complete')) completions.push(request.postDataJSON());
});
const sid = () => page.evaluate(() => localStorage.getItem('byeol-night:session:v5'));
const json = async path => {
  const response = await context.request.get(base + '/api/v1' + path);
  assert.equal(response.status(), 200, path);
  return response.json();
};
const stars = async () => (await json('/stars?session_id=' + await sid())).total_stars;
const visit = screen => page.goto(base + '/#' + screen);
const skip = async (screen, expected) => {
  await visit(screen);
  await page.getByRole('button', { name: /건너뛰기/ }).click();
  await expect.poll(stars).toBe(expected);
  await expect(page).toHaveURL(expected === 6 ? /#stamps/ : /#map/);
};
try {
  const health = await json('/health'); assert.equal(health.status, 'ok');
  const catalog = await context.request.get(base + '/ar/api/ar/v1/catalog.json');
  assert.equal(catalog.status(), 200); assert.equal((await catalog.json()).basePath, '/ar/');
  await page.goto(base + '/#reset');
  await expect.poll(sid).toBeTruthy();
  await expect.poll(stars).toBe(0);
  checks.push('single-origin frontend, REST and /ar discovery serve real data');

  await visit('roleplay/h1');
  await page.getByRole('button', { name: '검정 교복 · 3D AR 공연 보기' }).click();
  const frame = page.frameLocator('iframe');
  await frame.locator('#musical-app').waitFor();
  await expect(page.getByRole('button', { name: '공연을 끝까지 감상해 주세요' })).toBeDisabled();
  await page.evaluate(() => {
    const token = new URL(document.querySelector('iframe').src).searchParams.get('hostToken');
    window.postMessage({ source: 'byeol-ar', event: 'completed', experience: 'black-uniform', token, mode: 'world' }, location.origin);
  });
  await expect(page.getByRole('button', { name: '공연을 끝까지 감상해 주세요' })).toBeDisabled();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect.poll(stars).toBe(0);
  checks.push('closing AR and wrong-window completion messages award no star');

  await page.getByRole('button', { name: '검정 교복 · 3D AR 공연 보기' }).click();
  await expect(frame.locator('#musical-app')).toHaveAttribute('data-media-source', 'quartet', { timeout: 60000 });
  await frame.locator('body').evaluate(() => {
    const token = new URLSearchParams(location.search).get('hostToken');
    window.parent.postMessage({ source: 'byeol-ar', event: 'completed', experience: 'black-uniform', token: 'wrong-token', mode: 'world' }, location.origin);
    window.parent.postMessage({ source: 'byeol-ar', event: 'completed', experience: 'black-uniform', token, mode: 'preview' }, location.origin);
  });
  await expect(page.getByRole('button', { name: '공연을 끝까지 감상해 주세요' })).toBeDisabled();
  await expect(frame.locator('#musical-camera')).toBeEnabled();
  await frame.locator('#musical-camera').click();
  await expect(frame.locator('#musical-app')).toHaveAttribute('data-world-tracking', 'normal');
  await frame.locator('#musical-place-here').click();
  await expect(frame.locator('#musical-app')).toHaveAttribute('data-playback', 'playing');
  await expect.poll(async () => Number(await frame.locator('#musical-app').getAttribute('data-time')), { timeout: 15000 }).toBeGreaterThan(5);
  await page.screenshot({ path: resolve(out, 'ar-performance.png') });
  await expect(page.getByRole('button', { name: '공연 감상 완료 · 별 받기' })).toBeEnabled({ timeout: 25000 });
  await page.getByRole('button', { name: '공연 감상 완료 · 별 받기' }).click();
  await expect.poll(stars).toBe(1);
  await expect(page).toHaveURL(/#map/);
  checks.push('four real GLBs and 10-second audio timeline complete through checked iframe bridge (MOCK tracker)');

  await skip('escape/h1', 2);
  await skip('roleplay/h2', 3);
  await skip('escape/h2', 4);
  await visit('artwork/h3');
  await page.getByRole('button', { name: '별의 새싹 · 실제 3D 작품 보기' }).click();
  await expect(frame.locator('h1')).toHaveText('별의 새싹');
  await page.getByRole('button', { name: '전시 확인 · 별 받기' }).click();
  await expect.poll(stars).toBe(5);
  await expect(page).toHaveURL(/#map/);
  await skip('escape/h3', 6);
  await expect(page).toHaveURL(/#stamps/);
  const firstSid = await sid();
  const firstCoupons = await json('/coupons?session_id=' + firstSid);
  assert.equal(firstCoupons.length, 1);
  assert.ok(completions.some(c => c.spot_id === 'c' && c.kind === 'view'));
  assert.ok(completions.every(c => typeof c.kind === 'string'));
  await skip('escape/h3', 6);
  assert.equal((await json('/coupons?session_id=' + firstSid)).length, 1);
  checks.push('six frontend missions including c/view issue exactly one coupon; repeats are idempotent');

  await page.evaluate(() => localStorage.removeItem('byeol-night:v5'));
  await visit('stamps');
  await expect(page.locator('.const-count')).toHaveText('★ 6 / 6');
  await visit('couponbox');
  await expect(page.locator('.gift-tile')).toHaveCount(1);
  await page.getByRole('button', { name: '쿠폰 사용하기', exact: true }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
  const redeemed = await context.request.post(base + '/api/v1/coupons/redeem-by-code', {
    data: { code: firstCoupons[0].code, store_id: 'kiko' },
  });
  assert.equal(redeemed.status(), 200);
  await expect(page.getByText('사용 완료', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  checks.push('server progress restores after local progress loss; QR coupon reflects redemption by code');

  await visit('stores');
  await expect(page.locator('.cafe-card')).toHaveCount(3);
  for (const name of ['키코', '우시아', '오시우커피']) await expect(page.locator('.cafe-list').getByText(name, { exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(out, 'stores-mobile.png') });
  checks.push('map and three cafe cards load server-backed matching IDs and demo status');

  await visit('stamps');
  await page.getByRole('button', { name: /한 번 더/ }).click();
  await expect.poll(async () => { const value = await sid(); return !!value && value !== firstSid; }).toBe(true);
  await expect.poll(stars).toBe(0);
  await page.route('**/api/v1/**', route => route.abort());
  await visit('escape/h1');
  await page.getByRole('button', { name: /건너뛰기/ }).click();
  await expect(page.locator('.sync-notice')).toBeVisible();
  await expect(page).toHaveURL(/#map/);
  assert.equal(await stars(), 0);
  await page.unroute('**/api/v1/**');
  await page.locator('.sync-notice').getByRole('button', { name: '다시 시도' }).click();
  await expect.poll(stars).toBe(1);
  await expect(page.locator('.sync-notice')).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.setItem('byeol-night:session:v5', 'missing-integration-session');
    const past = JSON.parse(localStorage.getItem('byeol-night:past-sessions:v5'));
    localStorage.setItem('byeol-night:past-sessions:v5', JSON.stringify([...past, 'deleted-past-session']));
  });
  await page.reload();
  await expect.poll(async () => { const value = await sid(); return !!value && value !== 'missing-integration-session'; }).toBe(true);
  await expect.poll(stars).toBe(1);
  await visit('couponbox');
  await expect(page.locator('.gift-tile')).toHaveCount(1);
  checks.push('next round uses a fresh session; offline star retries; lost session renews; past coupon survives');

  await visit('stamps');
  await page.screenshot({ path: resolve(out, 'round-two-mobile.png') });
  await page.goto(base + '/ar/');
  await expect(page.locator('#start-star')).toBeVisible();
  await expect(page.locator('#tracking-lab-launcher a')).toBeVisible();
  for (const engine of ['mindar', 'nft']) {
    await page.goto(base + '/ar/?trackingLab=1&engine=' + engine);
    await expect(page.locator('#lab-start')).toBeEnabled({ timeout: 45000 });
  }
  checks.push('latest AR branch keeps the original landing page and NFT/MindAR comparison routes under /ar/');
  assert.deepEqual(errors, []);
  const previewContext = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const preview = await previewContext.newPage();
  await preview.goto(base + '/');
  await preview.locator('.app-shell').waitFor();
  await preview.screenshot({ path: resolve(out, 'deployed-home.png') });
  await previewContext.close();
  const report = { result: 'PASS', testedUrl: base, checks, completionRequests: completions.length, phoneARVerified: false, tracking: 'MOCK ONLY' };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  console.error('Browser errors:', errors);
  throw error;
} finally { await browser.close(); }
