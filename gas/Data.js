// ==== Data.gs ====
// Deltas/percents, TZ week bounds, rounding, missing-day counters, derived stats

// --- Timezone & week bounds (Europe/Stockholm, Saturday start) ---
const TZ = 'Europe/Stockholm';
let WEEK_REFERENCE_OVERRIDE = null;

function startOfDay_(d){ const s = new Date(d); s.setHours(0,0,0,0); return s; }
function endOfDay_(d){ const e = new Date(d); e.setHours(23,59,59,999); return e; }

function normalizeToLocal_(dateLike) {
  const date = new Date(dateLike);
  const iso = Utilities.formatDate(date, TZ, "yyyy-MM-dd'T'HH:mm:ss");
  return new Date(iso);
}

function setWeekReferenceOverride(date) {
  WEEK_REFERENCE_OVERRIDE = date ? new Date(date) : null;
}

function getWeekBounds_(referenceDate){
  const base = referenceDate != null
    ? normalizeToLocal_(referenceDate)
    : (WEEK_REFERENCE_OVERRIDE != null ? normalizeToLocal_(WEEK_REFERENCE_OVERRIDE) : normalizeToLocal_(new Date()));
  const dow = base.getDay(); // Sunday=0 ... Saturday=6
  const offset = (dow + 1) % 7; // distance back to Saturday
  const start = startOfDay_(new Date(base)); start.setDate(base.getDate() - offset);
  const end = endOfDay_(new Date(start)); end.setDate(start.getDate() + 6);
  return [start, end];
}

/**
 * Strip leading apostrophe from text-formatted Google Sheets cells
 * Google Sheets prepends ' to force text storage and prevent date parsing
 * @param {string} str - String value that may have leading apostrophe
 * @returns {string} String with leading apostrophe removed if present
 */
function stripLeadingApostrophe_(str) {
  if (typeof str === 'string' && str.startsWith("'")) {
    return str.substring(1);
  }
  return str;
}

/**
 * Normalize various date formats to YYYY-MM-DD string
 * Handles: ISO strings, Excel serial numbers, Date objects
 * @param {string|number|Date} val - Date value in any supported format
 * @returns {string} Date as YYYY-MM-DD string
 */
