import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSequence, CONTENT_OPTIONS, GRID_OPTIONS, normalizeBoardCount, shuffle, summarizeBoards }
  from '../src/games/campo-visual/SchulteTable/schulte.ts';

test('every Schulte configuration has one unique target for every cell', () => {
  for (const grid of GRID_OPTIONS) {
    for (const mode of CONTENT_OPTIONS) {
      const count = grid.rows * grid.cols;
      const sequence = buildSequence(mode.value, count);
      assert.equal(sequence.length, count);
      assert.equal(new Set(sequence).size, count);
      const cells = shuffle(sequence);
      assert.deepEqual([...cells].sort(), [...sequence].sort());
      if (mode.value === 'numbers') assert.deepEqual(sequence, Array.from({ length: count }, (_, i) => String(i + 1)));
      if (mode.value.startsWith('mixed')) {
        sequence.forEach((value, i) => assert.equal(value.toUpperCase(), i % 2 === 0 ? String(i / 2 + 1) : String.fromCharCode(65 + Math.floor(i / 2))));
      }
    }
  }
});

test('continuous sessions accept at most fifteen complete boards', () => {
  assert.equal(normalizeBoardCount(0), 1);
  assert.equal(normalizeBoardCount(16), 15);
  assert.equal(normalizeBoardCount(2.6), 3);
  assert.equal(normalizeBoardCount(NaN), 3);
  for (let count = 1; count <= 15; count++) assert.equal(normalizeBoardCount(count), count);
});

test('session averages preserve fractional errors and time without rounding individual boards', () => {
  const results = [{ board: 1, timeMs: 1351, errors: 0 }, { board: 2, timeMs: 2742, errors: 3 }];
  assert.deepEqual(summarizeBoards(results), { timeMs: 2046.5, errors: 1.5 });
  assert.deepEqual(results[0], { board: 1, timeMs: 1351, errors: 0 });
  assert.deepEqual(summarizeBoards([]), { timeMs: 0, errors: 0 });
});
