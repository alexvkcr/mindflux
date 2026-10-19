import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WIDTH_MAP, referenceWords } from '../src/games/speed-reading/utils/widthMap.ts';
import { levelToIntervalMs, readingMetrics } from '../src/games/speed-reading/utils/pace.ts';
import { buildLines } from '../src/games/speed-reading/utils/buildLines.ts';
import { tokenize } from '../src/games/speed-reading/utils/tokenize.ts';
import { createReadingSession } from '../src/games/speed-reading/readingSession.ts';
import { highlightedParts, normalizeReadingText }
  from '../src/games/speed-reading/utils/characterReading.ts';
import { decodePlainText, readPlainTextFile, MAX_TEXT_FILE_BYTES } from '../src/games/speed-reading/utils/plainTextFile.ts';
import { buildWordDocument, readingCapacity, readingCombinations, closestCombination } from '../src/games/speed-reading/utils/pagedReading.ts';

function harness(patch = {}) {
  let now = 0, id = 0, finished = 0;
  const timers = new Map();
  const snapshots = [];
  const clock = {
    now: () => now,
    setTimeout(callback, delay) { timers.set(++id, { callback, at: now + delay }); return id; },
    clearTimeout(key) { timers.delete(key); },
  };
  const session = createReadingSession({ blockCount: 100, intervalMs: 500, durationMs: 30000, loop: true, ...patch }, clock,
    snapshot => snapshots.push(snapshot), () => finished++);
  const advance = ms => {
    const end = now + ms;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    now = end;
  };
  return { session, advance, snapshots, timers, get finished() { return finished; },
    delayBrowser(ms) {
      now += ms;
      const due = [...timers].filter(([, timer]) => timer.at <= now);
      for (const [key, timer] of due) { timers.delete(key); timer.callback(); }
    } };
}

test('reference widths include the spaces between copies of como', () => {
  for (const width of Object.values(WIDTH_MAP)) assert.equal(Array(referenceWords(width)).fill('como').join(' ').length, width);
  assert.equal(WIDTH_MAP[1], 'como como como'.length);
  assert.equal(WIDTH_MAP[2], 'como como como como'.length);
  assert.deepEqual(Object.values(WIDTH_MAP).map(referenceWords), [3, 4, 5, 6, 7]);
});

test('width changes throughput, not the selected block cadence', () => {
  const interval = levelToIntervalMs(8);
  const narrow = readingMetrics(interval, referenceWords(WIDTH_MAP[1]), ['como como como']);
  const wide = readingMetrics(interval, referenceWords(WIDTH_MAP[2]), ['como como como como']);
  assert.equal(narrow.blocksPerMinute, wide.blocksPerMinute);
  assert.equal(narrow.referenceWpm, 420);
  assert.equal(wide.referenceWpm, 560);
  assert.equal(narrow.textWpm, 420);
  assert.equal(readingMetrics(interval, 3, ['extraordinario', 'de la']).textWpm, 210);
  assert.equal(levelToIntervalMs(6), 500);
});

test('blocks preserve every complete word, including words longer than the reference width', () => {
  const words = tokenize('  En un\nlugar de\tla Mancha extraordinariamentecomplejo. ');
  for (const width of Object.values(WIDTH_MAP)) {
    const lines = buildLines(words, width);
    assert.deepEqual(tokenize(lines.join(' ')), words);
    for (const line of lines) assert.ok(line.length <= width || tokenize(line).length === 1);
  }
});

test('pause preserves the remaining block exposure and session time', () => {
  const h = harness(); h.session.start(); h.advance(200); h.session.pause();
  h.advance(10000);
  assert.equal(h.session.getSnapshot().index, 0);
  assert.equal(h.session.getSnapshot().timeLeftMs, 29800);
  h.session.resume(); h.advance(299);
  assert.equal(h.session.getSnapshot().index, 0);
  h.advance(1);
  assert.equal(h.session.getSnapshot().index, 1);
  assert.equal(h.session.getSnapshot().timeLeftMs, 29500);
  assert.equal(h.finished, 0);
});

test('fixed sessions loop in order and finish exactly once at the active deadline', () => {
  const h = harness({ blockCount: 2, durationMs: 3000 }); h.session.start();
  const indices = [0];
  for (let i = 0; i < 5; i++) { h.advance(500); indices.push(h.session.getSnapshot().index); }
  assert.deepEqual(indices, [0, 1, 0, 1, 0, 1]);
  h.advance(500);
  assert.equal(h.finished, 1);
  assert.equal(h.session.getSnapshot().timeLeftMs, 0);
  assert.equal(h.session.getSnapshot().status, 'finished');
  assert.equal(h.timers.size, 0);
  h.advance(10000); h.session.pause(); h.session.resume();
  assert.equal(h.finished, 1);
});

