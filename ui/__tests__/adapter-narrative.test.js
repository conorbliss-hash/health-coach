import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptNarrative } from '../adapter-narrative.js';
import { UI_MODE } from '../../config/ui.js';

const baseDraft = {
  sections: {
    activity: { title: 'Old Title', status: 'on goal', driver: 'load in range', bullets: ['Workload: stable — Hold plan.'] },
    recovery: { status: 'behind goal', driver: 'sleep inconsistent', bullets: [{ vsGoal: 'Sleep short', action: 'Hold load' }] },
    readiness: { status: 'ahead of goal', bullets: [] }
  },
  recommendations: [
    'Protect sleep routine with fixed lights-out',
    'Increase steps by 10% vs last week'
  ]
};

test('returns draft untouched when not in plain mode', () => {
  const adapted = adaptNarrative({ uiMode: UI_MODE.TECHNICAL, draft: baseDraft });
  assert.equal(adapted, baseDraft);
});

test('adapts titles, bullets, and recommendations in plain mode', () => {
  const adapted = adaptNarrative({ uiMode: UI_MODE.PLAIN, draft: baseDraft });
  assert.notEqual(adapted, baseDraft);
  const { sections, recommendations } = adapted;

  assert.equal(sections.activity.title.split(' ').length <= 14, true);
  assert.equal(sections.recovery.bullets.every(line => line.includes('. ')), true);
  assert.equal(recommendations.length >= 4, true);
  assert.equal(recommendations.length <= 5, true);
});
