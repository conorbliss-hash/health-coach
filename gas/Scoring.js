// ==== Scoring.gs ====
// Score computation, grade assignment, band classification

// --- Grade & band assignment ---
function gradeFromScore_(score) {
  if (score == null || !isFinite(score)) return { grade: '—', band: 'neutral' };
  const n = Math.max(0, Math.min(100, Math.round(score)));
  const thresholds = [
    [95, 'A+'], [90, 'A'], [85, 'A-'],
    [80, 'B+'], [75, 'B'], [70, 'B-'],
    [65, 'C+'], [60, 'C'], [55, 'C-'],
    [45, 'D'], [0, 'F']
  ];
  let grade = 'F';
  for (const [cut, letter] of thresholds) {
    if (n >= cut) { grade = letter; break; }
  }
  let band = 'danger';
  if (n >= 85) band = 'success';
  else if (n >= 70) band = 'warning';
  else if (n >= 45) band = 'danger';
  else band = 'danger';
  return { grade, band };
}

function bandOfScore_(score) {
  if (score == null || !isFinite(score)) return 'neutral';
  if (score >= 85) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

function mapBandToBadge_(band) {
  const badgeMap = { success: '✓', warning: '⚠', danger: '✗', neutral: '—' };
  return badgeMap[band] || '—';
}

function bandToStatusClass_(band) {
  const classMap = {
    success: 'status-success',
    warning: 'status-warning',
    danger: 'status-danger',
    neutral: 'status-neutral'
  };
  return classMap[band] || 'status-neutral';
}

function bandToLabel_(band) {
  const labelMap = {
    success: 'Good',
    warning: 'Caution',
    danger: 'Action',
    neutral: 'Neutral'
  };
  return labelMap[band] || 'Unknown';
}

// --- Severity description ---
function describeSeverity_(band, delta, { positiveIsGood = true } = {}) {
  if (band == null || !isFinite(delta)) return '—';
  const trendSign = (delta > 0) === positiveIsGood ? '↑' : '↓';
  const bandLabel = bandToLabel_(band);
  const absDelta = Math.abs(Math.round(delta));
  return `${bandLabel} (${trendSign} ${absDelta}%)`;
}

// --- Bucket scoring ---
function scoreSleepBucket_({ sleepThisWeek, sleepGoal, sdMinutes, rhrDelta }) {
  let score = 50;
  if (sleepGoal && sleepThisWeek != null) {
    const sleepRatio = sleepThisWeek / sleepGoal;
    score = Math.round(sleepRatio * 100);
  }
  if (sdMinutes != null && sdMinutes > CONFIG.Sleep.consistencyRed) {
    score = Math.max(score - 10, 30);
  }
  if (rhrDelta != null && rhrDelta > CONFIG.RHR.redDelta) {
    score = Math.max(score - 15, 20);
  }
  score = Math.max(0, Math.min(100, score));
  return { score, ...gradeFromScore_(score) };
}

function scoreLoadBucket_({ acwr, loadPctVsTrend }) {
  let score = 50;
  if (acwr != null) {
    const ACWR_GATING_THRESHOLD = 1.5;
    if (acwr > ACWR_GATING_THRESHOLD) {
      score = Math.max(30, 100 - (acwr - 1.0) * 50);
    } else if (acwr > CONFIG.ACWR.red) {
      score = 55;
    } else if (acwr > CONFIG.ACWR.amber) {
      score = 70;
    } else if (acwr >= CONFIG.ACWR.alertLow) {
      score = 80;
    } else {
      score = 65;
    }
  }
  if (loadPctVsTrend != null && Math.abs(loadPctVsTrend) > 20) {
    score = Math.max(score - 10, 25);
  }
  score = Math.max(0, Math.min(100, score));
  return { score, ...gradeFromScore_(score) };
}

function scoreActivityBucket_({ stepsThisWeek, stepsGoal, floorDays, floorTarget }) {
  let score = 50;
  if (stepsGoal && stepsThisWeek != null) {
    const stepsRatio = stepsThisWeek / stepsGoal;
    score = Math.round(stepsRatio * 100);
  }
  if (floorTarget != null && floorDays != null && floorTarget > 0) {
    const floorRatio = floorDays / floorTarget;
    if (floorRatio < 0.5) score = Math.max(score - 20, 25);
    else if (floorRatio < 0.8) score = Math.max(score - 10, 40);
  }
  score = Math.max(0, Math.min(100, score));
  return { score, ...gradeFromScore_(score) };
}

function scoreWorkBucket_({ hoursThisWeek, hoursGoal, deepWorkPct }) {
  let score = 50;
  if (hoursGoal && hoursThisWeek != null) {
    const workRatio = hoursThisWeek / hoursGoal;
    score = Math.round(workRatio * 100);
  }
  if (deepWorkPct != null && deepWorkPct < 0.3) {
    score = Math.max(score - 15, 30);
  }
  score = Math.max(0, Math.min(100, score));
  return { score, ...gradeFromScore_(score) };
}

// --- Total score computation ---
function computeTotalScore_(bucketScores = {}) {
  const scores = [
    bucketScores.sleep?.score || 50,
    bucketScores.load?.score || 50,
    bucketScores.activity?.score || 50,
    bucketScores.work?.score || 50
  ];
  return Math.round((scores[0] + scores[1] + scores[2] + scores[3]) / 4);
}

// --- Confidence from data gaps ---
function confidenceLabelFromMissing_(missing, degraded = false) {
  const totalGaps = (missing?.activity || 0) + (missing?.sleep || 0) + (missing?.rhr || 0);
  const effectiveGaps = degraded ? Math.max(totalGaps, 1) : totalGaps;
  if (!degraded && effectiveGaps === 0) return null;
  if (effectiveGaps === 0) {
    return { label: 'Confidence: High', className: 'status-success' };
  }
  if (effectiveGaps <= 2) {
    return { label: 'Confidence: Medium', className: 'status-warning' };
  }
  return { label: 'Confidence: Low', className: 'status-danger' };
}

// --- Helper label functions ---
function buildIndentedLabel_(label) {
  return `↳ ${label}`;
}

// --- Numeric helpers for scoring ---
function weightedAverage_(components = []) {
  if (!Array.isArray(components) || !components.length) return null;
  const sum = components.reduce((acc, c) => acc + (c.value != null && isFinite(c.value) ? c.value * (c.weight || 1) : 0), 0);
  const weights = components.reduce((acc, c) => acc + (c.weight || 1), 0);
  return weights > 0 ? sum / weights : null;
}

function trendDelta_(current, previous) {
  if (current == null || previous == null || !isFinite(current) || !isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function recencyBlend4w_(values = [], weights = [0.4, 0.3, 0.2, 0.1]) {
  if (!Array.isArray(values) || !values.length) return null;
  const validVals = values
    .map((v, i) => ({ value: v, weight: weights[i] || 0 }))
    .filter(item => item.value != null && isFinite(item.value));
  return weightedAverage_(validVals);
}

// --- Trend descriptors ---
function describeTrendWord_(delta, { positiveIsGood = true, tolerance = 2, upWord = 'improving', downWord = 'sliding' } = {}) {
  if (delta == null || !isFinite(delta)) return null;
  const absDelta = Math.abs(delta);
  if (absDelta <= tolerance) return 'stable';
  const isUp = delta > 0;
  const isGood = isUp === positiveIsGood;
  return isGood ? upWord : downWord;
}

// --- RHR & sleep metric mapping ---
function mapRhrDeltaToPct_(rhrAvg, baseline) {
  if (rhrAvg == null || baseline == null || !isFinite(rhrAvg) || !isFinite(baseline)) return null;
  return ((rhrAvg - baseline) / baseline) * 100;
}

function mapSdToPct_(sdMinutes, target = 30) {
  if (sdMinutes == null || !isFinite(sdMinutes) || target <= 0) return null;
  return (sdMinutes / target) * 100;
}

function mapAcwrToPct_(acwr) {
  if (acwr == null || !isFinite(acwr)) return null;
  if (acwr >= 1.5) return 150;
  if (acwr >= 1.2) return 120;
  if (acwr >= 1.0) return 100;
  if (acwr >= 0.8) return 80;
  return 50;
}

// --- Severity classification for load ---
function loadSeverityLabel_(acwrValue, rhrDelta) {
  if (acwrValue == null) return 'Unknown';
  const ACWR_GATING_THRESHOLD = 1.5;
  if (acwrValue > ACWR_GATING_THRESHOLD) {
    if (rhrDelta != null && rhrDelta > CONFIG.RHR.redDelta) return 'High risk';
    return 'Overreach';
  }
  if (acwrValue > CONFIG.ACWR.red) return 'Overreach';
  if (acwrValue > CONFIG.ACWR.amber) return 'In band';
  if (acwrValue >= CONFIG.ACWR.alertLow) return 'In band';
  return 'Under-stimulus';
}

function mapStatusClassToVoiceKey_(className) {
  if (!className) return 'neutral';
  if (className.includes('success')) return 'good';
  if (className.includes('warning')) return 'caution';
  if (className.includes('danger')) return 'danger';
  return 'neutral';
}

function mapBandToVoiceKey_(band) {
  const voiceMap = { success: 'good', warning: 'caution', danger: 'danger', neutral: 'neutral' };
  return voiceMap[band] || 'neutral';
}