test('column sessions finish after the final block has had its full exposure', () => {
  const h = harness({ blockCount: 3, loop: false, durationMs: 45000 }); h.session.start();
  h.advance(1499);
  assert.equal(h.session.getSnapshot().index, 2);
  assert.equal(h.finished, 0);
  h.advance(1);
  assert.equal(h.finished, 1);
  assert.equal(h.session.getSnapshot().index, 2);
  assert.equal(h.session.getSnapshot().timeLeftMs, 43500);
});

test('stopping, restarting and disposing cancel outstanding timers', () => {
  const h = harness(); h.session.start(); h.advance(250); h.session.stop(); h.advance(5000);
  assert.deepEqual(h.session.getSnapshot(), { index: 0, timeLeftMs: 30000, status: 'idle' });
  h.session.start(); h.advance(499); assert.equal(h.session.getSnapshot().index, 0);
  h.advance(1); assert.equal(h.session.getSnapshot().index, 1);
  h.session.dispose(); const count = h.snapshots.length; h.advance(60000);
  assert.equal(h.snapshots.length, count);
  assert.equal(h.timers.size, 0); assert.equal(h.finished, 0);
});

test('a delayed browser callback never skips unread blocks', () => {
  const h = harness(); h.session.start(); h.delayBrowser(2500);
  assert.equal(h.session.getSnapshot().index, 1);
  assert.equal(h.session.getSnapshot().timeLeftMs, 27500);
  h.advance(500); assert.equal(h.session.getSnapshot().index, 2);
});

test('empty sources finish without leaving a timer running', () => {
  const h = harness({ blockCount: 0 }); h.session.start();
  assert.equal(h.finished, 1); assert.equal(h.timers.size, 0);
});

test('rewrapping preserves the running or paused timer and uses the new block total', () => {
  const h = harness({ blockCount: 5, durationMs: Infinity, loop: false });
  h.session.start(); h.advance(200);
  h.session.updateBlocks(8, 3);
  h.advance(299); assert.equal(h.session.getSnapshot().index, 3);
  h.advance(1); assert.equal(h.session.getSnapshot().index, 4);
  h.advance(200); h.session.pause(); h.session.updateBlocks(6, 4);
  h.advance(10000); assert.equal(h.session.getSnapshot().status, 'paused');
  h.session.resume(); h.advance(299); assert.equal(h.session.getSnapshot().index, 4);
  h.advance(1); assert.equal(h.session.getSnapshot().index, 5);
  h.advance(500); assert.equal(h.finished, 1);
});

test('guided reading gives the entire document its cycles without a 30 or 45 second cutoff', () => {
  const h = harness({ blockCount: 100, durationMs: Infinity, loop: false });
  h.session.start(); h.advance(45000);
  assert.equal(h.session.getSnapshot().index, 90);
  assert.equal(h.finished, 0);
  h.advance(5000);
  assert.equal(h.session.getSnapshot().index, 99);
  assert.equal(h.finished, 1);
  assert.equal(h.timers.size, 0);
});

test('TXT validation decodes Unicode strictly, including UTF-8 and UTF-16 BOM encodings', async () => {
  const text = 'Lectura propia: áéíóú, ñ y 😊.\r\nOtra línea\tcon tabulación.';
  const utf8 = new TextEncoder().encode(text);
  assert.equal(decodePlainText(utf8), text);
  assert.equal(decodePlainText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8])), text);
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  assert.equal(decodePlainText(le), text);
  const be = Buffer.from(le); be.swap16();
  assert.equal(decodePlainText(be), text);
  const file = await readPlainTextFile(new File([utf8], 'Lectura.TXT', { type: 'application/octet-stream' }));
  assert.deepEqual(file, { name: 'Lectura.TXT', text, bytes: utf8.length });
});

test('renamed binary and formatted documents are rejected even with a text/plain MIME', async () => {
  const files = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10]),
    Buffer.from('GIF89a'), Buffer.from('PK\x03\x04ZIP data'),
    Buffer.from('%PDF-1.7\nA PDF with an entirely ASCII prefix'),
    Buffer.from('{\\rtf1 formatted document}'),
    Buffer.from('<!doctype html><html><body>not a TXT</body></html>'),
    Buffer.from('<?xml version="1.0"?><document/>'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from([0x4d, 0x5a, 0, 0, 0]),
  ];
  for (const bytes of files) {
    await assert.rejects(readPlainTextFile(new File([bytes], 'renamed.txt', { type: 'text/plain' })));
  }
});

