import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildShoe, createCardDealer, getCardImageSrc, getCardValue } from '../src/games/math/hiLoCards.ts';
import { DEFAULT_TABLE_CONFIG, EXPOSURE_OPTIONS, GAP_OPTIONS, SEATS, layoutTable, normalizeTableCount,
  parseHiLoAnswer, planTableRounds, scoreTableRound, toggleSeat } from '../src/games/math/hiLoTable.ts';
import { createTableSession } from '../src/games/math/hiLoTableSession.ts';

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness(patch = {}, overrides = {}) {
  const config = { ...DEFAULT_TABLE_CONFIG, seats: ['bottom'], handSize: 2, rounds: 2, exposureMs: 200, gapMs: 500, ...patch };
  let now = 0, id = 0, finished = 0;
  const tasks = new Map(), history = [], resources = [], loads = [];
  let current;
  const schedule = (callback, ms) => { tasks.set(++id, { callback, at: now + ms }); return id; };
  const session = createTableSession(config, view => {
    current = view;
    history.push({ ...view, time: now });
  }, () => finished++, {
    draw: () => '2♠', timeout: schedule, clearTimeout: id => tasks.delete(id),
    frame: callback => schedule(callback, 16), cancelFrame: id => tasks.delete(id),
    load: async (cards, signal, progress) => {
      loads.push([...cards]);
      signal.throwIfAborted();
      const map = new Map([...new Set(cards)].map(card => {
        const image = { closed: 0, close() { this.closed++; } };
        resources.push(image);
        return [card, image];
      }));
      progress(map.size, map.size);
      return map;
    }, ...overrides
  });
  return { session, history, resources, loads, tasks, get view() { return current; }, get finished() { return finished; },
    async advance(ms) {
      await settle();
      const target = now + ms;
      while (true) {
        const next = [...tasks.entries()].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        tasks.delete(next[0]); now = next[1].at; next[1].callback(); await settle();
      }
      now = target; await settle();
    }
  };
}

test('shared cards retain Hi-Lo scoring, all 52 image paths, shoe balance and exhaustion', () => {
  assert.deepEqual(['A', '2', '6', '7', '9', '10', 'J', 'Q', 'K'].map(getCardValue), [-1, 1, 1, 0, 0, -1, -1, -1, -1]);
  const shoe = buildShoe(1);
  assert.equal(new Set(shoe).size, 52);
  assert.equal(shoe.reduce((sum, card) => sum + getCardValue(card.slice(0, -1)), 0), 0);
  assert.equal(buildShoe(18).length, 936);
  for (const card of shoe) assert.match(getCardImageSrc(card, '/mindflux/'), /^\/mindflux\/assets\/cards-game\/(A|[2-9]|10|J|Q|K)-(clubs|diamonds|hearts|spades)\.png$/);
  const draw = createCardDealer(1, () => 0.25);
  for (let i = 0; i < 3; i++) assert.equal(new Set(Array.from({ length: 52 }, draw)).size, 52);
});

test('selectors clamp edits, answer validation distinguishes empty from zero, final seat stays active', () => {
  for (const [draft, expected] of [['', 4], ['abc', 4], ['0', 1], ['11', 10], ['3.7', 4], ['2', 2]]) assert.equal(normalizeTableCount(draft, 4), expected);
  for (const invalid of ['', ' ', '1.5', 'NaN', 'Infinity', '1e2', '9007199254740992']) assert.equal(parseHiLoAnswer(invalid), null);
  for (const [draft, value] of [['0', 0], ['-5', -5], ['+10', 10], [' 2 ', 2]]) assert.equal(parseHiLoAnswer(draft), value);
  assert.deepEqual(toggleSeat(['top'], 'top'), ['top']);
  assert.deepEqual(toggleSeat(['top'], 'bottom'), ['bottom', 'top']);
  assert.deepEqual(EXPOSURE_OPTIONS, [200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]);
  assert.deepEqual(GAP_OPTIONS, [500, 1000, 1500, 2000]);
});

test('all seat combinations and 1–10 hands fit without inter-hand intersections on desktop/mobile', () => {
  for (const [width, height] of [[240, 520], [320, 520], [620, 640], [900, 640]]) {
    for (let mask = 1; mask < 16; mask++) {
      const seats = SEATS.filter((_, index) => mask & (1 << index)).map(seat => seat.id);
      for (let size = 1; size <= 10; size++) {
        const placements = layoutTable(width, height, size, seats);
        assert.equal(placements.length, size * seats.length);
        const bounds = new Map();
        for (const p of placements) {
          const sideways = p.angle === 90 || p.angle === 270;
          const w = sideways ? p.height : p.width, h = sideways ? p.width : p.height;
          const b = [p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2];
          assert.ok(b[0] >= 0 && b[1] >= 0 && b[2] <= width && b[3] <= height);
          const previous = bounds.get(p.seat) ?? b;
          bounds.set(p.seat, [Math.min(previous[0], b[0]), Math.min(previous[1], b[1]), Math.max(previous[2], b[2]), Math.max(previous[3], b[3])]);
        }
        const boxes = [...bounds.values()];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          assert.ok(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
        }
      }
    }
  }
});

