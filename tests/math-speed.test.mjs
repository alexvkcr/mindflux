import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPEED_LEVELS, levelToIntervalMs, levelToCount } from '../src/games/math/utils.ts';

test('math speeds preserve the first seven levels and interpolate the new levels', () => {
  assert.deepEqual(SPEED_LEVELS.map(levelToIntervalMs), [2000, 1769, 1538, 1306, 1075, 844, 613, 536, 458, 381, 323, 266, 208, 150]);
  assert.equal(levelToIntervalMs(0), 2000);
  assert.equal(levelToIntervalMs(15), 150);
  assert.equal(levelToCount(9), 50);
  assert.equal(levelToCount(14), 50);
});
