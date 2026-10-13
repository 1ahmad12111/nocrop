import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitRect, coverRect, closestRatio, getRatio } from '../app/layout.js';

test('fitRect letterboxes a landscape photo in a square without cropping', () => {
  const r = fitRect(4000, 3000, 1080, 1080);
  assert.equal(r.w, 1080);
  assert.equal(r.h, 810);
  assert.equal(r.x, 0);
  assert.equal(r.y, 135);
});

test('fitRect pillarboxes a portrait photo in a landscape frame', () => {
  const r = fitRect(1080, 1920, 1920, 1080);
  assert.equal(r.h, 1080);
  assert.ok(Math.abs(r.w - 607.5) < 1e-9);
  assert.ok(Math.abs(r.x - (1920 - 607.5) / 2) < 1e-9);
});

test('fitRect scale shrinks and offsets move within free space', () => {
  const r = fitRect(1000, 1000, 1000, 1000, { scale: 0.5, offsetX: -1, offsetY: 1 });
  assert.deepEqual(r, { x: 0, y: 500, w: 500, h: 500 });
});

test('fitRect clamps out-of-range options', () => {
  const r = fitRect(1000, 1000, 1000, 1000, { scale: 5, offsetX: 9 });
  assert.deepEqual(r, { x: 0, y: 0, w: 1000, h: 1000 });
});

test('coverRect fills the frame', () => {
  const r = coverRect(4000, 3000, 1080, 1080);
  assert.equal(r.h, 1080);
  assert.equal(r.w, 1440);
  assert.equal(r.x, -180);
});

test('closestRatio and getRatio', () => {
  assert.equal(closestRatio(1080, 1920).id, '9:16');
  assert.equal(closestRatio(1200, 1200).id, '1:1');
  assert.equal(closestRatio(1920, 1080).id, '16:9');
  assert.equal(getRatio('nope').id, '1:1');
});

test('fitRect rejects empty sources', () => {
  assert.throws(() => fitRect(0, 10, 100, 100), RangeError);
});
