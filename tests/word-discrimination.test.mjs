import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORDS, createDifferent, createSession, evaluate, exposureForLevel, summarize, transformWord } from '../src/games/campo-visual/WordDiscrimination/stimuli.ts';

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

test('corpus is local, varied, unique and normalized', () => {
  assert.ok(WORDS.length >= 100);
  assert.equal(new Set(WORDS).size, WORDS.length);
  assert.ok(WORDS.some((word) => word.length <= 5));
  assert.ok(WORDS.some((word) => word.length >= 12));
  WORDS.forEach((word) => assert.equal(word, word.normalize('NFC')));
});

test('each transformation really changes the displayed string', () => {
  for (const kind of ['substitution', 'transposition', 'insertion', 'deletion', 'accent']) {
    const source = 'camino';
    const changed = transformWord(source, kind, 4, seeded(5));
    assert.notEqual(changed, source, kind);
    assert.equal(changed, changed.normalize('NFC'));
  }
  assert.equal(transformWord('canto', 'transposition', 9, () => 0).length, 5);
  assert.notEqual(transformWord('canto', 'transposition', 9, () => 0), 'canto');
});

test('early double changes affect two distinct positions', () => {
  const pair = createDifferent('camino', 1, () => 0);
  assert.equal(pair.change, 'double');
  assert.equal([...pair.left].filter((letter, i) => letter !== pair.right[i]).length, 2);
});

test('sessions have exact halves and limited word reuse at every level', () => {
  for (let level = 1; level <= 9; level++) {
    for (const length of [20, 40, 60]) {
      const rounds = createSession(level, length, seeded(level * 100 + length));
      assert.equal(rounds.length, length);
      assert.equal(rounds.filter((round) => round.answer === 'same').length, length / 2);
      assert.equal(rounds.filter((round) => round.answer === 'different').length, length / 2);
      assert.ok(new Set(rounds.map((round) => round.left)).size >= Math.min(20, length));
      rounds.forEach((round) => {
        assert.equal(round.left === round.right, round.answer === 'same');
        assert.equal(round.left, round.left.normalize('NFC'));
        assert.equal(round.right, round.right.normalize('NFC'));
        if (level >= 7) {
          assert.equal(round.left.length, round.right.length);
          if (round.answer === 'different' && round.change !== 'accent') {
            assert.equal(round.left[0], round.right[0]);
            assert.equal(round.left.at(-1), round.right.at(-1));
          }
        }
      });
    }
  }
});

test('levels shorten exposure and increase word length', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => exposureForLevel(i + 1)), [2000, 1600, 1200, 1000, 850, 700, 600, 500, 400]);
  assert.ok(createSession(1, 20, seeded(1)).every((round) => round.left.length <= 6));
  assert.ok(createSession(5, 20, seeded(1)).every((round) => round.left.length >= 6 && round.left.length <= 9));
  assert.ok(createSession(9, 20, seeded(1)).every((round) => round.left.length >= 10));
});

test('evaluation keeps both error types separate and reveals missed pairs', () => {
  const same = { left: 'casa', right: 'casa', answer: 'same', change: null };
  const different = createDifferent('camino', 4, seeded(8));
  const results = [evaluate(same, 'different'), evaluate(different, 'same'), evaluate(same, 'same')];
  assert.deepEqual(summarize(results), {
    hits: 1,
    differentAsSame: 1,
    sameAsDifferent: 1,
    accuracy: 33,
    misses: results.slice(0, 2)
  });
});
