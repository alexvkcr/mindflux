import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeCardBitmaps, loadCardBitmaps } from '../src/games/math/cardBitmaps.ts';

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const bitmap = () => ({ closed: 0, close() { this.closed++; } });

test('blocks of 5 and 50 share repeated cards and never exceed four active loads', async () => {
  for (const size of [5, 50]) {
    let active = 0;
    let maximum = 0;
    const calls = [];
    const progress = [];
    const cards = Array.from({ length: size }, (_, i) => String(i % 13));
    const resources = await loadCardBitmaps(cards, c => c, new AbortController().signal,
      (loaded, total) => progress.push([loaded, total]), {
        async fetchImage(url) {
          calls.push(url);
          active++;
          maximum = Math.max(maximum, active);
          await new Promise(resolve => setTimeout(resolve, 1));
          return new Blob();
        },
        async decode() { active--; return bitmap(); }
      });
    assert.equal(calls.length, new Set(cards).size);
    assert.ok(maximum <= 4);
    assert.deepEqual(progress.at(-1), [resources.size, resources.size]);
    const values = [...resources.values()];
    closeCardBitmaps(resources);
    closeCardBitmaps(resources);
    assert.equal(resources.size, 0);
    values.forEach(value => assert.equal(value.closed, 1));
  }
});

test('a downloaded image is not ready until decoding completes', async () => {
  const decoding = deferred();
  let ready = false;
  const result = loadCardBitmaps(['A'], c => c, new AbortController().signal, () => {}, {
    fetchImage: async () => new Blob(), decode: () => decoding.promise
  }).then(value => { ready = true; return value; });
  await Promise.resolve();
  assert.equal(ready, false);
  decoding.resolve(bitmap());
  closeCardBitmaps(await result);
});

test('stopping during decoding closes late results without reporting them ready', async () => {
  const controller = new AbortController();
  const decoding = deferred();
  const started = deferred();
  const resource = bitmap();
  const progress = [];
  const result = loadCardBitmaps(['A'], c => c, controller.signal, n => progress.push(n), {
    fetchImage: async () => new Blob(),
    decode() { started.resolve(); return decoding.promise; }
  });
  const rejection = assert.rejects(result, { name: 'AbortError' });
  await started.promise;
  controller.abort();
  decoding.resolve(resource);
  await rejection;
  assert.equal(resource.closed, 1);
  assert.deepEqual(progress, [0]);
});

test('failure cancels siblings, closes partial results and permits a clean retry', async () => {
  const created = [];
  const requests = [];
  await assert.rejects(loadCardBitmaps(['A', 'B', 'C', 'D', 'E'], c => c, new AbortController().signal, () => {}, {
    async fetchImage(url, signal) {
      requests.push(signal);
      if (url === 'E') throw new Error('offline');
      return new Blob();
    },
    async decode() { const value = bitmap(); created.push(value); return value; }
  }), /offline/);
  created.forEach(value => assert.equal(value.closed, 1));
  assert.ok(requests.every(signal => signal.aborted));
  const retry = await loadCardBitmaps(['A', 'B', 'C', 'D', 'E'], c => c, new AbortController().signal, () => {}, {
    fetchImage: async () => new Blob(), decode: async () => bitmap()
  });
  assert.equal(retry.size, 5);
  closeCardBitmaps(retry);
});

test('already cancelled jobs do not fetch or decode', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadCardBitmaps(['A'], c => c, controller.signal, () => {}, {
    fetchImage: () => assert.fail('unexpected download'), decode: () => assert.fail('unexpected decode')
  }), { name: 'AbortError' });
});
