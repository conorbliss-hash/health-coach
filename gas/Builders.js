// ==== Builders.js ====
// Module: Builders
// Builder functions for system driver cards, component rows, and composite summaries
// Dependencies: Formatters, Validators, Scoring, Constants

/**
 * Safely check if a value is a valid finite number
 * Used for safe numeric checks before calculations
 * @param {*} value - Value to check
 * @return {boolean} True if value is a number and finite
 */
function isValidMetric_(value) {
  return value != null && isFinite(value);
}

/**
 * Builds 4 system driver cards (Recovery, Workload, Activity, Cognition)
 * Each card displays metrics, insights, and severity indicators
 * 
 * @param {Object} payload - Card data with metrics for each driver
 *   Contains: sleepFulfil, rhrDeltaText, loadKgText, acwrValue, stepsText, workHoursText, etc.
 * @return {Object[]} Array of card objects with title, metrics, grade, insight
 * 
 * Note: Defensive null checks for metrics; missing data returns partial/empty cards
 */
function buildSystemDriverCards_(payload) {
  const {
    sleepFulfil,
    sleepSdText,
    sleepLabelClass,
    rhrDeltaText,
    rhrDeltaValue,
    sleepWeekly,
    sleepTrend,
    sleepGoal,
    loadKgText,
    acwrDisplay,
    acwrValue,
    loadPct,
    loadWeekly,
    loadTrend,
    loadGoal,
    prsThisWeek,
    stepsText,
    floorDaysValue,
    floorTarget,
    stepsDeltaPct,
    stepsWeekly,
    stepsTrend,
    stepsGoal,
    workHoursText,
    workGoalText,
    workTrendText,
    workHoursValue,
    workTrendValue,
    workGoalValue,
    bucketScores = {},
    acutes = {},
    missingCounts = {},
    degradedMode = false,
    latestRollup = null,
    insufficientNote = '— (insufficient data (Sat–Fri))'
  } = payload;
  const sleepBucket = bucketScores.sleep || { score: null, band: 'neutral' };
  const loadBucket = bucketScores.load || { score: null, band: 'neutral' };
  const activityBucket = bucketScores.activity || { score: null, band: 'neutral' };
  const workBucket = bucketScores.work || { score: null, band: 'neutral' };

  const applyHeadlineScoreToBucket = (bucket, pctValue) => {
    if (!bucket || pctValue == null || !isFinite(pctValue)) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pctValue)));
    const gradeInfo = gradeFromScore_(clamped);
    bucket.score = clamped;
    bucket.grade = gradeInfo.grade;
    bucket.band = gradeInfo.band;
    bucket.bandClass = bandToStatusClass_(gradeInfo.band);
    bucket.bandLabel = bandToLabel_(gradeInfo.band);
    bucket.scoreText = `${clamped}/100`;
  };

  applyHeadlineScoreToBucket(sleepBucket, pctOfGoal(sleepTrend, sleepGoal));
  applyHeadlineScoreToBucket(loadBucket, pctOfGoal(loadTrend, loadGoal));
  applyHeadlineScoreToBucket(activityBucket, pctOfGoal(stepsTrend, stepsGoal));
  applyHeadlineScoreToBucket(workBucket, pctOfGoal(workTrendValue, workGoalValue));

  const dataGaps = latestRollup && latestRollup.data_gaps != null ? Number(latestRollup.data_gaps) : null;
  const sleepDaysPresent = latestRollup && latestRollup.sleep_days_present != null ? Number(latestRollup.sleep_days_present) : null;
  const activityDaysPresent = latestRollup && latestRollup.activity_days_present != null ? Number(latestRollup.activity_days_present) : null;
  const insufficientGlobal = dataGaps != null && dataGaps >= 5;
  const insufficientSleep = insufficientGlobal || (sleepDaysPresent != null && sleepDaysPresent < 3);
  const insufficientActivity = insufficientGlobal || (activityDaysPresent != null && activityDaysPresent < 3);
  const insufficientLoad = insufficientActivity;
  const insufficientWork = insufficientGlobal;

  const sleepBand = sleepBucket.band || 'neutral';
  const loadBand = loadBucket.band || 'neutral';
  const activityBand = activityBucket.band || 'neutral';
  const workBand = workBucket.band || 'neutral';
  const sleepScoreText = sleepBucket.scoreText || (sleepBucket.score != null ? `${sleepBucket.score}/100` : '');
  const loadScoreText = loadBucket.scoreText || (loadBucket.score != null ? `${loadBucket.score}/100` : '');
  const activityScoreText = activityBucket.scoreText || (activityBucket.score != null ? `${activityBucket.score}/100` : '');
  const workScoreText = workBucket.scoreText || (workBucket.score != null ? `${workBucket.score}/100` : '');
  const sleepGradeLetter = sleepBucket.grade || gradeFromScore_(sleepBucket.score).grade;
  const loadGradeLetter = loadBucket.grade || gradeFromScore_(loadBucket.score).grade;
  const activityGradeLetter = activityBucket.grade || gradeFromScore_(activityBucket.score).grade;
  const workGradeLetter = workBucket.grade || gradeFromScore_(workBucket.score).grade;
  const sleepBandClass = sleepBucket.bandClass || bandToStatusClass_(sleepBand);
  const loadBandClass = loadBucket.bandClass || bandToStatusClass_(loadBand);
  const activityBandClass = activityBucket.bandClass || bandToStatusClass_(activityBand);
  const workBandClass = workBucket.bandClass || bandToStatusClass_(workBand);
  const sleepBandLabel = sleepBucket.bandLabel || bandToLabel_(sleepBand);
  const loadBandLabel = loadBucket.bandLabel || bandToLabel_(loadBand);
  const activityBandLabel = activityBucket.bandLabel || bandToLabel_(activityBand);
  const workBandLabel = workBucket.bandLabel || bandToLabel_(workBand);
  const sleepAcute = acutes.sleep != null && isFinite(acutes.sleep) ? acutes.sleep : null;
  const loadAcute = acutes.load != null && isFinite(acutes.load) ? acutes.load : null;
  const activityAcute = acutes.activity != null && isFinite(acutes.activity) ? acutes.activity : null;
  const workAcute = acutes.work != null && isFinite(acutes.work) ? acutes.work : null;

  const confidenceBadge = confidenceLabelFromMissing_(missingCounts, degradedMode);
  const cards = [];
  const missingNotes = [];

  const recoveryMetrics = [];
  const sleepFourWeekPct = pctOfGoal(sleepTrend, sleepGoal);
  if (sleepFourWeekPct != null) {
    recoveryMetrics.push({ label: '4-wk vs Goal', value: formatPercentHeadline_('Sleep', sleepFourWeekPct) });
  }
  const sleepWeeklyPct = pctOfGoalUnlimited_(sleepWeekly, sleepGoal);
  if (sleepWeeklyPct != null) {
    const sleepThisWeekValue = insufficientSleep ? insufficientNote : formatPercentValue_(sleepWeeklyPct);
    recoveryMetrics.push({ label: 'This Week vs Goal', value: sleepThisWeekValue });
  }
  if (sleepSdText) recoveryMetrics.push({ label: 'Sleep SD', value: sleepSdText });
  if (rhrDeltaText) recoveryMetrics.push({ label: 'RHR Δ', value: rhrDeltaText });
  if (recoveryMetrics.length) {
    const recoverySeverity = describeSeverity_(sleepBand, sleepAcute, { positiveIsGood: true });
    cards.push({
      key: 'recovery',
      title: 'Recovery',
      className: 'card card--recovery',
      grade: sleepGradeLetter,
      score: sleepScoreText,
      bandClass: sleepBandClass,
      bandLabel: sleepBandLabel,
      severity: recoverySeverity,
      ...(confidenceBadge ? { badge: { ...confidenceBadge } } : {}),
      metrics: recoveryMetrics,
      insight: summariseRecoveryInsight_({
        band: sleepBand,
        className: sleepLabelClass,
        delta: sleepAcute,
        rhrDelta: rhrDeltaValue
      })
    });
  } else {
    missingNotes.push('Recovery card incomplete — sleep or RHR data missing.');
  }

  const volumeMetrics = [];
  const loadFourWeekPct = pctOfGoal(loadTrend, loadGoal);
  if (loadFourWeekPct != null) {
    volumeMetrics.push({ label: '4-wk vs Goal', value: formatPercentHeadline_('Gym Volume', loadFourWeekPct) });
  }
  const loadWeeklyPct = pctOfGoal(loadWeekly, loadGoal);
  if (loadWeeklyPct != null) {
    const loadThisWeekValue = insufficientLoad ? insufficientNote : formatPercentValue_(loadWeeklyPct);
    volumeMetrics.push({ label: 'This Week vs Goal', value: loadThisWeekValue });
  }
  if (typeof prsThisWeek === 'number' && !Number.isNaN(prsThisWeek)) {
    volumeMetrics.push({ label: 'PRs this Week', value: fmtInt(prsThisWeek) });
  }
  if (acwrDisplay) volumeMetrics.push({ label: 'ACWR', value: acwrDisplay });
  if (volumeMetrics.length) {
    const mappedSeverity = loadSeverityLabel_(acwrValue, rhrDeltaValue);
    let workloadSeverity = describeSeverity_(loadBand, loadAcute, { positiveIsGood: false });
    if (mappedSeverity && mappedSeverity !== 'Unknown') {
      workloadSeverity = mappedSeverity;
    }
    cards.push({
      key: 'workload',
      title: 'Gym Volume',
      className: 'card card--workload',
      grade: loadGradeLetter,
      score: loadScoreText,
      bandClass: loadBandClass,
      bandLabel: loadBandLabel,
      severity: workloadSeverity,
      ...(confidenceBadge ? { badge: { ...confidenceBadge } } : {}),
      metrics: volumeMetrics,
      insight: summariseWorkloadInsight_({
        acwrValue,
        loadPct: insufficientLoad ? null : loadPct,
        rhrDelta: rhrDeltaValue,
        band: loadBand
      })
    });
  } else {
    missingNotes.push('Gym Volume card incomplete — load metrics unavailable.');
  }

  const cardioMetrics = [];
  const stepsFourWeekPct = pctOfGoal(stepsTrend, stepsGoal);
  if (stepsFourWeekPct != null) {
    cardioMetrics.push({ label: '4-wk vs Goal', value: formatPercentHeadline_('Steps', stepsFourWeekPct) });
  }
  const stepsWeeklyPct = pctOfGoal(stepsWeekly, stepsGoal);
  if (stepsWeeklyPct != null) {
    const stepsThisWeekValue = insufficientActivity ? insufficientNote : formatPercentValue_(stepsWeeklyPct);
    cardioMetrics.push({ label: 'This Week vs Goal', value: stepsThisWeekValue });
  }
  const floorHeadline = formatFloorCompliance_(floorDaysValue, floorTarget);
  if (floorHeadline !== '—') {
    cardioMetrics.push({ label: 'Floor', value: floorHeadline });
  }
  if (cardioMetrics.length) {
    const activitySeverity = describeSeverity_(activityBand, activityAcute, { positiveIsGood: true });
    cards.push({
      key: 'activity',
      title: 'Cardio',
      className: 'card card--activity',
      grade: activityGradeLetter,
      score: activityScoreText,
      bandClass: activityBandClass,
      bandLabel: activityBandLabel,
      severity: activitySeverity,
      ...(confidenceBadge ? { badge: { ...confidenceBadge } } : {}),
      metrics: cardioMetrics,
      insight: summariseActivityInsight_({
        band: activityBand,
        stepsDeltaPct: insufficientActivity ? null : stepsDeltaPct,
        floorDays: floorDaysValue,
        floorTarget
      })
    });
  } else {
    missingNotes.push('Cardio card incomplete — step data missing.');
  }

  const cognitionMetrics = [];
  const workFourWeekPct = pctOfGoal(workTrendValue, workGoalValue);
  if (workFourWeekPct != null) {
    cognitionMetrics.push({ label: '4-wk vs Goal', value: formatPercentHeadline_('Work', workFourWeekPct) });
  }
  const workWeeklyPct = pctOfGoal(workHoursValue, workGoalValue);
  if (workWeeklyPct != null) {
    const workThisWeekValue = insufficientWork ? insufficientNote : formatPercentValue_(workWeeklyPct);
    cognitionMetrics.push({ label: 'This Week vs Goal', value: workThisWeekValue });
  }
  if (workGoalText) cognitionMetrics.push({ label: 'Goal', value: workGoalText });
  if (workTrendText) cognitionMetrics.push({ label: '4-wk Avg', value: workTrendText });
  if (cognitionMetrics.length) {
    const workSeverity = describeSeverity_(workBand, workAcute, { positiveIsGood: true });
    cards.push({
      key: 'cognition',
      title: 'Cognition & Work',
      className: 'card card--cognition',
      grade: workGradeLetter,
      score: workScoreText,
      bandClass: workBandClass,
      bandLabel: workBandLabel,
      severity: workSeverity,
      ...(confidenceBadge ? { badge: { ...confidenceBadge } } : {}),
      metrics: cognitionMetrics,
      insight: summariseCognitionInsight_({
        workHours: workHoursValue,
        goalHours: workGoalValue,
        trendHours: workTrendValue,
        band: workBand,
        delta: insufficientWork ? null : workAcute
      })
    });
  } else {
    missingNotes.push('Cognition card incomplete — work hours unavailable.');
  }

  return { cards, missingNotes };
}

