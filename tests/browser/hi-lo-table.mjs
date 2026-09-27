// Sequential Chrome smoke/integration tests; use the same environment as hi-lo-mobile.mjs.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const url = process.env.TEST_URL ?? 'http://127.0.0.1:5188/mindflux/';
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await context.addInitScript(() => {
  const m = window.tableMetrics = { states: [], requests: [], bytes: 0, peak: 0, errors: [] };
  const sizes = new WeakMap();
  const decode = window.createImageBitmap.bind(window);
  window.createImageBitmap = async (...args) => {
    const bitmap = await decode(...args);
    const size = bitmap.width * bitmap.height * 4;
    sizes.set(bitmap, size); m.bytes += size; m.peak = Math.max(m.peak, m.bytes);
    return bitmap;
  };
  const close = ImageBitmap.prototype.close;
  ImageBitmap.prototype.close = function () { m.bytes -= sizes.get(this) ?? 0; sizes.delete(this); return close.call(this); };
  const fetch = window.fetch.bind(window);
  window.fetch = (...args) => {
    if (String(args[0]).includes('/cards-game/')) m.requests.push(performance.now());
    return fetch(...args);
  };
  let previous = '';
  new MutationObserver(() => {
    const table = document.querySelector('[data-hi-lo-table]');
    if (!table) { previous = ''; return; }
    const key = `${table.dataset.phase}:${table.dataset.round}`;
    if (key !== previous) {
      previous = key;
      m.states.push({ phase: table.dataset.phase, round: Number(table.dataset.round), time: performance.now(),
        label: table.querySelector('canvas')?.getAttribute('aria-label') });
    }
  }).observe(document, { subtree: true, attributes: true, childList: true });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const phase = name => page.locator(`[data-hi-lo-table][data-phase="${name}"]`).waitFor({ timeout: 60000 });
const start = () => page.getByRole('button', { name: 'Arranque', exact: true }).click();
const stop = () => page.getByRole('button', { name: 'Alto', exact: true }).click();
const countOf = states => states.filter(s => s.phase === 'show').reduce((sum, s) => sum +
  [...s.label.matchAll(/(10|[2-9AJQK])[♠♥♦♣]/g)].reduce((n, [, rank]) => n + ('23456'.includes(rank) ? 1 : '789'.includes(rank) ? 0 : -1), 0), 0);
async function setCount(label, value) {
  const field = page.getByRole('spinbutton', { name: label, exact: true });
  await field.fill(String(value)); await field.press('Tab');
}
try {
  await page.goto(url);
  await page.locator('select').nth(0).selectOption('math');
  await page.locator('select').nth(1).selectOption('hiLoTable');
  await setCount('Rondas por respuesta', 99);
  assert.equal(await page.getByRole('spinbutton', { name: 'Rondas por respuesta', exact: true }).inputValue(), '10');
  await setCount('Rondas por respuesta', 2);
  await setCount('Cartas por mano', 10);
  for (const seat of ['Izquierda', 'Superior', 'Derecha']) await page.getByRole('checkbox', { name: seat, exact: true }).uncheck();
  assert.equal(await page.getByRole('checkbox', { name: 'Inferior', exact: true }).isDisabled(), true);
  for (const seat of ['Izquierda', 'Superior', 'Derecha']) await page.getByRole('checkbox', { name: seat, exact: true }).check();
  await page.locator('select').nth(2).selectOption('200');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 500000, uploadThroughput: 500000 });
  await start(); await phase('countdown');
  assert.equal(await page.getByRole('spinbutton', { name: 'Cartas por mano', exact: true }).isDisabled(), true);
  await phase('answer');
  let m = await page.evaluate(() => window.tableMetrics);
  let shows = m.states.filter(s => s.phase === 'show');
  assert.equal(shows.length, 2);
  shows.forEach(s => assert.equal([...s.label.matchAll(/(10|[2-9AJQK])[♠♥♦♣]/g)].length, 40));
  const gap = m.states.find(s => s.phase === 'gap');
  const answer = m.states.find(s => s.phase === 'answer');
  assert.ok(gap.time - shows[0].time >= 190);
  assert.ok(shows[1].time - gap.time >= 490);
  assert.ok(answer.time - shows[1].time >= 190 && answer.time - shows[1].time < 650, 'no final gap');
  assert.equal(m.requests.filter(time => time > shows[0].time && time < shows[1].time + 185).length, 0);
  assert.ok(m.peak <= 52 * 500 * 700 * 4);
  await page.getByRole('button', { name: 'Lo sé y quiero continuar', exact: true }).click();
  await page.getByText('Introduce una cuenta entera válida.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'No lo sé', exact: true }).click(); await phase('revealed');
  await page.getByText(`La cuenta correcta es ${countOf(m.states)}. Continúa desde esta cuenta.`, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await phase('countdown'); await phase('answer');
  m = await page.evaluate(() => window.tableMetrics);
  assert.equal(m.states.filter(s => s.phase === 'show').length, 4);
  await page.getByPlaceholder('Cuenta Hi-Lo').fill(String(countOf(m.states)));
  await page.getByRole('button', { name: 'Lo sé y quiero terminar', exact: true }).click(); await phase('result');
  await page.getByText(`Correcto. Cuenta actual: ${countOf(m.states)}.`, { exact: true }).waitFor();
  await page.getByText('Fin de la partida en 5 segundos…', { exact: true }).waitFor();
  await phase('ended');
  await page.getByText(`Correcto. Cuenta actual: ${countOf(m.states)}.`, { exact: true }).waitFor();
  await page.waitForFunction(() => window.tableMetrics.bytes === 0);
  console.log(JSON.stringify({ scenario: 'mobile cold cache, 40 cards, accumulated continuation', peakMiB: m.peak / 1048576,
    exposureMs: [gap.time - shows[0].time, answer.time - shows[1].time], gapMs: shows[1].time - gap.time }));

  // Error and retry must not skip the planned first tanda.
  await setCount('Rondas por respuesta', 1);
  await setCount('Cartas por mano', 4);
  let failed = false;
  await page.route('**/cards-game/*.png', async route => {
    if (!failed) { failed = true; await route.fulfill({ status: 503, body: 'Unavailable' }); }
    else await route.continue();
  });
  await start(); await phase('loadError');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await phase('countdown'); await phase('answer');
  await page.getByPlaceholder('Cuenta Hi-Lo').fill('999');
  await page.getByRole('button', { name: 'Lo sé y quiero continuar', exact: true }).click();
  await page.getByText(/Incorrecto\. Tu respuesta: 999/).waitFor();
  await phase('countdown'); await stop(); await phase('idle');
  await page.waitForFunction(() => window.tableMetrics.bytes === 0);
  await page.unroute('**/cards-game/*.png');

  // Stop a pending load, restart, then unmount during an exposure.
  await page.route('**/cards-game/*.png', async route => { await new Promise(resolve => setTimeout(resolve, 350)); await route.continue().catch(() => {}); });
  await start(); await phase('preparing'); await stop(); await phase('idle');
  await page.waitForFunction(() => window.tableMetrics.bytes === 0);
  await page.unroute('**/cards-game/*.png');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.locator('select').nth(2).selectOption('10000');
  await start(); await phase('show');
  if (process.env.SCREENSHOT_PATH) await page.locator('[data-hi-lo-table]').screenshot({ path: process.env.SCREENSHOT_PATH });
  await page.locator('select').nth(1).selectOption('hiLoCount');
  await page.waitForFunction(() => window.tableMetrics.bytes === 0);
  await stop();
  assert.deepEqual(errors, []);
  console.log('PASS: controls, three responses, retry, stop/restart, unmount, memory release; no page errors.');
} catch (error) {
  console.error('Browser errors:', errors);
  console.error('Visible page:', await page.locator('body').innerText().catch(() => '(unavailable)'));
  throw error;
} finally { await browser.close(); }
