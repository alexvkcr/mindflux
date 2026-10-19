import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVELS, INITIAL_STATE, createRound, evaluateRound, lastK, reducer, sanitizeAnswer, summarize } from '../src/games/memory/RunningSpan/engine.ts';

test('nine levels use the requested K and constant exposure', () => {
  assert.deepEqual(LEVELS.map(({ k, exposureMs }) => [k, exposureMs]), [
    [3, 1500], [3, 1100], [4, 1100], [4, 800], [5, 800],
    [5, 600], [6, 600], [7, 450], [8, 350]
  ]);
});

test('last K retains order, repetitions and leading zeroes', () => {
  assert.equal(lastK('7410003', 4), '0003');
  assert.equal(lastK('00000000', 3), '000');
  assert.equal(sanitizeAnswer('00 03', 4), '0003');
  assert.equal(sanitizeAnswer('00031', 4), '0003');
});

test('round length spans the full inclusive range and digits can repeat', () => {
  for (let level = 1; level <= 9; level++) {
    const k = LEVELS[level - 1].k;
    const min = createRound(level, () => 0);
    const max = createRound(level, () => .999999);
    assert.equal(min.sequence.length, 2 * k + 2);
    assert.equal(max.sequence.length, 4 * k + 4);
    assert.equal(min.sequence, '0'.repeat(min.sequence.length));
    assert.equal(max.sequence, '9'.repeat(max.sequence.length));
    const lengths = new Set();
    for (let n = 0; n <= 2 * k + 2; n++) {
      let first = true;
      lengths.add(createRound(level, () => first ? (first = false, n / (2 * k + 3)) : 0).sequence.length);
    }
    assert.equal(lengths.size, 2 * k + 3);
  }
});

test('evaluation compares strings by position and counts incomplete answers', () => {
  const round = { level: 3, k: 4, exposureMs: 1100, sequence: '7890003' };
  const perfect = evaluateRound(round, '0003', 1);
  assert.equal(perfect.expected, '0003');
  assert.equal(perfect.complete, true);
  assert.equal(perfect.correctCount, 4);
  const partial = evaluateRound(round, '001', 2);
  assert.equal(partial.correctCount, 2);
  assert.deepEqual(partial.positions.map(({ expected, actual, correct }) => [expected, actual, correct]), [
    ['0', '0', true], ['0', '0', true], ['0', '1', false], ['3', '', false]
  ]);
  assert.deepEqual(summarize([perfect, partial]), { completeRounds: 1, correctPositions: 6, positions: 8, percentage: 75 });
});

test('state machine gates input, pause, stale ticks and final transition', () => {
  const round = { level: 1, k: 3, exposureMs: 1500, sequence: '00000000' };
  let state = reducer(INITIAL_STATE, { type: 'start', round });
  assert.equal(state.phase, 'prepare');
  assert.equal(reducer(state, { type: 'append', digit: '4' }).answer, '');
  state = reducer(state, { type: 'begin' });
  state = reducer(state, { type: 'pause' });
  assert.equal(reducer(state, { type: 'tick', round, digitIndex: 0 }).digitIndex, 0);
  state = reducer(state, { type: 'pause' });
  state = reducer(state, { type: 'tick', round, digitIndex: 0 });
  assert.equal(state.digitIndex, 1);
  assert.equal(reducer(state, { type: 'tick', round, digitIndex: 0 }).digitIndex, 1);
  for (let i = 1; i < round.sequence.length; i++) state = reducer(state, { type: 'tick', round, digitIndex: i });
  assert.equal(state.phase, 'answer');
  state = reducer(state, { type: 'append', digit: '0' });
  state = reducer(state, { type: 'append', digit: '0' });
  state = reducer(state, { type: 'append', digit: '0' });
  assert.equal(state.answer, '000');
  state = reducer(state, { type: 'submit' });
  assert.equal(state.phase, 'correct');
  assert.equal(state.results[0].complete, true);
  assert.equal(reducer(state, { type: 'restart' }).phase, 'idle');
  const finished = reducer({ ...state, sessionLength: 5, results: Array(5).fill(state.results[0]) }, { type: 'next' });
  assert.equal(finished.phase, 'finished');
});