/**
 * Builds metric comparison table rows (Sleep, Resting HR, Load, Steps, Work)
 * Displays this week vs 4-week average vs target goal
 * 
 * @param {Object} weekly - Weekly data (sleep, rhr, steps, workHours)
 * @param {Object} trend - 4-week trend data
 * @param {Object} goals - User goals
 * @param {Object} ds - Data stats with completeness info
 * @param {Object} sleepConsistency - Sleep variability (SRI score)
 * @param {number|null} acwrValue - Acute:Chronic workload ratio
 * @param {Object} [bucketScores={}] - Pre-computed bucket scores
 * @param {Object} [acutes={}] - Acute vs trend deltas
 * @return {Object[]} Array of row objects for table rendering
 */
function buildComponentRows_(weekly, trend, goals, ds, sleepConsistency, acwrValue, bucketScores = {}, acutes = {}) {
  const rows = [];
  const sleepBucketScore = bucketScores.sleep || {};
  const loadBucketScore = bucketScores.load || {};
  const activityBucketScore = bucketScores.activity || {};
  const workBucketScore = bucketScores.work || {};

  const sleepBand = sleepBucketScore.band || 'neutral';
  const loadBand = loadBucketScore.band || 'neutral';
  const activityBand = activityBucketScore.band || 'neutral';
  const workBand = workBucketScore.band || 'neutral';

  const sleepScoreText = sleepBucketScore.scoreText || (sleepBucketScore.score != null ? `${sleepBucketScore.score}/100` : '');
  const loadScoreText = loadBucketScore.scoreText || (loadBucketScore.score != null ? `${loadBucketScore.score}/100` : '');
  const activityScoreText = activityBucketScore.scoreText || (activityBucketScore.score != null ? `${activityBucketScore.score}/100` : '');
  const workScoreText = workBucketScore.scoreText || (workBucketScore.score != null ? `${workBucketScore.score}/100` : '');

  const sleepBandClass = sleepBucketScore.bandClass || bandToStatusClass_(sleepBand);
  const loadBandClass = loadBucketScore.bandClass || bandToStatusClass_(loadBand);
  const activityBandClass = activityBucketScore.bandClass || bandToStatusClass_(activityBand);
  const workBandClass = workBucketScore.bandClass || bandToStatusClass_(workBand);

  const sleepBandLabel = sleepBucketScore.bandLabel || bandToLabel_(sleepBand);
  const loadBandLabel = loadBucketScore.bandLabel || bandToLabel_(loadBand);
  const activityBandLabel = activityBucketScore.bandLabel || bandToLabel_(activityBand);
  const workBandLabel = workBucketScore.bandLabel || bandToLabel_(workBand);

  const sleepGradeLetter = sleepBucketScore.grade || gradeFromScore_(sleepBucketScore.score).grade;
  const loadGradeLetter = loadBucketScore.grade || gradeFromScore_(loadBucketScore.score).grade;
  const activityGradeLetter = activityBucketScore.grade || gradeFromScore_(activityBucketScore.score).grade;
  const workGradeLetter = workBucketScore.grade || gradeFromScore_(workBucketScore.score).grade;

  const sleepAcute = acutes.sleep != null ? acutes.sleep : null;
  const loadAcute = acutes.load != null ? acutes.load : null;
  const activityAcute = acutes.activity != null ? acutes.activity : null;
  const workAcute = acutes.work != null ? acutes.work : null;

  const addMetricBlock = ({
    label,
    weeklyValue,
    trendValue,
    goalValue,
    valueFormatter,
    deltaOptions = {},
    badgeBand
  }) => {
    const baseRow = {
      metric: label,
      current: formatOrDash_(weeklyValue, valueFormatter),
      average: formatOrDash_(trendValue, valueFormatter),
      acute: '—',
      target: formatOrDash_(goalValue, valueFormatter),
      fourWeekGoal: '—'
    };
    const badge = mapBandToBadge_(badgeBand);
    if (badge && badge.label !== 'Data gap') {
      baseRow.badge = badge;
    } else if (goalValue == null) {
      baseRow.badge = { className: 'status-neutral', label: 'Goal missing' };
    }
    rows.push(baseRow);

    if (trendValue != null && goalValue != null) {
      rows.push({
        metric: buildIndentedLabel_('4-wk vs Goal'),
        current: '—',
        average: '—',
        acute: '—',
        target: formatOrDash_(goalValue, valueFormatter),
        fourWeekGoal: formatDeltaArrow(trendValue, goalValue, deltaOptions)
      });
    }

    if (weeklyValue != null && trendValue != null) {
      rows.push({
        metric: buildIndentedLabel_('This Week vs 4-wk'),
        current: '—',
        average: '—',
        acute: formatDeltaArrow(weeklyValue, trendValue, deltaOptions),
        target: '—',
        fourWeekGoal: '—'
      });
    }
  };

  // Sleep block
  addMetricBlock({
    label: 'Sleep (min)',
    weeklyValue: weekly.sleep,
    trendValue: trend.sleep,
    goalValue: goals.sleepMinutes || null,
    valueFormatter: fmtHMin,
    deltaOptions: { units: 'minutes' },
    badgeBand: sleepBucketScore.band
  });

  const sleepSd = sleepConsistency?.sdMinutes;
  rows.push({
    metric: 'Sleep SD (min)',
    current: sleepSd != null ? fmtDurationMinutes_(sleepSd) : '—',
    average: '—',
    acute: '—',
    target: '≤30m',
    fourWeekGoal: '—'
  });

  // RHR
  const rhrCurrent = weekly.rhr;
  const rhrTrend = trend.rhr;
  const rhrGoalFormatted = goals.restingHeartRate ? fmtBpm(goals.restingHeartRate) : '—';
  const rhrDeltaArrow = (rhrCurrent != null && rhrTrend != null)
    ? formatDeltaArrow(rhrCurrent, rhrTrend, { units: 'bpm', decimals: 0 })
    : '—';
  rows.push({
    metric: 'RHR (bpm)',
    current: formatOrDash_(rhrCurrent, fmtBpm),
    average: formatOrDash_(rhrTrend, fmtBpm),
    acute: '—',
    target: rhrGoalFormatted,
    fourWeekGoal: '—'
  });
  if (rhrTrend != null && goals.restingHeartRate) {
    rows.push({
      metric: buildIndentedLabel_('4-wk vs Goal'),
      current: '—',
      average: '—',
      acute: '—',
      target: rhrGoalFormatted,
      fourWeekGoal: formatDeltaArrow(rhrTrend, goals.restingHeartRate, { units: 'bpm', decimals: 0 })
    });
  }
  if (rhrDeltaArrow !== '—') {
    rows.push({
      metric: buildIndentedLabel_('This Week vs 4-wk'),
      current: '—',
      average: '—',
      acute: rhrDeltaArrow,
      target: '—',
      fourWeekGoal: '—'
    });
  }

  // Training load block
  addMetricBlock({
    label: 'Training Load (kg)',
    weeklyValue: weekly.trainingLoad,
    trendValue: trend.trainingLoad,
    goalValue: goals.weeklyTrainingLoad || null,
    valueFormatter: value => `${fmtInt(value)}kg`,
    deltaOptions: { units: 'kg' },
    badgeBand: loadBucketScore.band
  });

  // ACWR remains acute gate
  rows.push({
    metric: 'ACWR',
    current: acwrValue != null ? Number(acwrValue).toFixed(2) : '—',
    average: '1.00',
    acute: acwrValue != null ? formatDeltaArrow(acwrValue, 1, { units: 'ratio', decimals: 2 }) : '—',
    target: '0.8–1.3',
    fourWeekGoal: '—'
  });

  // Steps block
  addMetricBlock({
    label: 'Steps (k)',
    weeklyValue: weekly.steps,
    trendValue: trend.steps,
    goalValue: goals.steps || null,
    valueFormatter: fmtSteps_,
    deltaOptions: { units: 'steps-diff' },
    badgeBand: activityBucketScore.band
  });

  // Work hours block
  addMetricBlock({
    label: 'Work Hours',
    weeklyValue: weekly.workHours,
    trendValue: trend.workHours,
    goalValue: goals.weeklyWorkHours || null,
    valueFormatter: value => `${Math.round(value)}h`,
    deltaOptions: { units: 'hours', decimals: 1 },
    badgeBand: workBucketScore.band
  });

  return rows;
}

