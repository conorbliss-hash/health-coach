import assert from 'node:assert/strict';
import test from 'node:test';

import { isPlainSafeTitle, trimWordsTo, BLOCKED } from '../validators.js';

test('isPlainSafeTitle enforces length and blocks acronyms', () => {
  assert.equal(isPlainSafeTitle('This title has more than ten words and no blocked terms'), true);
  assert.equal(isPlainSafeTitle('Too short'), false);
  assert.equal(isPlainSafeTitle('This uses ACWR and should fail due to rules'), false);
});

test('trimWordsTo caps words', () => {
  const trimmed = trimWordsTo('one two three four five', 3);
  assert.equal(trimmed, 'one two three');
});

test('blocked regex catches symbols', () => {
  assert.ok(BLOCKED.test('avoid ≥ symbol'));
});
