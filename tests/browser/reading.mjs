import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { quijote } from '../../src/games/speed-reading/texts/quijote.ts';
import { buildLines } from '../../src/games/speed-reading/utils/buildLines.ts';
import { tokenize } from '../../src/games/speed-reading/utils/tokenize.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const exercise = page.locator('[data-reading]');
const activeText = () => page.locator('[data-testid="reading-viewport-line"] span, [data-active="true"] span').innerText();
const index = async () => Number(await exercise.getAttribute('data-index'));
const start = () => page.getByRole('button', { name: 'Arranque', exact: true }).click();
const stop = () => page.getByRole('button', { name: 'Alto', exact: true }).click();
const widths = { 1: 14, 2: 19, 3: 24, 4: 29, 5: 34 };
async function checkTextFits() {
  const fit = await page.evaluate(() => {
    // Select and measure in one browser turn: reflow can move the active cell to another row.
    const el = document.querySelector('[data-testid="reading-viewport-line"], [data-active="true"]');
    const stage = el.closest('[class*="stage"]');
    const text = el.querySelector('span');
    const bounds = text.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const columns = el.closest('[data-columns="2"]');
    const range = document.createRange();
    range.selectNodeContents(text);
    const textBounds = range.getBoundingClientRect();
    return { text: text.textContent, overflow: text.scrollWidth - text.clientWidth, left: bounds.left, right: bounds.right,
      top: bounds.top, bottom: bounds.bottom, stage: { left: stageBounds.left, right: stageBounds.right, top: stageBounds.top, bottom: stageBounds.bottom },
      animation: getComputedStyle(el).animationName, size: parseFloat(getComputedStyle(el).fontSize),
      font: getComputedStyle(el).fontFamily, weight: getComputedStyle(el).fontWeight,
      innerEdge: columns ? {
        actual: el === el.parentElement.firstElementChild ? textBounds.right : textBounds.left,
        expected: (stageBounds.left + stageBounds.right) / 2 + (el === el.parentElement.firstElementChild ? -1 : 1) * parseFloat(columns.style.getPropertyValue('--column-gap')) / 2,
      } : null };
  });
  assert.ok(fit.text.length > 0, JSON.stringify(fit));
  assert.ok(fit.overflow <= 1, JSON.stringify(fit));
  assert.ok(fit.left >= fit.stage.left - 1 && fit.right <= fit.stage.right + 1, JSON.stringify(fit));
  assert.ok(fit.top >= fit.stage.top - 1 && fit.bottom <= fit.stage.bottom + 1, JSON.stringify(fit));
  assert.equal(fit.animation, 'none');
  assert.match(fit.font, /^Arial/);
  assert.equal(fit.weight, '400');
  if (fit.innerEdge) assert.ok(Math.abs(fit.innerEdge.actual - fit.innerEdge.expected) < 1, `text must align at the central gap: ${JSON.stringify(fit)}`);
  assert.ok(fit.size >= 11.5, `reading font too small: ${fit.size}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}
async function setMode(value) {
  await page.locator('select').nth(1).selectOption(value);
  await exercise.waitFor();
}
async function checkReturnCue() {
  const cue = await page.getByRole('region', { name: 'Lectura en columnas', exact: true }).evaluate(el => {
    const active = el.querySelector('[data-active="true"]');
    const row = Array.from(el.children).indexOf(active.parentElement);
    const footer = el.querySelector('[data-testid="reading-return-cue"]');
    const bounds = footer.getBoundingClientRect();
    const stage = el.parentElement.getBoundingClientRect();
    return { row, expected: el.dataset.nextPage === 'true' && row === Number(el.dataset.rows) - 1,
      visible: getComputedStyle(footer).visibility === 'visible', border: parseFloat(getComputedStyle(footer).borderBottomWidth),
      top: bounds.top, bottom: bounds.bottom, lastRowBottom: el.children[Number(el.dataset.rows) - 1].getBoundingClientRect().bottom,
      rowHeights: Array.from(el.children).slice(0, Number(el.dataset.rows)).map(row => row.getBoundingClientRect().height),
      stageBottom: stage.bottom };
  });
  assert.equal(cue.visible, cue.expected, JSON.stringify(cue));
  assert.ok(Math.max(...cue.rowHeights) - Math.min(...cue.rowHeights) < 1, 'hidden and visible rows must reserve the same height');
  if (cue.visible) {
    assert.ok(cue.border >= 2);
    assert.ok(cue.top >= cue.lastRowBottom && cue.bottom <= cue.stageBottom + 1, 'cue must fit beneath the last row');
    assert.equal(await page.getByTestId('reading-return-cue').textContent(), '', 'the cue is a border without explanatory text');
  }
  return cue;
}
try {
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5188/mindflux/');
  await page.locator('select').nth(0).selectOption('speedReading');
  await exercise.waitFor();
  assert.equal(await page.getByTestId('reading-controls-book').count(), 1, 'one set of controls');
  assert.doesNotMatch(await page.getByTestId('reading-controls-level').innerText(), /WPM|palabras|minuto/);
  await page.clock.install();
  await page.clock.pauseAt(new Date());

  // Reproduce the narrow screenshot setting; text and metrics must agree with the source.
  await page.getByTestId('reading-controls-level').selectOption('8');
  await page.getByTestId('reading-controls-width').selectOption('1');
  assert.match(await page.getByTestId('reading-reference-speed').innerText(), /420/);
  await page.getByTestId('reading-controls-width').selectOption('2');
  assert.match(await page.getByTestId('reading-reference-speed').innerText(), /560/);
  assert.match(await page.getByTestId('reading-controls-width').locator('option:checked').innerText(), /4 palabras.*19 caracteres/);
  await page.getByText('Cómo se calculan el ancho y la velocidad', { exact: true }).click();
  await page.getByText('como como como como', { exact: true }).waitFor();
  await page.getByText('Cómo se calculan el ancho y la velocidad', { exact: true }).click();

  for (const mode of ['fixedReading', 'columnReading']) {
    await setMode(mode);
    await page.getByTestId('reading-controls-level').selectOption('6');
    await page.getByTestId('reading-controls-width').selectOption('1');
    const lines = buildLines(tokenize(quijote.map(fragment => fragment.text).join('\n\n')), 14);
    await start();
    assert.equal(await page.getByTestId('reading-controls-width').isDisabled(), true);
    assert.equal(await activeText(), lines[0]);
    await checkTextFits();
    // Pause halfway through a block, then resume only its remaining exposure.
    await page.clock.runFor(200);
    await page.getByRole('button', { name: 'Pausa', exact: true }).click();
    const pausedTime = await page.getByTestId('reading-time').innerText();
    await page.clock.runFor(5000);
    assert.equal(await index(), 0); assert.equal(await page.getByTestId('reading-time').innerText(), pausedTime);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.clock.runFor(299); assert.equal(await index(), 0);
    await page.clock.runFor(1); assert.equal(await index(), 1);
    assert.equal(await activeText(), lines[1]);
    await checkTextFits();
    let sawBottom = false, sawReturn = false, previousBottom = false;
    for (let i = 2; i <= 25; i++) {
      await page.clock.runFor(500);
      assert.equal(await index(), i);
      assert.equal(await activeText(), lines[i]);
      if (mode === 'columnReading') {
        const cue = await checkReturnCue();
        if (previousBottom && !cue.visible && cue.row === 0) sawReturn = true;
        if (cue.visible && !sawBottom && process.env.SCREENSHOT_PREFIX) {
          await exercise.screenshot({ path: `${process.env.SCREENSHOT_PREFIX}-bottom-cue.png` });
        }
        sawBottom ||= cue.visible;
        previousBottom = cue.visible;
      }
    }
    if (mode === 'columnReading') assert.ok(sawBottom && sawReturn, 'show the bottom cue before returning to the first row');
    // Reflow must retain the current block and the existing interval.
    await page.setViewportSize({ width: 390, height: 844 });
    // Let ResizeObserver apply proportional font measurements before checking the new layout.
    await page.clock.runFor(32);
    assert.equal(await index(), 25); assert.equal(await activeText(), lines[25]);
    await checkTextFits();
    if (process.env.SCREENSHOT_PREFIX) await exercise.screenshot({ path: `${process.env.SCREENSHOT_PREFIX}-${mode}-mobile.png` });
    await page.clock.runFor(500); assert.equal(await index(), 26); assert.equal(await activeText(), lines[26]);
    await page.clock.runFor(mode === 'fixedReading' ? 17000 : 32000);
    await page.locator('[data-status="finished"]').waitFor();
    assert.match(await page.getByTestId('reading-time').innerText(), /0:00/);
    assert.equal(await page.getByRole('button', { name: 'Pausa', exact: true }).isDisabled(), true);
    await start(); assert.equal(await index(), 0); await stop();
    console.log(`${mode}: ordered blocks, cadence, pause/resume, resize, deadline and restart passed.`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.runFor(32);
  }

  // Inspect all widths/books in both exercises, including the smallest mobile screen.
  for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 640 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await page.clock.runFor(32);
    for (const mode of ['fixedReading', 'columnReading']) {
      await setMode(mode);
      for (const book of ['quijote', 'regenta', 'colmena']) {
        await page.getByTestId('reading-controls-book').selectOption(book);
        for (const value of Object.keys(widths)) {
          await page.getByTestId('reading-controls-width').selectOption(value);
          await checkTextFits();
        }
      }
      if (process.env.SCREENSHOT_PREFIX && viewport.width === 1280) await exercise.screenshot({ path: `${process.env.SCREENSHOT_PREFIX}-${mode}-desktop.png` });
    }
    console.log(`Text fits at ${viewport.width} × ${viewport.height}, all books and widths.`);
  }

  // Leave during active reading; old timers must not change the replacement game.
  await start(); await page.clock.runFor(200);
  await page.locator('select').nth(0).selectOption('memory');
  await page.clock.runFor(60000);
  assert.equal(await exercise.count(), 0);
  assert.deepEqual(errors, []);
  console.log('Reading controls, width equivalence, metrics, responsive rendering and unmount cleanup passed.');
} finally { await browser.close(); }
