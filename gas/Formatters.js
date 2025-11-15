// ==== Formatters.gs ====
// Number, time, date, and value formatting utilities

// --- Date formatting ---
function formatDateIso_(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Time formatting ---
function fmtDurationMinutes_(minutes, fallback = '—') {
  if (minutes == null || isNaN(minutes)) return fallback;
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (!h) return `${rem}m`;
  if (!rem) return `${h}h`;
  return `${h}h ${rem}m`;
}

function formatMinutesToHours(totalMinutes) {
  if (totalMinutes == null || isNaN(totalMinutes)) return '—';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0 && m === 0) return '0h';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// --- Step formatting ---
function fmtSteps_(steps) {
  if (steps == null || isNaN(steps)) return '—';
  const value = Number(steps);
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(value)}`;
}

function fmtStepsDelta_(steps) {
  if (steps == null || isNaN(steps)) return '0';
  const thousands = steps / 1000;
  if (Math.abs(thousands) >= 1) return `${Math.abs(thousands).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(Math.abs(steps))}`;
}

// --- Metric formatting (from Data.js, re-exported) ---
function fmtInt(n) {
  if (n == null || isNaN(n)) return '0';
  return Math.round(n).toString();
}

function fmtBpm(n) {
  if (n == null || isNaN(n)) return '—';
  return `${Math.round(n)} bpm`;
}

// --- Specialized formatters ---
function fmtAcwr(value) {
  if (value == null || !isFinite(value)) return '—';
  return value.toFixed(2);
}

function fmtFulfilment(value) {
  if (value == null || isNaN(value)) return '—';
  return `${Math.round(Math.max(0, Math.min(130, value)))}%`;
}

// --- Percent formatting ---
function formatPercentValue_(pct) {
  if (pct == null || !isFinite(pct)) return '—';
  return `${Math.round(pct)}%`;
}

function formatPercentDelta_(pct) {
  if (pct == null || !isFinite(pct)) return '—';
  const value = Math.round(pct);
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

function formatTrendArrow_(trend) {
  if (trend == null || !isFinite(trend)) return '→ 0%';
  const rounded = Math.round(trend);
  if (rounded === 0) return '→ 0%';
  const arrow = rounded > 0 ? '↑' : '↓';
  const sign = rounded > 0 ? '+' : '';
  return `${arrow} ${sign}${rounded}%`;
}

function appendTrendCue_(text, trend) {
  if (!text) return '';
  if (trend == null || !isFinite(trend)) return text;
  if (trend > 3) return `${text} (improving)`;
  if (trend < -3) return `${text} (sliding)`;
  return text;
}

// --- Compliance & headline formatting ---
function formatFloorCompliance_(actual, target) {
  if (actual == null || target == null || !isFinite(actual) || !isFinite(target) || target <= 0) return '—';
  const pct = Math.round((Math.max(0, Math.min(actual, target)) / target) * 100);
  return `${Math.round(actual)}/${Math.round(target)} (${pct}%)`;
}

function formatPercentHeadline_(label, pct) {
  if (pct == null || !isFinite(pct)) return '—';
  return `${label} ${Math.round(pct)}%`;
}

// --- Generic value formatting ---
function formatValue_(value, { units, decimals = 1 } = {}) {
  if (value == null || !isFinite(value)) return '—';
  switch (units) {
    case 'minutes':
      return fmtDurationMinutes_(value);
    case 'hours':
      return `${value.toFixed(decimals)}h`;
    case 'kg':
      return `${fmtInt(value)}kg`;
    case 'steps':
      return fmtSteps_(value);
    case 'steps-diff':
      return fmtStepsDelta_(value);
    case 'bpm':
      return fmtBpm(value);
    case 'ratio':
      return value.toFixed(decimals);
    default:
      return decimals != null ? value.toFixed(decimals) : String(value);
  }
}

// --- Delta arrow (comparative formatting) ---
function formatDeltaArrow(current, baseline, options = {}) {
  if (current == null || baseline == null || !isFinite(current) || !isFinite(baseline)) return '—';
  const { formatter, positiveIsGood = true } = options;
  const delta = current - baseline;
  if (delta === 0) return formatter ? formatter(current) : '→';
  const arrow = (delta > 0) === positiveIsGood ? '↑' : '↓';
  const formatted = formatter ? formatter(Math.abs(delta)) : Math.abs(delta);
  return `${arrow} ${formatted}`;
}

function fmtDeltaArrow_(current, baseline, formatter) {
  return formatDeltaArrow(current, baseline, { formatter });
}

// --- Null-safe formatting ---
function formatOrDash_(value, formatter) {
  if (value == null || value === '' || (typeof value === 'number' && !isFinite(value))) return '—';
  return formatter ? formatter(value) : value;
}

// --- Natural language ---
function formatList(items) {
  if (!items || !items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function bulletListHtml(items) {
  if (!items || !items.length) return '';
  return `<ul>${items.map(item => `<li>${escapeHtml_(item)}</li>`).join('')}</ul>`;
}

// --- Clamping ---
function clamp01_(value) {
  if (value == null || !isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pctClamp_(value) {
  if (value == null || !isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

// --- Percent of goal calculations ---
function pctOfGoal_(value, goal) {
  if (value == null || goal == null || !isFinite(value) || !isFinite(goal) || goal === 0) return null;
  return Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
}

function pctOfGoal(value, goal) {
  return pctOfGoal_(value, goal);
}

function pctOfGoalUnlimited_(value, goal) {
  if (value == null || goal == null || !isFinite(value) || !isFinite(goal) || goal === 0) return null;
  return Math.round((value / goal) * 100);
}

// --- Trend comparisons ---
function pctVs4Week_(current, average) {
  if (current == null || average == null || !isFinite(current) || !isFinite(average) || average === 0) return null;
  return Math.round(((current - average) / average) * 100);
}

function pctVs4w(current, fourWeek) {
  return pctVs4Week_(current, fourWeek);
}
