import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { quijote } from '../../src/games/speed-reading/texts/quijote.ts';
import { regenta } from '../../src/games/speed-reading/texts/regenta.ts';
import { colmena } from '../../src/games/speed-reading/texts/colmena.ts';
import { normalizeReadingText } from '../../src/games/speed-reading/utils/characterReading.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const dialog = page.getByTestId('guided-reader');
const reader = page.locator('[data-reading="guided"]');
const article = page.locator('[data-guided-text]');
const books = { quijote, regenta, colmena };
const source = book => normalizeReadingText(books[book].map(part => part.text).join('\n\n'));
const close = () => page.getByRole('button', { name: 'Cerrar lector y detener', exact: true }).click();
const launch = async () => {
  await page.getByRole('button', { name: 'Arranque', exact: true }).click();
  await dialog.waitFor({ state: 'visible' });
  // Let Chromium deliver actual ResizeObserver events independently of the virtual session timer.
  await new Promise(resolve => setTimeout(resolve, 50));
};

async function checkPage(book, finished = false) {
  const text = source(book), characters = Array.from(text);
  const state = await dialog.evaluate(el => {
    const article = el.querySelector('[data-guided-text]');
    const body = el.querySelector('[data-testid="reading-page-body"]');
    const lines = Array.from(article.querySelectorAll('[data-guided-line]'));
    const bounds = el.getBoundingClientRect(), pageBounds = body.getBoundingClientRect();
    return {
      text: article.textContent, first: Number(lines[0].dataset.start), last: Number(lines.at(-1).dataset.end),
      start: Number(article.dataset.activeStart), end: Number(article.dataset.activeEnd),
      bold: Array.from(article.querySelectorAll('strong')).map(strong => strong.textContent).join(''),
      activeLines: lines.filter(line => line.querySelector('strong')).length,
      lineLimit: Number(article.dataset.lineLimit),
      lines: lines.map(line => {
        const range = document.createRange(); range.selectNodeContents(line);
        const size = range.getBoundingClientRect();
        return { start: Number(line.dataset.start), end: Number(line.dataset.end),
          left: size.left, right: size.right, top: size.top, bottom: size.bottom };
      }),
      page: Number(article.dataset.page), pages: Number(article.dataset.pages),
      fullscreen: bounds.width === innerWidth && Math.abs(bounds.height - innerHeight) < 1,
      scroll: [el, body, el.querySelector('[data-reading]')].some(node => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1),
      pageBounds: { left: pageBounds.left, right: pageBounds.right, top: pageBounds.top, bottom: pageBounds.bottom },
      locked: document.body.style.position === 'fixed' && document.documentElement.style.overflow === 'hidden',
      emphasis: article.querySelector('strong') && { color: getComputedStyle(article.querySelector('strong')).color,
        background: getComputedStyle(article.querySelector('strong')).backgroundColor,
        stroke: parseFloat(getComputedStyle(article.querySelector('strong')).webkitTextStrokeWidth) },
    };
  });
  assert.equal(state.text, characters.slice(state.first, state.last).join(''));
  assert.equal(state.fullscreen, true); assert.equal(state.locked, true); assert.equal(state.scroll, false);
  for (const line of state.lines) {
    assert.ok(line.end - line.start <= state.lineLimit);
    assert.ok(line.start === 0 || characters[line.start - 1] === ' ', 'lines never start inside a word');
    assert.ok(line.end === characters.length || characters[line.end - 1] === ' ', 'lines never end inside a word');
    assert.ok(line.left >= state.pageBounds.left - 1 && line.right <= state.pageBounds.right + 1);
    assert.ok(line.top >= state.pageBounds.top - 1 && line.bottom <= state.pageBounds.bottom + 1);
  }
  if (!finished) {
    assert.equal(state.activeLines, 1, 'a cycle must stay on exactly one line');
    assert.equal(state.bold, characters.slice(state.start, state.end).join(''));
    assert.ok(state.start === 0 || characters[state.start - 1] === ' ', 'bold never starts inside a word');
    assert.ok(state.end === characters.length || characters[state.end - 1] === ' ', 'bold never ends inside a word');
    assert.ok(state.emphasis.stroke >= 1); assert.notEqual(state.emphasis.background, 'rgba(0, 0, 0, 0)');
  } else assert.equal(state.bold, '');
  return state;
}