/**
 * Builds composite readiness/output summary from historical weekly data
 * 
 * Aggregates sleep, output, and trends over 4-8 week window
 * Used for readiness/output tiles and trend displays
 * 
 * @param {Object} config - Configuration object
 *   - weeklyRollups: Array of historical week data
 *   - weekly: Current week data {sleep, workHours, steps}
 *   - goals: User targets
 *   - acwrValue: Current ACWR ratio
 *   - sleepConsistencySd: Current sleep SD
 *   - weekMeta: Week info {start, label, number}
 * @return {Object} Composite with readiness/output pct, trends, cautions
 */
function buildCompositeSummary_({
  weeklyRollups = [],
  weekly = {},
  goals = {},
  acwrValue = null,
  sleepConsistencySd = null,
  weekMeta = null,
  readinessPct: rollupReadinessPct = null,
  outputPct: rollupOutputPct = null
} = {}) {
  const toNumber = value => {
    if (value == null || value === '') return null;
    const num = Number(value);
    return isFinite(num) ? num : null;
  };

  const DEBUG_COMPOSITE_PLAN = false; // Set to true to enable detailed logging

  const currentWeekStartIso = weekMeta?.start ? formatDateIso_(weekMeta.start) : formatDateIso_(new Date());

  const parsed = (weeklyRollups || [])
    .map(row => {
      let weekStart = String(row.week_start || row.weekStart || '').trim();
      // Strip leading apostrophe from text-formatted cells
      weekStart = stripLeadingApostrophe_(weekStart);
      if (!weekStart) return null;
      return {
        weekStart,
        sleepMinAvg: toNumber(row.sleep_min_avg ?? row.sleepMinAvg),
        sleepSdMin: toNumber(row.sleep_sd_min ?? row.sleepSdMin),
        rhrAvg: toNumber(row.rhr_avg ?? row.rhrAvg),
        stepsDayAvg: toNumber(row.steps_day_avg ?? row.stepsDayAvg),
        gymLoadSum: toNumber(row.gym_load_sum ?? row.gymLoadSum),
        workHoursSum: toNumber(row.work_hours_sum ?? row.workHoursSum),
        acwr: toNumber(row.acwr),
        readinessPct: toNumber(row.readiness_pct ?? row.readinessPct),
        outputPct: toNumber(row.output_pct ?? row.outputPct),
        dataGaps: toNumber(row.data_gaps ?? row.dataGaps),
        sleepDaysPresent: toNumber(row.sleep_days_present ?? row.sleepDaysPresent),
        activityDaysPresent: toNumber(row.activity_days_present ?? row.activityDaysPresent)
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));

  const ensureCurrentEntry = () => {
    const candidate = {
      weekStart: currentWeekStartIso,
      sleepMinAvg: toNumber(weekly.sleep),
      sleepSdMin: toNumber(sleepConsistencySd),
      rhrAvg: toNumber(weekly.rhr),
      stepsDayAvg: toNumber(weekly.steps),
      gymLoadSum: toNumber(weekly.trainingLoad),
      workHoursSum: toNumber(weekly.workHours),
      acwr: toNumber(acwrValue),
      readinessPct: toNumber(rollupReadinessPct),
      outputPct: toNumber(rollupOutputPct)
    };
    const hasData = ['sleepMinAvg', 'sleepSdMin', 'rhrAvg', 'stepsDayAvg', 'gymLoadSum', 'workHoursSum', 'acwr'].some(key => candidate[key] != null && isFinite(candidate[key]));
    if (!hasData) return;
    
    // Check if this week already exists anywhere in the array
    const existing = parsed.find(entry => entry.weekStart === currentWeekStartIso);
    if (existing) {
      // Update existing entry with any new data
      Object.keys(candidate).forEach(key => {
        if (candidate[key] != null && (existing[key] == null || !isFinite(existing[key]))) {
          existing[key] = candidate[key];
        }
      });
      return;
    }
    
    // Only add if it doesn't exist
    parsed.push(candidate);
  };

  if (DEBUG_COMPOSITE_PLAN) {
    Logger.log(`Before ensureCurrentEntry: ${parsed.length} weeks, last 5: ${parsed.slice(-5).map(e => e.weekStart).join(', ')}`);
    Logger.log(`currentWeekStartIso: ${currentWeekStartIso}`);
  }
  ensureCurrentEntry();
  if (DEBUG_COMPOSITE_PLAN) {
    Logger.log(`After ensureCurrentEntry: ${parsed.length} weeks, last 5: ${parsed.slice(-5).map(e => e.weekStart).join(', ')}`);
  }

  // Filter to only complete weeks (data_gaps = 0) before taking the last 4
  // Incomplete weeks should not be included in the 4-week composite calculation
  const completeWeeks = parsed.filter(entry => {
    const gaps = entry.dataGaps != null ? Number(entry.dataGaps) : null;
    return gaps === 0;
  });
  if (DEBUG_COMPOSITE_PLAN) {
    Logger.log(`Complete weeks (data_gaps=0): ${completeWeeks.length} weeks, last 5: ${completeWeeks.slice(-5).map(e => e.weekStart).join(', ')}`);
  }

  const lastEntries = completeWeeks.slice(-4).reverse(); // newest first, only complete weeks
  if (DEBUG_COMPOSITE_PLAN) {
    Logger.log(`lastEntries (after reverse): ${lastEntries.map(e => e.weekStart).join(', ')}`);
  }

  if (!lastEntries.length) {
    return {
      readiness: { pct: null, trend: null, subtitle: 'Readiness data missing — log recovery inputs.' },
      output: { pct: null, trend: null, subtitle: 'Output data missing — keep execution logs.' },
      plan: { code: 'HOLD', balance: null, narrative: 'Data limited this week — log core metrics daily.' },
      series: { readiness: [], output: [] }
    };
  }

  const sleepGoal = goals.sleepMinutes != null ? Number(goals.sleepMinutes) : null;
  const rhrGoal = goals.restingHeartRate != null ? Number(goals.restingHeartRate) : null;
  const stepsGoal = goals.steps != null ? Number(goals.steps) : null;
  const workGoal = goals.weeklyWorkHours != null ? Number(goals.weeklyWorkHours) : null;
  const gymGoal = goals.weeklyTrainingLoad != null ? Number(goals.weeklyTrainingLoad) : null;

  const readinessPerWeek = [];
  const outputPerWeek = [];
  const latestEntry = lastEntries[0] || null;

  if (DEBUG_COMPOSITE_PLAN) {
    Logger.log(`=== buildCompositePlan: Processing ${lastEntries.length} weeks ===`);
  }
  lastEntries.forEach((entry, idx) => {
    if (DEBUG_COMPOSITE_PLAN) {
      Logger.log(`Week ${idx}: ${entry.weekStart} | gym=${entry.gymLoadSum}, steps=${entry.stepsDayAvg}, work=${entry.workHoursSum}, output_pct=${entry.outputPct}`);
    }
    
    const sleepPct = pctOfGoal_(entry.sleepMinAvg, sleepGoal);
    const rhrScore = mapRhrDeltaToPct_(entry.rhrAvg, rhrGoal);
    const sdScore = mapSdToPct_(entry.sleepSdMin);
    const acwrScore = mapAcwrToPct_(entry.acwr != null ? entry.acwr : acwrValue);

    const readinessVal = entry.readinessPct != null && isFinite(entry.readinessPct)
      ? entry.readinessPct
      : weightedAverage_([
          [0.4, sleepPct],
          [0.3, rhrScore],
          [0.2, sdScore],
          [0.1, acwrScore]
        ]);
    readinessPerWeek.push(readinessVal != null && isFinite(readinessVal) ? readinessVal : null);

    const gymPct = pctOfGoal_(entry.gymLoadSum, gymGoal);
    const stepsPct = pctOfGoal_(entry.stepsDayAvg, stepsGoal);
    const workPct = pctOfGoal_(entry.workHoursSum, workGoal);

    const outputVal = entry.outputPct != null && isFinite(entry.outputPct)
      ? entry.outputPct
      : weightedAverage_([
          [0.4, gymPct],
          [0.3, stepsPct],
          [0.3, workPct]
        ]);
    if (DEBUG_COMPOSITE_PLAN) {
      Logger.log(`  -> outputVal for this week: ${outputVal} (from rollup: ${entry.outputPct})`);
    }
    outputPerWeek.push(outputVal != null && isFinite(outputVal) ? outputVal : null);
  });

  if (DEBUG_COMPOSITE_PLAN) {
    Logger.log(`outputPerWeek array: [${outputPerWeek.join(', ')}]`);
  }
  const readinessBlend = recencyBlend4w_(readinessPerWeek, [0.4, 0.3, 0.2, 0.1]);
  const outputBlend = recencyBlend4w_(outputPerWeek, [0.5, 0.25, 0.15, 0.10]);
  if (DEBUG_COMPOSITE_PLAN) {
    Logger.log(`outputBlend result: ${outputBlend}`);
  }

  const readinessPct = readinessBlend != null ? pctClamp_(readinessBlend) : null;
  const outputPct = outputBlend != null ? pctClamp_(outputBlend) : null;

  const readinessTrendRaw = readinessPerWeek.length > 1 ? trendDelta_(readinessPerWeek[0], readinessPerWeek[1]) : null;
  const outputTrendRaw = outputPerWeek.length > 1 ? trendDelta_(outputPerWeek[0], outputPerWeek[1]) : null;

  const readinessTrend = readinessTrendRaw != null ? Math.round(readinessTrendRaw) : null;
  const outputTrend = outputTrendRaw != null ? Math.round(outputTrendRaw) : null;

  const balance = (readinessPct != null && outputPct != null) ? readinessPct - outputPct : null;
  let planCode = 'HOLD';
  if (balance != null) {
    if (balance >= 8) planCode = 'PUSH';
    else if (balance <= -8) planCode = 'RECOVER';
    else planCode = 'HOLD';
  }
  const narrative = buildPlanSummaryText_(readinessPct, outputPct, readinessTrend, outputTrend, balance);

  return {
    readiness: {
      pct: readinessPct,
      trend: readinessTrend,
      subtitle: copyReadiness_(readinessPct, readinessTrend)
    },
    output: {
      pct: outputPct,
      trend: outputTrend,
      subtitle: copyOutput_(outputPct, outputTrend)
    },
    plan: {
      code: planCode,
      balance,
      narrative
    },
    series: {
      readiness: readinessPerWeek,
      output: outputPerWeek
    },
    latest: latestEntry || null
  };
}
