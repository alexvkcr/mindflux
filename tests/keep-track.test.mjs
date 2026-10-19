import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CORPUS, LEVELS, INITIAL_STATE, SESSION_ROUNDS, createRound, evaluateRound, latestByCategory, normalizeAnswer, reducer, summarize } from '../src/games/memory/KeepTrack/engine.ts';

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

test('local category corpora have at least 15 distinct, unambiguous entries', () => {
  const entries = Object.entries(CORPUS);
  assert.ok(entries.length >= 5);
  const all = entries.flatMap(([, words]) => words);
  entries.forEach(([, words]) => assert.ok(words.length >= 15));
  assert.equal(new Set(all.map(normalizeAnswer)).size, all.length);
  assert.notEqual(normalizeAnswer('año'), normalizeAnswer('ano'));
});

test('all levels stay within requested category and length ranges with no repeated word', () => {
  for (let level = 1; level <= 9; level++) {
    const config = LEVELS[level - 1];
    for (let seed = 1; seed <= 60; seed++) {
      const round = createRound(level, seeded(level * 1000 + seed));
      assert.equal(round.categories.length, config.categories);
      assert.ok(round.items.length >= config.minWords && round.items.length <= config.maxWords);
      assert.equal(round.exposureMs, config.exposureMs);
      assert.equal(new Set(round.items.map((item) => item.word)).size, round.items.length);
      const counts = round.categories.map((category) => round.items.filter((item) => item.category === category).length);
      assert.ok(counts.every((count) => count >= 2));
      assert.ok(new Set(counts).size > 1);
      round.items.forEach((item) => assert.ok(CORPUS[item.category].includes(item.word)));
    }
  }
  assert.equal(LEVELS[0].exposureMs, 2200);
  assert.equal(LEVELS[8].exposureMs, 650);
});

test('category order is mixed and final occurrences are not in a fixed category order', () => {
  const endings = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const round = createRound(9, seeded(seed));
    endings.add(round.items.at(-1).category);
    const latest = latestByCategory(round);
    round.categories.forEach((category) => {
      assert.equal(latest[category], round.items.filter((item) => item.category === category).at(-1).word);
    });
  }
  assert.ok(endings.size >= 4);
});

test('open answers normalize case, spaces and vowel accents without accepting other words', () => {
  const round = {
    level: 1, exposureMs: 2200, categories: ['ciudades', 'frutas'],
    items: [
      { category: 'ciudades', word: 'Madrid' },
      { category: 'frutas', word: 'pera' },
      { category: 'ciudades', word: 'Córdoba' },
      { category: 'frutas', word: 'plátano' }
    ]
  };
  assert.equal(normalizeAnswer('  CORDOBA  '), 'cordoba');
  const result = evaluateRound(round, { ciudades: '  CORDOBA  ', frutas: 'platano' }, 1);
  assert.equal(result.correctCount, 2);
  assert.deepEqual(result.rows.map((row) => row.expected), ['Córdoba', 'plátano']);
  assert.deepEqual(result.sequence, round.items);
  const wrong = evaluateRound(round, { ciudades: 'Córdova', frutas: 'pera' }, 2);
  assert.equal(wrong.correctCount, 0);
  assert.deepEqual(summarize([result, wrong]), { correct: 2, categories: 4, percentage: 50 });
});

test('state machine hides correction until all answers are submitted and ignores stale timer ticks', () => {
  const round = createRound(1, seeded(4));
  let state = reducer(INITIAL_STATE, { type: 'start', round });
  assert.equal(state.phase, 'prepare');
  assert.equal(reducer(state, { type: 'answer', category: round.categories[0], value: 'wrong' }).answers[round.categories[0]], undefined);
  state = reducer(state, { type: 'begin' });
  state = reducer(state, { type: 'pause' });
  assert.equal(reducer(state, { type: 'tick', round, itemIndex: 0 }).itemIndex, 0);
  state = reducer(state, { type: 'pause' });
  state = reducer(state, { type: 'tick', round, itemIndex: 0 });
  assert.equal(reducer(state, { type: 'tick', round, itemIndex: 0 }).itemIndex, 1);
  for (let index = 1; index < round.items.length; index++) state = reducer(state, { type: 'tick', round, itemIndex: index });
  assert.equal(state.phase, 'answer');
  assert.deepEqual(state.results, []);
  const latest = latestByCategory(round);
  round.categories.forEach((category) => { state = reducer(state, { type: 'answer', category, value: latest[category] }); });
  state = reducer(state, { type: 'submit' });
  assert.equal(state.phase, 'correct');
  assert.equal(state.results[0].correctCount, round.categories.length);
  assert.equal(reducer(state, { type: 'restart' }).phase, 'idle');
  assert.equal(reducer({ ...state, results: Array(SESSION_ROUNDS).fill(state.results[0]) }, { type: 'next' }).phase, 'finished');
});