try {
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5188/mindflux/');
  await page.locator('select').nth(0).selectOption('speedReading');
  await page.locator('select').nth(1).selectOption('guidedReading');
  await page.getByTestId('reading-controls-level').selectOption('6');
  await page.clock.install(); await page.clock.pauseAt(new Date());

  for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 640 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await new Promise(resolve => setTimeout(resolve, 50));
    for (const book of Object.keys(books)) {
      await page.getByTestId('reading-controls-book').selectOption(book);
      // Every enabled combination must fit; disabled widths and factors must be unavailable.
      const widths = await page.getByTestId('reading-controls-width').locator('option:enabled').evaluateAll(options => options.map(option => option.value));
      for (const width of widths) {
        await page.getByTestId('reading-controls-width').selectOption(width);
        const factors = await page.getByTestId('reading-controls-line-cycles').locator('option:enabled').evaluateAll(options => options.map(option => option.value));
        for (const factor of factors) {
          await page.getByTestId('reading-controls-line-cycles').selectOption(factor);
          await launch(); await checkPage(book); await close();
        }
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`Fullscreen pages, whole words, no scroll and enabled combinations passed at ${viewport.width} x ${viewport.height}.`);
  }

  await page.setViewportSize({ width: 1280, height: 500 });
  await new Promise(resolve => setTimeout(resolve, 50));
  await page.getByTestId('reading-controls-book').selectOption('quijote');
  await page.getByTestId('reading-controls-width').selectOption('1');
  await page.getByTestId('reading-controls-line-cycles').selectOption('2');
  await launch();
  const first = await checkPage('quijote'); assert.ok(first.pages > 1);
  await page.clock.runFor(200);
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await page.clock.runFor(10000); assert.equal(await reader.getAttribute('data-index'), '0');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  const second = await checkPage('quijote');
  assert.equal(second.page, 1); assert.equal(second.first, first.last);
  assert.equal(await reader.getAttribute('data-status'), 'paused');
  await page.clock.runFor(10000); assert.equal((await checkPage('quijote')).start, second.start);
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  assert.equal((await checkPage('quijote')).page, 0);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.clock.runFor(499); assert.equal(await reader.getAttribute('data-index'), '0');
  await page.clock.runFor(1); assert.equal(await reader.getAttribute('data-index'), '1');

  // Automatic pagination covers the whole document in order, without skipping a word.
  const visited = new Map([[0, first.text]]);
  let previousEnd = (await checkPage('quijote')).end;
  const count = Number((await page.getByTestId('reading-time').textContent()).split('/')[1]);
  for (let index = 2; index < count; index++) {
    await page.clock.runFor(500);
    const state = await checkPage('quijote');
    assert.equal(state.start, previousEnd); previousEnd = state.end;
    visited.set(state.page, state.text);
  }
  assert.equal([...visited.values()].join(''), source('quijote'));
  await page.clock.runFor(500);
  await checkPage('quijote', true);
  assert.equal(await reader.getAttribute('data-status'), 'finished');
  await close();
  assert.equal(await page.evaluate(() => document.body.style.position), '');

  // Resize a paused, wide reader. Invalid options are corrected and the source anchor is kept.
  await page.setViewportSize({ width: 1280, height: 900 });
  await new Promise(resolve => setTimeout(resolve, 50));
  await page.getByTestId('reading-controls-width').selectOption('5');
  const factorOptions = await page.getByTestId('reading-controls-line-cycles').locator('option:enabled').evaluateAll(options => options.map(option => option.value));
  await page.getByTestId('reading-controls-line-cycles').selectOption(factorOptions.at(-1));
  await launch(); await page.clock.runFor(700);
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  const anchor = (await checkPage('quijote')).start;
  await page.setViewportSize({ width: 320, height: 640 });
  await new Promise(resolve => setTimeout(resolve, 100));
  const resized = await checkPage('quijote');
  assert.ok(resized.start <= anchor && resized.end > anchor);
  assert.equal(await reader.getAttribute('data-status'), 'paused');
  if (process.env.SCREENSHOT_PREFIX) await dialog.screenshot({ path: `${process.env.SCREENSHOT_PREFIX}-mobile.png` });
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await page.evaluate(() => document.body.style.position), '');
  await page.clock.runFor(2000); assert.equal(await reader.getAttribute('data-status'), 'idle');
  assert.deepEqual(errors, []);
  console.log('Automatic pagination, exact coverage, previous/next, pause timing, completion, resize anchor, close and Escape passed.');
} finally { await browser.close(); }
