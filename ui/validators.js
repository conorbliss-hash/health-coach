export const BLOCKED = /\b(ACWR|HRV|SRI|SD)\b|[%\u2264\u2265\u2206\u0394]/i;

export function isPlainSafeTitle(value) {
  if (!value) return false;
  if (BLOCKED.test(value)) return false;
  const words = String(value).trim().split(/\s+/);
  return words.length >= 10 && words.length <= 14;
}

export function trimWordsTo(value, max = 14) {
  const words = String(value || '').trim().split(/\s+/);
  return words.slice(0, max).join(' ');
}
