// Run against a production Vite preview (development StrictMode repeats canvas effects).
// Playwright may be installed separately:
// PLAYWRIGHT_MODULE=<absolute path to playwright/index.mjs> node tests/browser/hi-lo-mobile.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const url = process.env.TEST_URL ?? 'http://127.0.0.1:5188/mindflux/';

async function setup(blockSize, slow = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    const metrics = window.cardMetrics = { draws: [], requests: [], activeBytes: 0, peakBytes: 0, closed: 0 };
    const sizes = new WeakMap();
    const originalDecode = window.createImageBitmap.bind(window);
    window.createImageBitmap = async (...args) => {
      const image = await originalDecode(...args);
      const bytes = image.width * image.height * 4;
      sizes.set(image, bytes);
      metrics.activeBytes += bytes;
      metrics.peakBytes = Math.max(metrics.peakBytes, metrics.activeBytes);
      return image;
    };
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function () {
      metrics.activeBytes -= sizes.get(this) ?? 0;
      sizes.delete(this);
      metrics.closed++;
      return close.call(this);
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (args[0] instanceof ImageBitmap) metrics.draws.push({ time: performance.now(), card: this.canvas.getAttribute('aria-label'), width: args[0].width, height: args[0].height });
      return draw.apply(this, args);
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
      if (String(args[0]).includes('/cards-game/')) metrics.requests.push({ time: performance.now(), url: String(args[0]) });
      return originalFetch(...args);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (slow) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 500_000, uploadThroughput: 500_000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto(url);
  await page.locator('select').nth(0).selectOption('math');
  await page.locator('select').nth(1).selectOption('hiLoCountCards');
  await page.locator('select').nth(2).selectOption('18');
  await page.locator('select').nth(3).selectOption(String(blockSize));
  await page.locator('select').nth(4).selectOption('14');
  for (const index of [5, 6, 7]) await page.locator('select').nth(index).selectOption('random');
  return { context, page, errors };
}

try {
  for (const size of [5, 50]) {
    const { context, page, errors } = await setup(size, true);
    await page.getByRole('button', { name: 'Arranque', exact: true }).click();
    await page.getByText('Comenzando en', { exact: true }).waitFor({ timeout: 60000 });
    const readyAt = await page.evaluate(() => performance.now());
    assert.equal(await page.locator('canvas[role="img"]').count(), 0);
    await page.getByPlaceholder('Cuenta Hi-Lo').waitFor({ timeout: 30000 });
    const metrics = await page.evaluate(() => window.cardMetrics);
    assert.equal(metrics.draws.length, size);
    assert.ok(metrics.draws[0].time - readyAt >= 2600, 'countdown must follow preparation');
    metrics.draws.forEach(d => assert.ok(d.width === 500 && d.height === 700));
    const durations = metrics.draws.slice(1).map((draw, i) => draw.time - metrics.draws[i].time);
    durations.forEach(ms => assert.ok(ms >= 145, `short exposure: ${ms}`));
    assert.equal(metrics.requests.filter(r => r.time > metrics.draws[0].time && r.time < metrics.draws.at(-1).time + 145).length, 0);
    assert.ok(metrics.peakBytes <= size * 500 * 700 * 4);
    const count = metrics.draws.reduce((sum, draw) => {
      const rank = draw.card.replace('Carta ', '').slice(0, -1);
      return sum + (['2', '3', '4', '5', '6'].includes(rank) ? 1 : ['7', '8', '9'].includes(rank) ? 0 : -1);
    }, 0);
    await page.getByPlaceholder('Cuenta Hi-Lo').fill(String(count));
    await page.getByRole('button', { name: 'Lo se y quiero continuar', exact: true }).click();
    await page.getByText(/^Reanudando en/).waitFor({ timeout: 60000 });
    await page.getByPlaceholder('Cuenta Hi-Lo').waitFor({ timeout: 30000 });
    const allDraws = await page.evaluate(() => window.cardMetrics.draws);
    assert.equal(allDraws.length, size * 2);
    const totalCount = allDraws.reduce((sum, draw) => {
      const rank = draw.card.replace('Carta ', '').slice(0, -1);
      return sum + (['2', '3', '4', '5', '6'].includes(rank) ? 1 : ['7', '8', '9'].includes(rank) ? 0 : -1);
    }, 0);
    await page.getByPlaceholder('Cuenta Hi-Lo').fill(String(totalCount));
    await page.getByRole('button', { name: 'Lo se pero quiero terminar', exact: true }).click();
    await page.getByText(`Correcto. Cuenta actual: ${totalCount}.`, { exact: true }).waitFor();
    await page.waitForFunction(() => window.cardMetrics.activeBytes === 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ block: size, draws: size * 2, minExposureMs: Math.min(...durations), maxExposureMs: Math.max(...durations), peakMiB: metrics.peakBytes / 1048576, errors }));
    await context.close();
  }

  // A deterministic shuffle gives the same deck on restart, exercising warm HTTP cache.
  const warm = await setup(5);
  await warm.page.evaluate(() => { Math.random = () => 0.25; });
  for (let run = 0; run < 2; run++) {
    await warm.page.getByRole('button', { name: 'Arranque', exact: true }).click();
    await warm.page.getByPlaceholder('Cuenta Hi-Lo').waitFor({ timeout: 20000 });
    await warm.page.getByRole('button', { name: 'Alto', exact: true }).click();
    await warm.page.waitForFunction(() => window.cardMetrics.activeBytes === 0);
  }
  const warmMetrics = await warm.page.evaluate(() => window.cardMetrics);
  assert.deepEqual(warmMetrics.draws.slice(0, 5).map(d => d.card), warmMetrics.draws.slice(5).map(d => d.card));
  assert.deepEqual(warm.errors, []);
  console.log('Cold/warm restart with repeated cards: passed; 10 presentations and no retained bitmaps.');
  await warm.context.close();

  const { context, page, errors } = await setup(5);
  let failing = true;
  let delayed = false;
  await page.route('**/assets/cards-game/*.png', async route => {
    if (delayed) await new Promise(resolve => setTimeout(resolve, 500));
    if (failing) await route.fulfill({ status: 503, body: 'unavailable' });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Arranque', exact: true }).click();
  await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor();
  assert.equal(await page.locator('canvas[role="img"]').count(), 0);
  failing = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await page.getByPlaceholder('Cuenta Hi-Lo').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Alto', exact: true }).click();
  await page.waitForFunction(() => window.cardMetrics.activeBytes === 0);
  delayed = true;
  await page.getByRole('button', { name: 'Arranque', exact: true }).click();
  await page.getByRole('button', { name: 'Alto', exact: true }).click();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('canvas[role="img"]').count(), 0);
  assert.equal(await page.evaluate(() => window.cardMetrics.activeBytes), 0);
  delayed = false;
  await page.getByRole('button', { name: 'Arranque', exact: true }).click();
  await page.locator('canvas[role="img"]').waitFor({ timeout: 15000 });
  await page.locator('select').nth(1).selectOption('hiLoCount');
  await page.waitForFunction(() => window.cardMetrics.activeBytes === 0);
  assert.deepEqual(errors, []);
  console.log('Retry, stop during preparation, restart and unmount: passed; decoded resources released.');
  await context.close();
} finally {
  await browser.close();
}