test('the complete file is inspected, including controls and malformed Unicode after a long text prefix', () => {
  const prefix = 'Texto válido. '.repeat(20000);
  for (const suffix of ['\u0000', '\u0007', '\u001b', '\u007f', '\u0085']) {
    assert.throws(() => decodePlainText(new TextEncoder().encode(prefix + suffix)), /control|binarios/);
  }
  assert.throws(() => decodePlainText(Buffer.concat([Buffer.from(prefix), Buffer.from([0xc3, 0x28])])), /codificación/);
  assert.throws(() => decodePlainText(Buffer.from([0xff, 0xfe, 0, 0])), /control|binarios/);
  assert.throws(() => decodePlainText(Buffer.from([0xff, 0xfe, 0x00, 0xd8])), /codificación/);
});

test('TXT size allows exactly 10 MiB and rejects larger files before reading them', async () => {
  const bytes = new Uint8Array(MAX_TEXT_FILE_BYTES).fill(0x61);
  assert.equal(decodePlainText(bytes).length, MAX_TEXT_FILE_BYTES);
  let read = false;
  await assert.rejects(readPlainTextFile({ name: 'large.txt', size: MAX_TEXT_FILE_BYTES + 1,
    arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } }), /10 MB/);
  assert.equal(read, false);
  await assert.rejects(readPlainTextFile(new File([bytes, 'x'], 'large.txt')), /10 MB/);
  await assert.rejects(readPlainTextFile(new File([], 'empty.txt')), /vacío/);
  await assert.rejects(readPlainTextFile(new File([' \n\t'], 'spaces.txt')), /no contiene texto/);
  await assert.rejects(readPlainTextFile(new File(['valid plain text'], 'book.pdf')), /extensión/);
});

test('paged reading highlights only whole words and preserves every source character', () => {
  const text = normalizeReadingText('En un lugar de la Mancha, de cuyo nombre no quiero acordarme.\nExtraordinariamente largo, árbol y 😊.');
  const longest = Math.max(...text.split(' ').map(word => Array.from(word).length + 1));
  const characters = Array.from(text);
  for (const { widthIdx, lineCycles } of readingCombinations(102, longest)) {
    const width = WIDTH_MAP[widthIdx];
    const document = buildWordDocument(text, width, lineCycles);
    assert.equal(document.cycles.map(cycle => cycle.text).join(''), text);
    assert.equal(document.lines.map(line => line.text).join(''), text);
    for (const cycle of document.cycles) {
      assert.ok(cycle.start === 0 || characters[cycle.start - 1] === ' ');
      assert.ok(cycle.end === characters.length || characters[cycle.end - 1] === ' ');
      assert.ok(cycle.start >= document.lines[cycle.line].start && cycle.end <= document.lines[cycle.line].end);
    }
    for (const line of document.lines) {
      assert.ok(line.cycleEnd - line.cycleStart <= lineCycles);
      assert.ok(line.end - line.start <= width * lineCycles);
    }
  }
});

test('long words form an entire cycle and never force two lines to be highlighted', () => {
  const { cycles, lines } = buildWordDocument('uno dos extraordinariamente largo y otras palabras', 14, 2);
  assert.ok(cycles.some(cycle => cycle.text.trim() === 'extraordinariamente'));
  assert.ok(cycles.every(cycle => lines.filter(line => highlightedParts(line, cycle.start, cycle.end).active).length === 1));
});

test('available combinations respect measured screen capacity and the longest whole word', () => {
  const widths = new Float32Array([10, 20, 5, 5, 5]);
  assert.equal(readingCapacity(widths, 30), 2);
  assert.equal(readingCapacity(widths, 19), 0);
  const choices = readingCombinations(45, 20);
  assert.ok(choices.length > 0);
  assert.ok(choices.every(choice => WIDTH_MAP[choice.widthIdx] * choice.lineCycles <= 45));
  assert.ok(choices.every(choice => WIDTH_MAP[choice.widthIdx] * choice.lineCycles >= 20));
  assert.deepEqual(closestCombination(choices, 1, 3), { widthIdx: 1, lineCycles: 3 });
  assert.equal(closestCombination([], 1, 2), undefined);
});

test('page navigation preserves pause and gives the selected page a full first-cycle exposure', () => {
  const h = harness({ blockCount: 10, durationMs: Infinity, loop: false });
  h.session.start(); h.advance(200); h.session.seek(5);
  assert.equal(h.session.getSnapshot().status, 'running');
  h.advance(499); assert.equal(h.session.getSnapshot().index, 5);
  h.advance(1); assert.equal(h.session.getSnapshot().index, 6);
  h.session.pause(); h.session.seek(0); h.advance(60000);
  assert.equal(h.session.getSnapshot().status, 'paused');
  assert.equal(h.session.getSnapshot().index, 0);
  h.session.resume(); h.advance(500); assert.equal(h.session.getSnapshot().index, 1);
});