function normalizeDateString_(val) {
  // If it's already a string in YYYY-MM-DD format, use it
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
    return val.substring(0, 10);
  }
  
  // If it's a number, it's an Excel serial date (days since 1899-12-30)
  if (typeof val === 'number') {
    // Convert Excel serial number to JavaScript Date
    // Excel epoch is Dec 30, 1899 (not Jan 1, 1900 due to Excel's leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // Month is 0-indexed
    const date = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // If it's a Date object, extract using UTC to avoid timezone issues
  if (val instanceof Date) {
    const utcYear = val.getUTCFullYear();
    const utcMonth = String(val.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(val.getUTCDate()).padStart(2, '0');
    return `${utcYear}-${utcMonth}-${utcDay}`;
  }
  
  return String(val);
}

// --- Safe numbers & formatting ---
function safeNum(n, def=0){ return (typeof n === 'number' && !isNaN(n)) ? n : def; }
function fmtPct(n){ return `${Math.round(safeNum(n))}%`; }
function fmtHMin(totalMinutes){
  const m = Math.max(0, Math.round(safeNum(totalMinutes)));
  const h = Math.floor(m/60), mm = m%60;
  return `${h}h ${mm}m`;
}
function clampFulfilmentPct(value){
  if (value == null || isNaN(value)) return null;
  return Math.max(0, Math.min(130, Math.round(value)));
}

function bandForFulfilment(pct, options) {
  const cfg = Object.assign({ greenTolerance: 5, yellowTolerance: 10 }, options || {});
  if (pct == null || isNaN(pct)) return 'unknown';
  const diff = pct - 100;
  const absDiff = Math.abs(diff);
  if (absDiff <= cfg.greenTolerance) return 'green';
  if (absDiff <= cfg.yellowTolerance) return diff >= 0 ? 'yellow_high' : 'yellow_low';
  return diff >= 0 ? 'red_high' : 'red_low';
}

// --- Goals ---
function getUserGoals(){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Goals');
  if (!sh) return null;
  const values = sh.getDataRange().getValues();
  values.shift(); // headers
  const dict = {};
  for (const row of values) {
    const key = String(row[0] || '').trim();
    const val = row[1];
    if (key) dict[key] = val;
  }
  return {
    steps: Number(dict['steps'] || dict['Steps'] || 0),
    sleepMinutes: Number(dict['sleepMinutes'] || dict['SleepMinutes'] || 0),
    restingHeartRate: Number(dict['restingHeartRate'] || dict['RestingHeartRate'] || 0),
    weeklyTrainingLoad: Number(dict['weeklyTrainingLoad'] || dict['WeeklyTrainingLoad'] || 0),
    weeklyWorkHours: Number(dict['weeklyWorkHours'] || dict['WeeklyWorkHours'] || 0),
    stepsFloor: Number(dict['stepsFloor'] || 6000),
    stepsFloorDays: Number(dict['stepsFloorDays'] || 5)
  };
}

// --- Generic readers (Sleep / HeartRate) ---
function getWeeklyAverage(sheetName, preferredColumn){
  const [start, end] = getWeekBounds_();
  const { data, idxVal } = getSheetValuesInRange_(sheetName, start, end, preferredColumn);
  if (!data.length || idxVal === -1) return null;
  const total = data.reduce((s, r) => s + (Number(r[idxVal]) || 0), 0);
  return total / data.length;
}
function get4WeekAverage(sheetName, preferredColumn){
  const end = endOfDay_(new Date(Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss")));
  const start = startOfDay_(new Date(end)); start.setDate(end.getDate() - 27);
  const { data, idxVal } = getSheetValuesInRange_(sheetName, start, end, preferredColumn);
  if (!data.length || idxVal === -1) return null;
  const total = data.reduce((s, r) => s + (Number(r[idxVal]) || 0), 0);
  return total / data.length;
}
function getWeeklySeries(sheetName, preferredColumn){
  const [start, end] = getWeekBounds_();
  const { data, idxVal } = getSheetValuesInRange_(sheetName, start, end, preferredColumn);
  if (!data.length || idxVal === -1) return [];
  return data.map(r => Number(r[idxVal]) || 0);
}
function getSheetValuesInRange_(sheetName, start, end, preferredColumn){
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return { data: [], idxVal: -1, headers: [] };
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  const iDate = headers.findIndex(h => h.toLowerCase() === 'date');
  let idxVal = -1;
  if (preferredColumn) {
    idxVal = headers.findIndex(h => h.toLowerCase() === preferredColumn.toLowerCase());
  }
  if (idxVal === -1 && sheetName) {
    const sheetLower = sheetName.toLowerCase();
    if (sheetLower === 'sleep') {
      idxVal = headers.findIndex(h => h.toLowerCase() === 'sleep_total_min');
    } else if (sheetLower === 'heartrate') {
      const primaryHrColumns = [
        'resting_heart_rate',
        'resting heart rate',
        'restinghr',
        'resting hr',
        'restingheartrate',
        'restingheartratebpm',
        'resting heartrate',
        'resting_heartrate',
        'night_resting_heart_rate',
        'overnight_resting_heart_rate',
        'sleep_resting_heart_rate',
        'restingnightbpm',
        'night_rhr',
        'sleep_rhr',
        'rhr'
      ];
      const secondaryHrColumns = [
        'lowest_hr',
        'lowest heart rate',
        'lowest_resting_heart_rate',
        'hr_low',
        'hr_min',
        'hr_min_avg',
        'hrminavg'
      ];
      idxVal = primaryHrColumns.reduce((foundIdx, candidate) => {
        if (foundIdx !== -1) return foundIdx;
        return headers.findIndex(h => h.toLowerCase() === candidate.toLowerCase());
      }, -1);
      if (idxVal === -1) {
        idxVal = secondaryHrColumns.reduce((foundIdx, candidate) => {
          if (foundIdx !== -1) return foundIdx;
          return headers.findIndex(h => h.toLowerCase() === candidate.toLowerCase());
        }, -1);
      }
      if (idxVal === -1) {
        idxVal = headers.findIndex(h => /rest|night|sleep/.test(h.toLowerCase()));
      }
    }
  }
  if (idxVal === -1) {
    idxVal = headers.findIndex(h => h.toLowerCase() === 'value');
  }
  if (idxVal === -1 && headers.length >= 2) idxVal = 1; // assume column B
  const data = values.filter(r => {
    const d = new Date(r[iDate]);
    return !isNaN(d) && d >= start && d <= end;
  });
  return { data, idxVal, headers };
}

// --- Activity sheet (single tab) ---
const ACTIVITY_SHEET = 'Activity';
function getActivityRowsByDateRange_(start, end){
  const sh = SpreadsheetApp.getActive().getSheetByName(ACTIVITY_SHEET);
  if (!sh) return { headers: [], data: [] };
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  const iDate = headers.findIndex(h => h.toLowerCase() === 'date');
  if (iDate === -1) return { headers, data: [] };
  const data = values.filter(r => {
    const d = new Date(r[iDate]);
    return !isNaN(d) && d >= start && d <= end;
  });
  return { headers, data };
}
function activityHeaderIndex_(headers, name){
  return headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
}
function getWeeklyAverageFromActivity(column){
  const [start, end] = getWeekBounds_();
  const { headers, data } = getActivityRowsByDateRange_(start, end);
  const idx = activityHeaderIndex_(headers, column);
  if (idx === -1 || !data.length) return null;
  const total = data.reduce((s, r) => s + (Number(r[idx]) || 0), 0);
  return total / data.length;
}
function getWeeklySumFromActivity(column){
  const [start, end] = getWeekBounds_();
  const { headers, data } = getActivityRowsByDateRange_(start, end);
  const idx = activityHeaderIndex_(headers, column);
  if (idx === -1) return null;
  return data.reduce((s, r) => s + (Number(r[idx]) || 0), 0);
}
function get4WeekAverageFromActivity(column, mode /* 'avg' | 'sum' */ = 'avg'){
  const end = endOfDay_(new Date(Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss")));
  const start = startOfDay_(new Date(end)); start.setDate(end.getDate() - 27);
  const { headers, data } = getActivityRowsByDateRange_(start, end);
  const idx = activityHeaderIndex_(headers, column);
  if (idx === -1) return null;
  const days = data.length || 1;
  const total = data.reduce((s, r) => s + (Number(r[idx]) || 0), 0);
  if (mode === 'sum') return total / 4;   // per-week avg over last 4 weeks
  return total / days;                    // daily avg over last 4 weeks
}

// refer to Sleep.js
function labelAcwr_(ratio){
  if (ratio == null || !isFinite(ratio)) return 'Data Gaps';
  if (ratio < 0.8) return 'Underload';
  if (ratio <= 1.15) return 'Stable';
  if (ratio <= 1.30) return 'Caution';
  return 'Spike';
}
function getPrevious4WeeksAvgFromActivitySum_(column){
  const [currentWeekStart] = getWeekBounds_();
  const totals = [];
  for (let w = 1; w <= 4; w++){
    const weekStart = startOfDay_(new Date(currentWeekStart));
    weekStart.setDate(weekStart.getDate() - 7 * w);
    const weekEnd = endOfDay_(new Date(weekStart));
    weekEnd.setDate(weekStart.getDate() + 6);
    const { headers, data } = getActivityRowsByDateRange_(weekStart, weekEnd);
    const idx = activityHeaderIndex_(headers, column);
    if (idx === -1) continue;
    const total = data.reduce((s, r) => s + (Number(r[idx]) || 0), 0);
    if (data.length) totals.push(total);
  }
  if (!totals.length) return null;
  return totals.reduce((a,b)=>a+b,0) / totals.length;
}
function computeWeeklyACWR_(acuteOverride){
  const acute = (typeof acuteOverride === 'number' && !isNaN(acuteOverride)) ? acuteOverride : (getWeeklySumFromActivity('volume_kg') || 0);
  const chronic = getPrevious4WeeksAvgFromActivitySum_('volume_kg');
  if (chronic == null){
    return { ratio: null, value: null, label: 'Data Gaps', acute, chronic: null };
  }
  if (chronic <= 0){
    if (acute <= 0) return { ratio: null, value: null, label: 'Data Gaps', acute, chronic };
    const capped = 2.5;
    return { ratio: capped, value: capped, label: 'Spike', acute, chronic };
  }
  const rawRatio = acute / chronic;
  const ratio = Math.min(2.5, rawRatio);
  const value = Math.round(ratio * 10) / 10;
  return { ratio, value, label: labelAcwr_(ratio), acute, chronic };
}

function getWeeklyRollups_(limit) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('WeeklyRollups');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values || !values.length) return [];
  const headers = (values.shift() || []).map(header => String(header || '').trim());
  const rows = [];
  for (const row of values) {
    if (!row || !row.length) continue;
    const entry = {};
    let populated = false;
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      const value = row[i];
      entry[key] = value;
      if (value !== '' && value != null) populated = true;
    }
    if (!populated) continue;
    if (!entry.week_start) continue;
    rows.push(entry);
  }
  rows.sort((a, b) => {
    const aDate = new Date(a.week_start);
    const bDate = new Date(b.week_start);
    return aDate - bDate;
  });
  if (limit && rows.length > limit) {
    return rows.slice(rows.length - limit);
  }
  return rows;
}

// --- Shared scoring helpers used by Main ---
function scale(x){
  if (x == null || isNaN(x)) return 0;
  const y = Math.max(0, x);
  return Math.round(Math.min(100, Math.sqrt(y) * 100)); // 0.25->50, 1.0->100
}
function countDaysMeetingFloor_(column, floor){
  const [start, end] = getWeekBounds_();
  const { headers, data } = getActivityRowsByDateRange_(start, end);
  const idx = activityHeaderIndex_(headers, column);
  if (idx === -1) return 0;
  return data.reduce((n, r) => n + ((Number(r[idx]) || 0) >= floor ? 1 : 0), 0);
}
function stdev_(arr){
  const n = arr.length; if (n < 2) return 0;
  const mean = arr.reduce((a,b)=>a+b,0)/n;
  const v = arr.reduce((s,x)=>s+Math.pow(x-mean,2),0)/(n-1);
  return Math.sqrt(v);
}

// --- Missing-day counters ---
function countMissingDaysInWeek_(sheetName){
  const [start, end] = getWeekBounds_();
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return 7;
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  const iDate = headers.findIndex(h => h.toLowerCase() === 'date');
  if (iDate === -1) return 7;
  const seen = new Set();
  for (const r of values){
    const d = new Date(r[iDate]);
    if (!isNaN(d) && d >= start && d <= end){
      const key = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
      seen.add(key);
    }
  }
  return Math.max(0, 7 - seen.size);
}

// --- Derived stats (delta-first, pre-rounded for display) ---
function computeDerivedStats(weekly, trend, goals, sleepConsistencyInfo, acwrInfo){
  const stepsFloor = goals.stepsFloor || 6000;

  const sleepConsistency = sleepConsistencyInfo || computeSleepConsistencyWeekly_();
  const acwr = acwrInfo || computeWeeklyACWR_(weekly ? weekly.trainingLoad : null);

  // Work
  const workGoalMin = (goals.weeklyWorkHours || 0) * 60;
  const workWkMin = (weekly.workHours || 0) * 60;
  const workTrendMin = (trend.workHours || 0) * 60;
  const workDeltaGoalMin = (workGoalMin ? workWkMin - workGoalMin : 0);
  const workPctVsTrend = (workTrendMin ? ((workWkMin - workTrendMin) / workTrendMin) * 100 : 0);
  const workTrendGoalMin = workGoalMin ? (workTrendMin - workGoalMin) : null;

  // Load
  const loadDeltaGoalKg = (goals.weeklyTrainingLoad ? (weekly.trainingLoad || 0) - goals.weeklyTrainingLoad : 0);
  const loadPctVsTrend = (trend.trainingLoad ? ((weekly.trainingLoad || 0) - trend.trainingLoad) / Math.max(trend.trainingLoad, 1) * 100 : 0);
  const loadTrendGoalKg = goals.weeklyTrainingLoad ? (trend.trainingLoad || 0) - goals.weeklyTrainingLoad : null;

  // Steps
  const stepsDeltaGoal = (goals.steps ? (weekly.steps || 0) - goals.steps : 0);
  const stepsPctVsTrend = (trend.steps ? ((weekly.steps || 0) - trend.steps) / trend.steps * 100 : 0);
  const days6k = countDaysMeetingFloor_('steps', stepsFloor);
  const stepsTrendGoal = goals.steps ? (trend.steps || 0) - goals.steps : null;

  // Sleep duration and timing
  const sleepDeltaGoalMin = (goals.sleepMinutes ? (weekly.sleep || 0) - goals.sleepMinutes : 0);
  const sleepPctVsTrend = (trend.sleep ? ((weekly.sleep || 0) - trend.sleep) / trend.sleep * 100 : 0);
  const sleepTrendGoalMin = goals.sleepMinutes ? (trend.sleep || 0) - goals.sleepMinutes : null;
  const sleepSeries = getWeeklySeries('Sleep', 'sleep_total_min');
  const sv = (sleepSeries.length >= 2) ? stdev_(sleepSeries) : 0;
  const minmax = sleepSeries.length ? { min: Math.min(...sleepSeries), max: Math.max(...sleepSeries) } : { min: 0, max: 0 };

  const sleepConsistencyScore = (sleepConsistency && typeof sleepConsistency.score === 'number')
    ? Math.max(0, Math.min(100, Math.round(sleepConsistency.score)))
    : null;
  const sleepConsistencyLabel = sleepConsistency ? (sleepConsistency.label || 'Data Gaps') : 'Data Gaps';
  const sleepConsistencySource = sleepConsistency ? (sleepConsistency.source || 'unknown') : 'unknown';
  const sleepTimingSdMin = (sleepConsistency && typeof sleepConsistency.sdMinutes === 'number')
    ? Math.round(sleepConsistency.sdMinutes)
    : null;

  // RHR (lower is better)
  const rhrDeltaVsTrend = (weekly.rhr || 0) - (trend.rhr || weekly.rhr || 0);

  // Missing days
  const missActivity = countMissingDaysInWeek_('Activity');
  const missSleep = countMissingDaysInWeek_('Sleep');
  const missRHR = countMissingDaysInWeek_('HeartRate');

  // ACWR
  const acwrRatio = acwr && typeof acwr.ratio === 'number' ? acwr.ratio : null;
  const acwrValue = (acwr && typeof acwr.value === 'number') ? acwr.value : (acwrRatio != null ? Math.round(acwrRatio * 10) / 10 : null);
  const acwrLabel = acwr ? (acwr.label || 'Data Gaps') : 'Data Gaps';

  // Fulfilment (vs goals)
  const fulfilment = {};
  if (goals.weeklyWorkHours) {
    fulfilment.workPct = clampFulfilmentPct((weekly.workHours || 0) / Math.max(goals.weeklyWorkHours, 1) * 100);
  } else {
    fulfilment.workPct = null;
  }

  let strengthGoal = goals.weeklyTrainingLoad || 0;
  let strengthProxyGoal = false;
  if (!strengthGoal && trend.trainingLoad) {
    strengthGoal = trend.trainingLoad;
    strengthProxyGoal = true;
  }
  if (strengthGoal) {
    fulfilment.strengthPct = clampFulfilmentPct((weekly.trainingLoad || 0) / Math.max(strengthGoal, 1) * 100);
  } else {
    fulfilment.strengthPct = null;
  }
  fulfilment.strengthProxyGoal = strengthProxyGoal;

  if (goals.steps) {
    fulfilment.fitnessPct = clampFulfilmentPct((weekly.steps || 0) / Math.max(goals.steps, 1) * 100);
  } else {
    fulfilment.fitnessPct = null;
  }

  if (goals.sleepMinutes) {
    fulfilment.sleepPct = clampFulfilmentPct((weekly.sleep || 0) / Math.max(goals.sleepMinutes, 1) * 100);
  } else {
    fulfilment.sleepPct = null;
  }

  if (goals.restingHeartRate && weekly.rhr) {
    fulfilment.rhrPct = clampFulfilmentPct((goals.restingHeartRate / Math.max(weekly.rhr, 1)) * 100);
  } else {
    fulfilment.rhrPct = null;
  }

  const bands = {
    work: bandForFulfilment(fulfilment.workPct),
    strength: bandForFulfilment(fulfilment.strengthPct),
    fitness: bandForFulfilment(fulfilment.fitnessPct),
    sleep: bandForFulfilment(fulfilment.sleepPct, { greenTolerance: 5, yellowTolerance: 12 }),
    readiness: bandForFulfilment(fulfilment.rhrPct, { greenTolerance: 3, yellowTolerance: 6 })
  };

  return {
    fulfilment,
    bands,
    work: {
      deltaGoalStr: (workGoalMin ? (workDeltaGoalMin >= 0 ? `+${fmtHMin(workDeltaGoalMin)}` : `-${fmtHMin(-workDeltaGoalMin)}`) : '—'),
      pctTrendStr: fmtPct(workPctVsTrend),
      trendGoalStr: (workGoalMin && workTrendGoalMin != null) ? (workTrendGoalMin >= 0 ? `+${fmtHMin(workTrendGoalMin)}` : `-${fmtHMin(-workTrendGoalMin)}`) : '—'
    },
    load: {
      deltaGoalStr: goals.weeklyTrainingLoad ? ((loadDeltaGoalKg >= 0 ? '+' : '') + fmtInt(loadDeltaGoalKg) + 'kg') : '—',
      pctTrendStr: fmtPct(loadPctVsTrend),
      trendGoalStr: goals.weeklyTrainingLoad ? ((loadTrendGoalKg >= 0 ? '+' : '') + fmtInt(loadTrendGoalKg) + 'kg') : '—',
      acwr: {
        ratio: acwrRatio,
        value: acwrValue,
        label: acwrLabel,
        acute: acwr ? acwr.acute || 0 : 0,
        chronic: acwr ? acwr.chronic || 0 : 0
      }
    },
    steps: {
      deltaGoalStr: goals.steps ? ((stepsDeltaGoal >= 0 ? '+' : '') + fmtInt(stepsDeltaGoal)) : '—',
      pctTrendStr: fmtPct(stepsPctVsTrend),
      trendGoalStr: goals.steps ? ((stepsTrendGoal >= 0 ? '+' : '') + fmtInt(stepsTrendGoal)) : '—',
      days6k
    },
    sleep: {
      deltaGoalStr: goals.sleepMinutes ? (sleepDeltaGoalMin >= 0 ? ('+' + fmtHMin(sleepDeltaGoalMin)) : ('-' + fmtHMin(Math.abs(sleepDeltaGoalMin)))) : '—',
      pctTrendStr: fmtPct(sleepPctVsTrend),
      trendGoalStr: goals.sleepMinutes ? (sleepTrendGoalMin >= 0 ? ('+' + fmtHMin(sleepTrendGoalMin)) : ('-' + fmtHMin(Math.abs(sleepTrendGoalMin)))) : '—',
      variability: `${fmtHMin(sv)} stdev (range ${fmtHMin(minmax.min)}–${fmtHMin(minmax.max)})`,
      consistency: {
        score: sleepConsistencyScore,
        label: sleepConsistencyLabel,
        source: sleepConsistencySource,
        sdMinutes: sleepTimingSdMin,
        gaps: sleepConsistency ? sleepConsistency.gaps || 0 : 0
      }
    },
    rhr: {
      deltaTrendStr: ((rhrDeltaVsTrend >= 0 ? '+' : '') + fmtBpm(rhrDeltaVsTrend) + ' bpm')
    },
    missing: {
      activity: missActivity,
      sleep: missSleep,
      rhr: missRHR
    }
  };
}

/**
 * Get the most recent complete week data from WeeklyRollups sheet
 * @returns {Object|null} Latest complete week data, or null if none found
 */
function getLatestCompleteWeekFromRollups() {
  const DEBUG_DATE_PARSING = false; // Set to true to enable detailed logging
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName('WeeklyRollups');
    
    if (!ws) {
      throw new Error('WeeklyRollups sheet not found');
    }
    
    const data = ws.getDataRange().getValues();
    if (data.length <= 1) return null;
  
  const headers = data[0];
  const rows = data.slice(1);
  
  if (DEBUG_DATE_PARSING) {
    Logger.log(`WeeklyRollups has ${rows.length} rows`);
  }
  
  const completeWeeks = rows
    .map((row, rowIdx) => {
      const obj = {};
      headers.forEach((header, idx) => {
        let value = row[idx];
        // Strip leading apostrophe from text-formatted cells
        value = stripLeadingApostrophe_(value);
        obj[header] = value;
      });
      // Store raw row index for debugging
      obj._rowIndex = rowIdx + 2; // +2 for header row and 0-indexing
      return obj;
    })
    .filter(row => {
      const gaps = Number(row.data_gaps);
      return gaps === 0;
    })
    .sort((a, b) => {
      const dateStrA = normalizeDateString_(a.week_start);
      const dateStrB = normalizeDateString_(b.week_start);
      if (DEBUG_DATE_PARSING) {
        Logger.log(`Row ${a._rowIndex} vs Row ${b._rowIndex}: "${dateStrA}" vs "${dateStrB}"`);
      }
      
      // String comparison for ISO dates works perfectly (YYYY-MM-DD)
      return dateStrB.localeCompare(dateStrA); // Descending
    });
  
  if (DEBUG_DATE_PARSING) {
    Logger.log(`Found ${completeWeeks.length} complete weeks (data_gaps=0)`);
    if (completeWeeks.length > 0) {
      Logger.log(`Selected week: ${completeWeeks[0].week_start} to ${completeWeeks[0].week_end}`);
    }
  }
  
  if (completeWeeks.length === 0) return null;
  
  return completeWeeks[0]; // Most recent complete week
  } catch (error) {
    Logger.log(`Error loading from WeeklyRollups: ${error.message}`);
    return null;
  }
}
