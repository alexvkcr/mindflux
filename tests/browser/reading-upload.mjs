import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { MAX_TEXT_FILE_BYTES } from '../../src/games/speed-reading/utils/plainTextFile.ts';
import { buildLines } from '../../src/games/speed-reading/utils/buildLines.ts';
import { tokenize } from '../../src/games/speed-reading/utils/tokenize.ts';
import { normalizeReadingText } from '../../src/games/speed-reading/utils/characterReading.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const input = page.getByTestId('reading-text-file');
const exercise = page.locator('[data-reading]');
const book = page.getByTestId('reading-controls-book');
const customText = 'Mi lectura propia: áéíóú y ñ. 😊\nEl texto <img src=x onerror="window.txtExecuted=true"> se muestra como letras, sin ejecutar nada.\n' +
  'Uno dos tres cuatro cinco seis siete ocho nueve diez. '.repeat(12);
const normalized = normalizeReadingText(customText);
const upload = async (name, buffer, mimeType = 'text/plain') => {
  await input.setInputFiles({ name, buffer, mimeType });
  await page.getByTestId('reading-loaded-file').filter({ hasText: name }).waitFor();
};
const mode = async value => {
  await page.locator('select').nth(1).selectOption(value);
  await page.locator('[data-guided-setup], [data-reading="fixed"], [data-reading="columns"]').waitFor();
};
try {
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5188/mindflux/');
  await page.locator('select').nth(0).selectOption('speedReading');
  await page.getByTestId('reading-controls-width').selectOption('1');
  await page.getByTestId('reading-controls-level').selectOption('6');
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await upload('Lectura propia.TXT', Buffer.from(customText));
  assert.equal(await book.inputValue(), 'custom');
  const blocks = buildLines(tokenize(customText), 14);

  for (const value of ['fixedReading', 'columnReading', 'guidedReading']) {
    await mode(value);
    assert.equal(await book.inputValue(), 'custom', 'the uploaded text stays selected between games');
    assert.equal(await page.getByTestId('reading-loaded-file').textContent(), 'Lectura propia.TXT');
    await page.getByRole('button', { name: 'Arranque', exact: true }).click();
    assert.equal(await input.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Quitar TXT', exact: true }).isDisabled(), true);
    if (value === 'guidedReading') {
      const visible = await page.locator('[data-guided-text]').textContent();
      assert.ok(normalized.startsWith(visible), 'the first page contains the start of the uploaded text');
      assert.equal(await page.locator('[data-guided-text] img').count(), 0);
      assert.equal(await page.locator('[data-guided-text] strong').count(), 1);
    } else {
      const active = page.locator('[data-testid="reading-viewport-line"] span, [data-active="true"] span');
      assert.equal(await active.textContent(), blocks[0]);
      await page.clock.runFor(500); assert.equal(await active.textContent(), blocks[1]);
    }
    await page.getByRole('button', { name: value === 'guidedReading' ? 'Cerrar lector y detener' : 'Alto', exact: true }).click();
  }
  assert.equal(await page.evaluate(() => window.txtExecuted), undefined);
  const originalPage = await page.locator('[data-guided-text]').textContent();

  // Untrusted MIME labels and extensions must not bypass content validation.
  const invalid = [
    { name: 'imagen.txt', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10]), error: 'no es texto plano' },
    { name: 'pdf.txt', buffer: Buffer.from('%PDF-1.7\nASCII document'), error: 'otro formato' },
    { name: 'word.txt', buffer: Buffer.from('PK\x03\x04renamed DOCX'), error: 'no es texto plano' },
    { name: 'rtf.txt', buffer: Buffer.from('{\\rtf1 texto}'), error: 'otro formato' },
    { name: 'control.txt', buffer: Buffer.from('Un prefijo de texto. '.repeat(5000) + '\x00'), error: 'control' },
    { name: 'encoding.txt', buffer: Buffer.from([0xc3, 0x28]), error: 'codificación' },
    { name: 'vacio.txt', buffer: Buffer.alloc(0), error: 'vacío' },
    { name: 'texto.pdf', buffer: Buffer.from('Esto sí es texto plano'), error: 'extensión' },
    { name: 'grande.txt', buffer: Buffer.alloc(MAX_TEXT_FILE_BYTES + 1, 0x61), error: '10 MB' },
  ];
  for (const file of invalid) {
    await input.setInputFiles({ name: file.name, buffer: file.buffer, mimeType: 'text/plain' });
    await page.getByRole('alert').filter({ hasText: file.error }).waitFor();
    assert.equal(await book.inputValue(), 'custom');
    assert.equal(await page.getByTestId('reading-loaded-file').textContent(), 'Lectura propia.TXT');
    assert.equal(await page.locator('[data-guided-text]').textContent(), originalPage, 'rejection must preserve the previous document');
  }

  const utf16Text = 'Lectura UTF-16: árboles, pingüinos y una línea propia.';
  await upload('unicode.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(utf16Text, 'utf16le')]), 'application/octet-stream');
  assert.equal(await page.locator('[data-guided-text]').textContent(), utf16Text);
  await book.selectOption('quijote');
  assert.match(await page.locator('[data-guided-text]').textContent(), /^En un lugar/);
  await book.selectOption('custom');
  assert.equal(await page.locator('[data-guided-text]').textContent(), utf16Text);

  // Exercise the advertised boundary with real browser File APIs and all three games.
  await mode('fixedReading');
  await page.getByTestId('reading-controls-width').selectOption('5');
  const phrase = 'Texto propio para practicar la lectura. ';
  const largeText = phrase.repeat(Math.ceil(MAX_TEXT_FILE_BYTES / phrase.length)).slice(0, MAX_TEXT_FILE_BYTES);
  await upload('libro-10mb.txt', Buffer.from(largeText));
  for (const value of ['fixedReading', 'columnReading', 'guidedReading']) {
    await mode(value);
    if (value === 'guidedReading') {
      await page.getByTestId('reading-controls-line-cycles').selectOption('3');
    }
    await page.getByRole('button', { name: 'Arranque', exact: true }).click();
    if (value === 'guidedReading') {
      const firstPage = await page.locator('[data-guided-text]').textContent();
      assert.ok(largeText.startsWith(firstPage));
      assert.ok(firstPage.length < 3000, 'only the current page should be in the reader DOM');
      assert.ok(Number(await page.locator('[data-guided-text]').getAttribute('data-pages')) > 100);
    }
    await page.clock.runFor(500);
    assert.equal(await exercise.getAttribute('data-index'), '1');
    await page.getByRole('button', { name: value === 'guidedReading' ? 'Cerrar lector y detener' : 'Alto', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Quitar TXT', exact: true }).click();
  assert.equal(await book.inputValue(), 'quijote');
  assert.equal(await book.locator('option[value="custom"]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('TXT upload in all three games, shared source, literal rendering, renamed binary rejection, full-content checks, UTF-16 and the 10 MiB boundary passed.');
} finally { await browser.close(); }