test('maximum tanda contains 400 cards across 10 tables with scores independent of planning', () => {
  const rounds = planTableRounds({ ...DEFAULT_TABLE_CONFIG, rounds: 10, handSize: 10 }, () => '2♠');
  assert.equal(rounds.length, 10);
  assert.equal(rounds.flatMap(round => round.flatMap(hand => hand.cards)).length, 400);
  assert.deepEqual(rounds.map(scoreTableRound), Array(10).fill(40));
});

test('exposure starts after frame, gap hides cards, last round goes directly to answer, continuation accumulates', async () => {
  const h = harness(); h.session.start(); await h.advance(4000);
  const shows = h.history.filter(view => view.phase === 'show');
  assert.deepEqual(shows.map(view => view.time), [3016, 3732]);
  assert.equal(h.history.find(view => view.phase === 'gap').time, 3216);
  assert.equal(h.history.find(view => view.phase === 'answer').time, 3932);
  assert.equal(h.resources[0].closed, 1);
  assert.equal(h.loads.length, 2, 'next tanda prepared during answer');
  assert.equal(h.session.answer('', false), false);
  assert.equal(h.view.phase, 'answer');
  assert.equal(h.session.answer('999', false), true);
  assert.equal(h.view.phase, 'result');
  assert.match(h.view.feedback, /Cuenta correcta: 4/);
  await h.advance(4999);
  assert.equal(h.view.phase, 'result', 'result remains visible for all five seconds');
  await h.advance(1001);
  assert.equal(h.view.phase, 'countdown');
  await h.advance(5000);
  assert.equal(h.view.phase, 'answer');
  assert.equal(h.session.answer('8', true), true);
  assert.equal(h.view.phase, 'result');
  assert.match(h.view.feedback, /Correcto/);
  await h.advance(5000);
  assert.equal(h.view.phase, 'ended');
  assert.equal(h.finished, 1);
  assert.ok(h.resources.every(image => image.closed === 1));
  h.session.dispose();
});

test('No lo sé reveals without ending; manual continuation preserves the count', async () => {
  const h = harness({ rounds: 1 }); h.session.start(); await h.advance(3300);
  h.session.giveUp(); assert.equal(h.view.phase, 'revealed'); assert.match(h.view.feedback, /es 2/);
  await h.advance(20000); assert.equal(h.view.phase, 'revealed'); assert.equal(h.finished, 0);
  h.session.continue(); await h.advance(5300);
  h.session.answer('4', true); assert.match(h.view.feedback, /Correcto/); assert.equal(h.view.phase, 'result');
  await h.advance(5000); assert.equal(h.view.phase, 'ended'); h.session.dispose();
});

test('minimum and maximum exposure/pause values are never shortened', async () => {
  for (const exposureMs of [200, 10000]) for (const gapMs of GAP_OPTIONS) {
    const h = harness({ exposureMs, gapMs }); h.session.start();
    await h.advance(3000 + 32 + exposureMs * 2 + gapMs);
    const shows = h.history.filter(view => view.phase === 'show');
    assert.equal(shows[1].time - shows[0].time, exposureMs + gapMs + 16);
    assert.equal(h.view.phase, 'answer'); h.session.dispose();
  }
});

test('preparation gates countdown; dispose closes late bitmaps and prevents any presentation', async () => {
  let resolveLoad;
  const image = { closed: 0, close() { this.closed++; } };
  const h = harness({}, { load: () => new Promise(resolve => { resolveLoad = resolve; }) });
  h.session.start(); await h.advance(10000); assert.equal(h.view.phase, 'preparing');
  h.session.dispose(); resolveLoad(new Map([['2♠', image]])); await settle();
  assert.equal(image.closed, 1); assert.equal(h.tasks.size, 0);
  assert.equal(h.history.filter(view => view.phase === 'show').length, 0);
});

test('load failure retries exactly the planned cards, including background failure', async () => {
  const attempts = []; let drawn = 0;
  const h = harness({ rounds: 1 }, {
    draw: () => `${++drawn}♠`,
    load: async cards => {
      attempts.push([...cards]);
      if (attempts.length === 1 || attempts.length === 3) throw Error('offline');
      return new Map(cards.map(card => [card, { close() {} }]));
    }
  });
  h.session.start(); await settle(); assert.equal(h.view.phase, 'loadError');
  h.session.retry(); await h.advance(3300);
  assert.deepEqual(attempts[0], attempts[1]); assert.equal(h.view.phase, 'answer'); assert.equal(h.view.loadError, true);
  h.session.answer('0', false); await h.advance(5000); assert.equal(h.view.phase, 'loadError');
  h.session.retry(); await h.advance(5300);
  assert.deepEqual(attempts[2], attempts[3]); assert.equal(h.view.phase, 'answer');
  h.session.dispose();
});

test('stopping in countdown, showing or gap cancels all remaining rounds and frees resources', async () => {
  for (const stopAt of [1000, 3100, 3500]) {
    const h = harness(); h.session.start(); await h.advance(stopAt);
    h.session.dispose(); const numberOfUpdates = h.history.length;
    await h.advance(30000);
    assert.equal(h.history.length, numberOfUpdates); assert.equal(h.tasks.size, 0);
    assert.ok(h.resources.every(image => image.closed === 1));
  }
});
