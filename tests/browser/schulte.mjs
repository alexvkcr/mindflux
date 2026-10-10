import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const phase = name => page.locator(`[data-schulte][data-phase="${name}"]`).waitFor();
const dialog = page.locator('dialog[open]');
const start = () => page.getByRole('button', { name: 'Arranque', exact: true }).click();
async function advanceCountdown() {
  await phase('countdown');
  for (const count of ['3', '2', '1']) {
    assert.equal(await dialog.getByRole('status').locator('span').last().innerText(), count);
    await page.clock.runFor(1000);
  }
  await phase('playing');
}
async function checkBoundsAndLock() {
  const bounds = await dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewportWidth: innerWidth,
      viewportHeight: innerHeight, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      bodyPosition: document.body.style.position, rootOverflow: document.documentElement.style.overflow };
  });
  assert.equal(bounds.x, 0); assert.equal(bounds.y, 0);
  assert.equal(bounds.width, bounds.viewportWidth); assert.equal(bounds.height, bounds.viewportHeight);
  assert.ok(bounds.scrollHeight <= bounds.clientHeight, 'dialog must fit without scrolling');
  assert.equal(bounds.bodyPosition, 'fixed'); assert.equal(bounds.rootOverflow, 'hidden');
  const scroll = await dialog.evaluate(el => ({ top: el.scrollTop, bodyTop: document.body.style.top, y: scrollY }));
  await page.mouse.wheel(0, 600);
  const after = await dialog.evaluate(el => ({ top: el.scrollTop, bodyTop: document.body.style.top, y: scrollY }));
  assert.deepEqual(after, scroll, 'wheel must not move the game or background');
  for (const cell of await dialog.getByRole('button', { name: /^Elemento / }).all()) {
    const rect = await cell.boundingBox();
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= bounds.width + 1 && rect.y + rect.height <= bounds.height + 1, 'all cells visible');
  }
}
async function completeNumbers(count, mistakes = 0) {
  for (let i = 0; i < mistakes; i++) await dialog.getByRole('button', { name: `Elemento ${count}`, exact: true }).click();
  await page.clock.runFor(700);
  for (let value = 1; value <= count; value++) await dialog.getByRole('button', { name: `Elemento ${value}`, exact: true }).click();
}
try {
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5188/mindflux/');
  await page.locator('select').nth(0).selectOption('visualField');
  await page.locator('select').nth(1).selectOption('schulteTable');
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByLabel('Cuadrícula', { exact: true }).selectOption('3x3');
  await start(); await advanceCountdown(); await checkBoundsAndLock();
  await completeNumbers(9, 1); await phase('finished');
  assert.equal(await dialog.count(), 0);
  assert.equal(await page.locator('tbody tr').count(), 1);
  assert.equal(await page.locator('tbody tr td').last().innerText(), '1');
  assert.equal(await page.evaluate(() => document.body.style.position), '');
  assert.ok(Number(await page.locator('[data-time-ms]').getAttribute('data-time-ms')) < 3000, 'countdown excluded');

  // Cancellation during preparation must clear timers and restore scroll and focus.
  await start(); await phase('countdown');
  await dialog.getByRole('button', { name: 'Cancelar partida' }).click();
  await page.clock.runFor(4000); await phase('idle');
  assert.equal(await dialog.count(), 0);
  assert.equal(await page.locator('tbody tr').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Arranque', exact: true }).evaluate(el => el === document.activeElement), true);

  await page.locator('select').nth(1).selectOption('schulteContinuous');
  const counts = page.getByLabel('Tableros por sesión');
  assert.equal(await counts.locator('option').count(), 15);
  await counts.selectOption('2');
  await page.getByLabel('Cuadrícula', { exact: true }).selectOption('3x3');
  await start(); await advanceCountdown();
  await completeNumbers(9, 1); await phase('countdown');
  assert.equal(await dialog.count(), 1, 'same dialog stays open between boards');
  assert.match(await dialog.locator('h2').innerText(), /2\/2/);
  await advanceCountdown();
  assert.match(await dialog.innerText(), /Errores: 0/);
  await completeNumbers(9, 2); await phase('finished');
  assert.equal(await page.locator('tbody tr').count(), 2);
  assert.deepEqual(await page.locator('tbody tr td:last-child').allTextContents(), ['1', '2']);
  assert.equal(await page.locator('tfoot td').last().innerText(), '1,5');
  const times = (await page.locator('[data-time-ms]').evaluateAll(els => els.map(el => Number(el.dataset.timeMs))));
  assert.equal(Number(await page.locator('[data-average-time-ms]').getAttribute('data-average-time-ms')), (times[0] + times[1]) / 2);

  // Cancel between boards, restart with fresh results, then Escape while playing.
  await start(); await advanceCountdown(); await completeNumbers(9);
  await phase('countdown'); await dialog.getByRole('button', { name: 'Cancelar partida' }).click();
  await page.clock.runFor(4000); await phase('idle');
  assert.equal(await page.locator('tbody tr').count(), 0);
  await start(); await advanceCountdown(); await page.keyboard.press('Escape'); await phase('idle');
  assert.equal(await dialog.count(), 0);

  // All grid shapes fit in a small landscape viewport; keyboard and mixed content still work.
  await page.setViewportSize({ width: 667, height: 375 });
  await counts.selectOption('1');
  for (const size of ['3x3', '3x4', '4x4', '4x5', '5x5']) {
    await page.getByLabel('Cuadrícula', { exact: true }).selectOption(size);
    await start(); await advanceCountdown(); await checkBoundsAndLock();
    await page.keyboard.press('Escape'); await phase('idle');
  }
  await page.getByLabel('Cuadrícula', { exact: true }).selectOption('3x3');
  await page.getByLabel('Contenido', { exact: true }).selectOption('mixedRandomCase');
  await start(); await advanceCountdown();
  for (const value of ['1', 'a', '2', 'b', '3', 'c', '4', 'd', '5']) {
    const cell = dialog.getByRole('button', { name: new RegExp(`^Elemento ${value}$`, 'i') });
    await cell.focus(); await page.keyboard.press('Enter');
  }
  await phase('finished');
  assert.equal(await page.locator('tbody tr td').last().innerText(), '0');
  assert.deepEqual(errors, []);
  console.log('Schulte: fullscreen, scroll lock, cancellation, 3-second transitions, independent results, averages, keyboard and landscape layouts passed.');
} finally {
  await browser.close();
}
