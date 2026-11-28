import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORDS_BY_SYLLABLES, SYLLABLE_COUNTS, WORDS, CHANGE_KINDS, CHALLENGES, EXPOSURE_MS, SESSION_LENGTHS, WORD_DISTANCES, DEFAULT_CONFIG, createDifferent, createSession, evaluate, summarize, transformWord } from '../src/games/campo-visual/WordDiscrimination/stimuli.ts';

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

test('curated corpus contains at least 40 unique normalized words per syllable count', () => {
  assert.equal(new Set(WORDS).size, WORDS.length);
  for (const count of SYLLABLE_COUNTS) {
    const pool = WORDS_BY_SYLLABLES[count];
    assert.ok(pool.length >= 40, String(count));
    pool.forEach(word => assert.equal(word, word.normalize('NFC')));
  }
});

test('exposures, lengths, distances and defaults match independent settings', () => {
  assert.deepEqual(EXPOSURE_MS, [1600,1400,1200,1000,850,700,650,600,550,500,450,400,350,325,300,290,280,270,260,250]);
  assert.deepEqual(SESSION_LENGTHS, [10,20,30,40]);
  assert.deepEqual(WORD_DISTANCES, [8,16,32,64,96]);
  assert.deepEqual(DEFAULT_CONFIG, { exposureMs:1600, comparisons:10, syllables:3, challenge:'all', distance:32 });
});

test('all seven individual transformations change every corpus word', () => {
  for (const word of WORDS) for (const kind of CHANGE_KINDS) {
    const changed = transformWord(word, kind, seeded(5));
    assert.notEqual(changed, word, word + ' ' + kind);
    assert.equal(changed, changed.normalize('NFC'));
    if (kind === 'insertion') assert.equal(changed.length, word.length + 1);
    else if (kind === 'deletion') assert.equal(changed.length, word.length - 1);
    else {
      assert.equal(changed.length, word.length);
      const differences = [...word].filter((letter, i) => letter !== changed[i]).length;
      assert.equal(differences, ['double','transposition'].includes(kind) ? 2 : 1);
      if (kind === 'transposition') assert.equal([...word].sort().join(''), [...changed].sort().join(''));
      if (kind === 'accent') assert.equal(word.normalize('NFD').replace(/\u0301/g,''), changed.normalize('NFD').replace(/\u0301/g,''));
    }
    const pair = createDifferent(word, kind, seeded(6));
    assert.deepEqual(pair.changes, [kind]);
    assert.notEqual(pair.left, pair.right);
    assert.ok(['left', 'right'].includes(pair.alteredSide));
    assert.equal(pair.alteredSide === 'left' ? pair.right : pair.left, word);
  }
});

test('all challenge contains every single transformation and mixes distinct changes including substitution plus transposition', () => {
  const random = seeded(42);
  const singles = new Set();
  let mixed = 0, substitutionAndTransposition = 0;
  for (let i = 0; i < 3000; i++) {
    const pair = createDifferent('camino', 'all', random);
    assert.notEqual(pair.left, pair.right);
    if (pair.change === 'mixed') {
      mixed++;
      assert.equal(new Set(pair.changes).size, 2);
      if (pair.changes.includes('substitution') && pair.changes.includes('transposition')) substitutionAndTransposition++;
    } else singles.add(pair.change);
  }
  assert.deepEqual([...singles].sort(), [...CHANGE_KINDS].sort());
  assert.ok(mixed > 0);
  assert.ok(substitutionAndTransposition > 0);
});

test('every challenge randomly places the alteration on either side', () => {
  for (const challenge of CHALLENGES) {
    const random = seeded(80);
    let left = 0;
    for (let i = 0; i < 1000; i++) {
      const pair = createDifferent('camino', challenge, random);
      assert.notEqual(pair.left, pair.right);
      assert.equal(pair.alteredSide === 'left' ? pair.right : pair.left, 'camino');
      if (pair.alteredSide === 'left') left++;
    }
    assert.ok(left > 400 && left < 600, challenge + ': ' + left);
  }
});

test('sessions are balanced with no repeated base words across all configuration combinations', () => {
  for (const syllables of SYLLABLE_COUNTS) for (const comparisons of SESSION_LENGTHS) for (const challenge of CHALLENGES) {
    const config = { ...DEFAULT_CONFIG, syllables, comparisons, challenge };
    const rounds = createSession(config, seeded(syllables * 100 + comparisons));
    assert.equal(rounds.length, comparisons);
    assert.equal(rounds.filter(round => round.answer === 'same').length, comparisons / 2);
    assert.equal(new Set(rounds.map(round => round.alteredSide === 'left' ? round.right : round.left)).size, comparisons);
    for (const round of rounds) {
      const original = round.alteredSide === 'left' ? round.right : round.left;
      assert.ok(WORDS_BY_SYLLABLES[syllables].includes(original));
      assert.equal(round.alteredSide === null, round.answer === 'same');
      assert.equal(round.left === round.right, round.answer === 'same');
      if (round.answer === 'different' && challenge !== 'all') assert.deepEqual(round.changes, [challenge]);
    }
  }
});
test('exposure and separation do not change generated stimuli', () => {
  const first = createSession(DEFAULT_CONFIG, seeded(123));
  for (const exposureMs of EXPOSURE_MS) for (const distance of WORD_DISTANCES) {
    assert.deepEqual(createSession({ ...DEFAULT_CONFIG, exposureMs, distance }, seeded(123)), first);
  }
});
test('evaluation keeps both error types separate and reveals missed pairs', () => {
  const same = { left:'casa', right:'casa', answer:'same', change:null, changes:[], alteredSide:null };
  const different = createDifferent('camino', 'substitution', seeded(8));
  const results = [evaluate(same,'different'), evaluate(different,'same'), evaluate(same,'same')];
  assert.deepEqual(summarize(results), { hits:1, differentAsSame:1, sameAsDifferent:1, accuracy:33, misses:results.slice(0,2) });
});
