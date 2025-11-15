import { isPlainSafeTitle, trimWordsTo } from './validators.js';

export function titlePlain({ status, driver }) {
  const lead = (status || 'on goal').replace(/^\w/, c => c.toUpperCase());
  const draft = `${lead} - ${driver || 'focus on core habits'}`;
  const safe = trimWordsTo(draft, 14);
  return isPlainSafeTitle(safe) ? safe : trimWordsTo(`${lead} - steady this week`, 14);
}

export function bulletPlain({ vsGoal, action }) {
  const a = (vsGoal || '').toString().replace(/\s+/g, ' ').trim();
  const b = (action || '').toString().replace(/\s+/g, ' ').trim();
  const first = a.endsWith('.') || !a ? (a || 'Status needs review.') : `${a}.`;
  const second = b.endsWith('.') || !b ? (b || 'Take the simplest next step.') : `${b}.`;
  return `${first} ${second}`.trim();
}

export function recPlain(list) {
  const cleaned = (list || [])
    .map(item => String(item || '').replace(/[%\u2264\u2265\u2206\u0394]/g, '').trim())
    .filter(Boolean)
    .map(entry => trimWordsTo(entry, 14));
  const limited = cleaned.slice(0, 5);
  if (limited.length >= 4) return limited;
  const padding = Array(4 - limited.length).fill('Keep core habits steady');
  return limited.concat(padding);
}
