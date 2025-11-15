import assert from 'node:assert/strict';
import test from 'node:test';

import { titlePlain, bulletPlain, recPlain } from '../text.js';

test('titlePlain enforces fallback without blocked terms', () => {
  const title = titlePlain({ status: 'behind goal', driver: 'load drifts mildly' });
  const words = title.split(/\s+/);
  assert.ok(words.length <= 14);
  assert.ok(!/ACWR|SRI|HRV/.test(title));
});

test('bulletPlain composes two sentences', () => {
  const bullet = bulletPlain({ vsGoal: 'Sleep variance widened', action: 'Hold load until rhythm stabilises' });
  const parts = bullet.split('. ').filter(Boolean);
  assert.equal(parts.length, 2);
});

test('recPlain pads to four items and strips symbols', () => {
  const recs = recPlain(['Increase steps ≥10%', 'Protect bedtime—fixed lights out']);
  assert.ok(recs.length >= 4);
  assert.ok(recs.every(item => !/[≤≥%Δ∆]/.test(item)));
});
