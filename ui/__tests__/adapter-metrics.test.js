import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptMetrics } from '../adapter-metrics.js';
import { UI_MODE } from '../../config/ui.js';

const rawFixture = {
  metric: 'ACWR',
  label: 'ACWR',
  detail: 'Some detail',
  tooltip: { text: 'Original' },
  children: [
    { metric: 'SRI', label: 'SRI' },
    { metric: 'Steps', label: 'Steps' }
  ]
};

test('returns raw metrics when not in plain mode', () => {
  const adapted = adaptMetrics({ uiMode: UI_MODE.TECHNICAL, raw: rawFixture });
  assert.equal(adapted, rawFixture); // ensures no cloning when skipping
});

test('relabels metrics in plain mode using LABELS_PLAIN', () => {
  const adapted = adaptMetrics({ uiMode: UI_MODE.PLAIN, raw: rawFixture });
  assert.notEqual(adapted, rawFixture);
  assert.equal(adapted.label, 'Weekly workload balance');
  assert.equal(adapted.tooltip.text, '1.0 means matching the four-week average; above 1.2 signals higher-than-normal load.');
  assert.equal(adapted.children[0].label, 'Sleep rhythm score');
  assert.equal(adapted.children[1].label, 'Daily steps trend');
});

