import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardTransform, randomCardDistortion, NO_DISTORTION } from '../src/games/math/cardDistortions.ts';

test('all 75 mode combinations preserve fixed values and random bounds', () => {
  for (const size of ['normal', 'half', 'random']) {
    for (const rotation of ['normal', 'horizontal', 'upsideDown', 'horizontalOrUpsideDown', 'random']) {
      for (const perspective of ['none', 'horizontal', 'vertical', 'both', 'random']) {
        const options = { size, rotation, perspective };
        for (let i = 0; i < 30; i++) {
      const d = randomCardDistortion(options);
      assert.ok(d.scale >= 0.5 && d.scale <= 1);
      assert.ok(Math.abs(d.angle) <= 180);
      assert.ok(Math.abs(d.perspectiveX) + Math.abs(d.perspectiveY) <= 2 / 3 + 1e-12);
      if (size === 'normal') assert.equal(d.scale, 1);
      if (size === 'half') assert.equal(d.scale, 0.5);
      if (rotation === 'normal') assert.equal(d.angle, 0);
      if (rotation === 'horizontal') assert.equal(d.angle, 90);
      if (rotation === 'upsideDown') assert.equal(d.angle, 180);
      if (rotation === 'horizontalOrUpsideDown') assert.ok([90, 180, -90].includes(d.angle));
      const fixedPerspective = { none: [0, 0], horizontal: [2 / 3, 0], vertical: [0, 2 / 3], both: [1 / 3, 1 / 3] };
      if (perspective !== 'random') assert.deepEqual([d.perspectiveX, d.perspectiveY], fixedPerspective[perspective]);
      if (size === 'normal' && rotation === 'normal' && perspective === 'none') assert.deepEqual(d, NO_DISTORTION);
        }
      }
    }
  }
});

test('CSS projection keeps extreme corners centered and inside desktop and mobile stages', () => {
  for (const [stageW, stageH] of [[520, 350], [240, 300], [180, 140]]) {
    const width = Math.min(250, stageW, stageH / 1.4);
    const height = width * 1.4;
    for (const angle of [-180, -90, -45, 0, 45, 90, 180]) {
      for (const [p, q] of [[0, 0], [2 / 3, 0], [0, -2 / 3], [1 / 3, 1 / 3], [-1 / 3, 1 / 3]]) {
        for (const scale of [0.5, 1]) {
          const css = cardTransform({ scale, angle, perspectiveX: p, perspectiveY: q }, width, height, stageW, stageH);
          const match = css.match(/^translate\((.+)px, (.+)px\) scale\((.+)\) rotate\((.+)deg\) matrix3d\((.+)\)$/);
          assert.ok(match);
          const [, tx, ty, fit, degrees, matrix] = match;
          const m = matrix.split(',').map(Number);
          const theta = Number(degrees) * Math.PI / 180;
          const points = [];
          for (const x of [-width / 2, width / 2]) {
            for (const y of [-height / 2, height / 2]) {
              const w = m[3] * x + m[7] * y + m[15];
              assert.ok(w > 0);
              const px = (m[0] * x + m[4] * y + m[12]) / w;
              const py = (m[1] * x + m[5] * y + m[13]) / w;
              const finalX = Number(tx) + Number(fit) * (Math.cos(theta) * px - Math.sin(theta) * py);
              const finalY = Number(ty) + Number(fit) * (Math.sin(theta) * px + Math.cos(theta) * py);
              assert.ok(Math.abs(finalX) <= stageW / 2 + 1e-8);
              assert.ok(Math.abs(finalY) <= stageH / 2 + 1e-8);
              points.push([finalX, finalY]);
            }
          }
          for (const axis of [0, 1]) {
            assert.ok(Math.abs(Math.min(...points.map(p => p[axis])) + Math.max(...points.map(p => p[axis]))) < 1e-8);
          }
        }
      }
    }
  }
});
