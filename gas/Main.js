// ==== Main.gs ====
// Delta-first display, Purple capacity, stats moved to Appendix, missing days surfaced
// NOTE: All constants are now in Constants.gs (CONFIG, COACH, schema, etc.)
// VERSION: Code quality refactor - removed duplicate describeScore, extracted shared helpers, 2-sentence short opening

const COACH_VOICE = {
  sleep: {
    success: { directive: 'Maintain bedtime window 22:30–06:30.', check: 'Recheck in 7 days.' },
    warning: { directive: 'Lock lights-out at 22:30; screens off by 21:30.', check: 'Recheck in 7 days.' },
    danger: { directive: 'Fix lights-out 22:30 and anchor wake 06:30.', check: 'Recheck in 7 days.' },
    neutral: { directive: 'Collect sleep data nightly.', check: 'Recheck in 7 days.' }
  },
  load: {
    under: { directive: 'Add +8% volume; keep RPE ≤8.', check: 'Review Sunday.' },
    inBand: { directive: 'Keep volume steady.', check: 'Next check in 48h.' },
    overreach: { directive: 'Hold load flat; review fatigue notes nightly.', check: 'Review Friday.' },
    highRisk: { directive: 'Deload 30% volume now; prioritise recovery.', check: 'Resume base Monday.' },
    unknown: { directive: 'Collect load data before ramping.', check: 'Review next report.' }
  },
  cardio: {
    success: { directive: 'Keep post-dinner walk 20 minutes.', check: 'Check totals Sunday.' },
    warning: { directive: 'Walk 30 min after dinner today.', check: 'Hit floor on 5 of 7 days.' },
    danger: { directive: 'Schedule two 30 min brisk walks tomorrow.', check: 'Audit steps in 48h.' },
    neutral: { directive: 'Log daily steps to restore confidence.', check: 'Review Sunday.' }
  },
  work: {
    success: { directive: 'Protect two daily focus blocks.', check: 'Check calendar Friday.' },
    warning: { directive: 'Schedule two 120-min deep-work blocks now.', check: 'Confirm progress Thursday.' },
    danger: { directive: 'Book focus blocks and clear distractions.', check: 'Review bandwidth mid-week.' },
    neutral: { directive: 'Record work hours nightly.', check: 'Audit at week end.' }
  }
};

const OBS_LABELS = {
  success: 'Stable',
  warning: 'Moderate deficit',
  danger: 'Severe deficit',
  neutral: 'Data gap'
};

function main() {
  return weeklyReportJob();
}


/**
 * Backwards-compatible entry point for manual runs in the Apps Script UI.
 * Proxies to the full weekly job so choosing “main” still sends the report email.
 */

function extractJsonFromText_(rawText) {
  if (!rawText) return '';
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```json([\s\S]*?)```/i) || trimmed.match(/```([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseAiReportJson_(rawText) {
  const jsonSnippet = extractJsonFromText_(rawText);
  if (!jsonSnippet) {
    return { ok: false, error: 'empty_response' };
  }
  try {
    const parsed = JSON.parse(jsonSnippet);
    return { ok: true, data: parsed };
  } catch (err) {
    return { ok: false, error: `parse_error: ${err.message}` };
  }
}

const MILLISECONDS_PER_WEEK = 604800000;

function computeIsoWeekNumber_(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const daysDifference = Math.floor((target - firstThursday) / MILLISECONDS_PER_WEEK);
  const weekNumber = 1 + daysDifference;
  return weekNumber;
}

function formatDateIso_(date) {
  const d = new Date(date);
  if (isNaN(d)) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekMetadataForReport_() {
  const bounds = typeof getWeekBounds_ === 'function' ? getWeekBounds_() : null;
  const start = bounds ? new Date(bounds[0]) : new Date();
  const end = bounds ? new Date(bounds[1]) : new Date(start.getTime() + 6 * 86400000);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const isoWeek = computeIsoWeekNumber_(start);
  const label = `WEEK OF ${formatDateIso_(start)}`;
  return {
    start,
    end,
    isoWeek,
    label,
    isoLabel: `Week ${isoWeek}`
  };
}

function buildFallbackReport_(scores, derived, baselineSections, decision) {
  if (!scores || !derived || !baselineSections || !decision) {
    logWeeklyJob_('buildFallbackReport_:invalid_inputs', {});
    throw new Error('buildFallbackReport_ requires all parameters');
  }

  const fulfil = derived?.fulfilment || {};
  const sleepConsistency = derived?.sleep?.consistency || {};

  const fmtFul = (pct) => {
    if (pct == null) return 'no percent insight';
    return `${Math.round(pct)} percent`;
  };

  const insights = [
    `Performance index sits at ${scores.activity}/100 with activity fulfilment ${fmtFul(fulfil.workPct)} and strength fulfilment ${fmtFul(fulfil.strengthPct)}.`,
    `Sleep fulfilment is ${fmtFul(fulfil.sleepPct)}; consistency reads ${sleepConsistency.score != null ? `${sleepConsistency.score}/100 (${sleepConsistency.label || 'Data Gaps'})` : 'Data Gaps'}.`,
    `Readiness trends ${fmtFul(fulfil.rhrPct)}; recommendation stays ${decision.plan} — ${decision.lever}.`
  ];

  const decisionNotes = decision?.notes || [];

  return {
    metadata: { version: REPORT_SCHEMA_VERSION, model: 'fallback' },
    insights,
    sections: {
      activity: {
        title: DEFAULT_ACTIVITY_TITLE,
        bullets: (baselineSections?.activityBullets || []),
        notes: []
      },
      recovery: {
        title: DEFAULT_RECOVERY_TITLE,
        bullets: (baselineSections?.recoveryBullets || []),
        notes: []
      },
      readiness: {
        title: DEFAULT_READINESS_TITLE,
        bullets: (baselineSections?.readinessBullets || []),
        notes: []
      }
    },
    coachCall: baselineSections.coachCall || '',
    recommendations: FALLBACK_RECOMMENDATIONS.slice(),
    decision: {
      plan: decision?.plan || 'Maintain',
      lever: decision?.lever || 'Keep core habits steady',
      notes: decisionNotes
    },
    warnings: derived?.warnings || [],
    prose: ''
  };
}

function mergeAiWithFallback_(aiReport, fallbackReport) {
  if (!aiReport) {
    return { report: fallbackReport, degraded: true, reason: 'parse_or_schema_fail' };
  }

  const merged = {
    ...fallbackReport,
    metadata: {
      version: aiReport.metadata?.version || fallbackReport.metadata.version,
      model: aiReport.metadata?.model || fallbackReport.metadata.model
    }
  };

  const EXPECTED_INSIGHTS_COUNT = 3;
  if (Array.isArray(aiReport.insights) && aiReport.insights.length === EXPECTED_INSIGHTS_COUNT) {
    merged.insights = aiReport.insights;
  }

  REPORT_SECTION_KEYS.forEach(key => {
    const section = aiReport.sections?.[key];
    if (!section) return;
    const mergedSection = merged.sections[key] || {};
    merged.sections[key] = { ...mergedSection, ...section };
  });

  if (aiReport.recommendations?.length) {
    merged.recommendations = aiReport.recommendations;
  }

  if (aiReport.decision) {
    merged.decision = {
      plan: aiReport.decision.plan || merged.decision.plan,
      lever: aiReport.decision.lever || merged.decision.lever,
      notes: Array.isArray(aiReport.decision.notes) && aiReport.decision.notes.length
        ? aiReport.decision.notes
        : merged.decision.notes
    };
  }

  if (aiReport.warnings?.length) {
    merged.warnings = aiReport.warnings;
  }
  if (aiReport.prose) merged.prose = aiReport.prose;

  return { report: merged, degraded: false, reason: '' };
}

function composeCoachInsight_(observation, directive, check) {
  const parts = [observation, directive, check]
    .map(ensureSentence_)
    .filter(Boolean);
  return parts.join(' ');
}










function copyReadiness_(pct, trend) {
  if (pct == null || !isFinite(pct)) return 'Readiness data missing — log recovery inputs.';
  let base;
  if (pct >= 85) base = 'Capacity high — ready to build.';
  else if (pct >= 70) base = 'Moderate capacity — maintain rhythm.';
  else base = 'Recovery limited — protect sleep.';
  return appendTrendCue_(base, trend);
}

function copyOutput_(pct, trend) {
  if (pct == null || !isFinite(pct)) return 'Output data missing — keep execution logs.';
  let base;
  if (pct >= 90) base = 'Strong execution.';
  else if (pct >= 75) base = 'Below optimal stimulus.';
  else base = 'Under-stimulus — raise base.';
  return appendTrendCue_(base, trend);
}

function buildObservationTag_(label, delta, positiveIsGood = true) {
  const base = label || 'Data gap';
  if (delta == null || !isFinite(delta) || Math.abs(delta) <= 1) return `${base} →`;
  const arrow = delta > 0 ? '↑' : '↓';
  if (!positiveIsGood) {
    return `${base} ${arrow}`;
  }
  return `${base} ${arrow}`;
}

function lerp_(a, b, t) {
  return a + (b - a) * t;
}

function computeConsistencyScore_(sdMinutes) {
  if (sdMinutes == null || !isFinite(sdMinutes)) return null;
  const sd = Math.max(0, sdMinutes);
  if (sd <= 15) return 100;
  if (sd <= 30) return Math.round(lerp_(85, 100, (30 - sd) / 15));
  if (sd <= 45) return Math.round(lerp_(70, 85, (45 - sd) / 15));
  if (sd <= 60) return Math.round(lerp_(50, 70, (60 - sd) / 15));
  return 30;
}

function computeRhrScore_(deltaBpm) {
  if (deltaBpm == null || !isFinite(deltaBpm)) return null;
  const d = Math.abs(deltaBpm);
  if (d <= 1) return 95;
  if (d <= 3) return 85;
  if (d <= 5) return 70;
  if (d <= 8) return 50;
  return 30;
}

function sleepBandLabel_(sdMinutes) {
  if (typeof sleepBandLabelFromSd_ === 'function') {
    return sleepBandLabelFromSd_(sdMinutes);
  }
  if (sdMinutes == null || !isFinite(sdMinutes)) return 'Data gap';
  if (sdMinutes <= 15) return 'Elite';
  if (sdMinutes <= 30) return 'Stable';
  if (sdMinutes <= 45) return 'Drifting';
  if (sdMinutes <= 60) return 'Irregular';
  return 'Chaotic';
}


function mapAcwrToScore_(acwr) {
  if (acwr == null || !isFinite(acwr)) return null;
  if (acwr <= 0.7 || acwr >= 1.3) return 60;
  const points = [
    [0.70, 70], [0.85, 85], [1.00, 100], [1.15, 85], [1.30, 70]
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (acwr >= x1 && acwr <= x2) {
      const t = (acwr - x1) / (x2 - x1);
      return Math.round(lerp_(y1, y2, t));
    }
  }
  return 100;
}














function summariseRecoveryInsight_({ band, className, delta, rhrDelta }) {
  const voiceKey = mapStatusClassToVoiceKey_(className);
  const voice = COACH_VOICE.sleep[voiceKey] || COACH_VOICE.sleep.neutral;
  let observation = normalizeObservationText_(describeSeverity_(band, delta, { positiveIsGood: true })) || 'Sleep status unclear';
  const rhrDeltaInt = rhrDelta != null && isFinite(rhrDelta) ? Math.round(rhrDelta) : null;
  if (rhrDeltaInt != null) {
    if (rhrDeltaInt >= CONFIG.RHR.redDelta) {
      observation = `Sleep strain high, RHR up ${rhrDeltaInt} bpm`;
    } else if (rhrDeltaInt >= CONFIG.RHR.amberDelta) {
      observation = `${observation}, RHR up ${rhrDeltaInt} bpm`;
    } else if (rhrDeltaInt <= -CONFIG.RHR.amberDelta) {
      observation = `${observation}, RHR down ${Math.abs(rhrDeltaInt)} bpm`;
    }
  }
  observation = normalizeObservationText_(observation);
  return composeCoachInsight_(observation, voice.directive, voice.check);
}

function summariseWorkloadInsight_({ acwrValue, loadPct, rhrDelta, band }) {
  const severityLabel = loadSeverityLabel_(acwrValue, rhrDelta);
  const observationBase = severityLabel && severityLabel !== 'Unknown'
    ? severityLabel
    : normalizeObservationText_(describeSeverity_(band, loadPct, { positiveIsGood: false })) || 'Load status unclear';
  const positiveIsGood = severityLabel === 'Under-stimulus';
  const trendWord = describeTrendWord_(loadPct, {
    positiveIsGood,
    tolerance: 3,
    upWord: positiveIsGood ? 'improving' : 'rising',
    downWord: positiveIsGood ? 'sliding' : 'easing'
  });
  const observation = normalizeObservationText_(trendWord
    ? `${observationBase}, ${trendWord}`
    : `${observationBase}, stable`);
  const severityVoiceKeyMap = {
    'Under-stimulus': 'under',
    'In band': 'inBand',
    'Overreach': 'overreach',
    'High risk': 'highRisk'
  };
  const voiceKey = severityVoiceKeyMap[severityLabel] || 'unknown';
  const voice = COACH_VOICE.load[voiceKey] || COACH_VOICE.load.unknown;
  return composeCoachInsight_(observation, voice.directive, voice.check);
}

function summariseActivityInsight_({ band, stepsDeltaPct, floorDays, floorTarget }) {
  const voiceKey = COACH_VOICE.cardio[band] ? band : mapBandToVoiceKey_(band);
  const voice = COACH_VOICE.cardio[voiceKey] || COACH_VOICE.cardio.neutral;
  const trendWord = describeTrendWord_(stepsDeltaPct, { positiveIsGood: true, tolerance: 3, upWord: 'improving', downWord: 'sliding' });
  let observation;
  if (floorDays != null && floorTarget != null && floorTarget > 0 && floorDays < floorTarget) {
    observation = `Floor short (${floorDays}/${floorTarget}), ${trendWord}`;
  } else {
    const base = normalizeObservationText_(describeSeverity_(band, stepsDeltaPct, { positiveIsGood: true })) || 'Movement status unclear';
    observation = trendWord === 'stable' ? `${base}, stable` : `${base}, ${trendWord}`;
  }
  observation = normalizeObservationText_(observation);
  return composeCoachInsight_(observation, voice.directive, voice.check);
}

function summariseCognitionInsight_({ workHours, goalHours, trendHours, band, delta }) {
  const voiceKey = COACH_VOICE.work[band] ? band : mapBandToVoiceKey_(band);
  const voice = COACH_VOICE.work[voiceKey] || COACH_VOICE.work.neutral;
  let observation;
  if (workHours == null) {
    observation = 'Work data missing';
  } else if (goalHours && workHours > goalHours * 1.1) {
    observation = `Over goal by ${Math.round(workHours - goalHours)}h`;
  } else if (trendHours && workHours < trendHours * 0.9) {
    observation = `Bandwidth down ${Math.round(trendHours - workHours)}h`;
  } else {
    observation = normalizeObservationText_(describeSeverity_(band, delta, { positiveIsGood: false })) || 'Bandwidth steady';
  }
  if (workHours != null) {
    const trendWord = describeTrendWord_(delta, { positiveIsGood: false, tolerance: 2, upWord: 'rising', downWord: 'easing' });
    observation = normalizeObservationText_(trendWord === 'stable' ? `${observation}, stable` : `${observation}, ${trendWord}`);
  } else {
    observation = normalizeObservationText_(observation);
  }
  return composeCoachInsight_(observation, voice.directive, voice.check);
}

// Builder functions extracted to Builders.js:
// - buildSystemDriverCards_()
// - buildComponentRows_()
// - buildCompositeSummary_()

function weeklyReportJob() {
  let weekMeta = getWeekMetadataForReport_();
  logWeeklyJob_('weekly_job:start', { week: weekMeta?.label || 'unknown', iso: weekMeta?.isoLabel || '' });
  let stage = 'init';
  const degradeReasons = [];
  let aiParseOk = false;
  let schemaDiag = '';
  let aiParseError = '';
  const referenceDate = new Date();
  referenceDate.setDate(referenceDate.getDate() - 7);
  setWeekReferenceOverride(referenceDate);
  logWeeklyJob_('weekly_job:reference_set', { referenceDate: referenceDate.toISOString() });
  try {
    stage = 'schema_validation';
    logWeeklyJob_('weekly_job:stage', { stage });
    const schemaCheck = validateDataSchema_();
    logWeeklyJob_('weekly_job:schema_validation_result', { ok: schemaCheck.ok, errors: schemaCheck.errors });
    if (!schemaCheck.ok) {
      sendSchemaFailureEmail_(schemaCheck.errors, weekMeta);
      return;
    }

    stage = 'load_goals';
    logWeeklyJob_('weekly_job:stage', { stage });
    const USER_GOALS = getUserGoals();
    if (!USER_GOALS) {
      logWeeklyJob_('weekly_job:goals_missing', {});
      sendJobFailureEmail_(weekMeta, stage, new Error('Could not load goals from the "Goals" tab.'));
      return;
    }
    logWeeklyJob_('weekly_job:goals_loaded', { goalKeys: Object.keys(USER_GOALS || {}).length });

    stage = 'load_weekly_data';
    logWeeklyJob_('weekly_job:stage', { stage });
    
    const rollupData = getLatestCompleteWeekFromRollups();
    let weekly = null;
    let usedRollup = false;
    
    if (rollupData) {
      weekly = {
        steps:        rollupData.steps_day_avg || null,
        trainingLoad: rollupData.gym_load_sum || null,
        workHours:    rollupData.work_hours_sum || null,
        prs:          rollupData.prs_sum || null,
        sleep:        rollupData.sleep_min_avg || null,
        rhr:          rollupData.rhr_avg || null,
        readinessPct: rollupData.readiness_pct || null,
        outputPct:    rollupData.output_pct || null,
        sleepSd:      rollupData.sleep_sd_min || null
      };
      usedRollup = true;
      
      // Parse dates as local time (not UTC) to avoid timezone shifts
      function parseLocalDate(dateValue) {
        if (dateValue instanceof Date) {
          return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
        }
        const parts = String(dateValue).split('-');
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }

      const rollupStart = parseLocalDate(rollupData.week_start);
      const rollupEnd = parseLocalDate(rollupData.week_end);
      
      Logger.log(`Loaded rollup: week_start=${rollupData.week_start}, week_end=${rollupData.week_end}, data_gaps=${rollupData.data_gaps}`);
      Logger.log(`Parsed to: rollupStart=${rollupStart}, rollupEnd=${rollupEnd}`);
      
      if (!rollupStart || !rollupEnd) {
        Logger.log('Invalid date format in rollup data');
        return;
      }
      
      const isoWeek = computeIsoWeekNumber_(rollupStart);
      weekMeta = {
        start: rollupStart,
        end: rollupEnd,
        isoWeek,
        label: `WEEK OF ${formatDateIso_(rollupStart)}`,
        isoLabel: `Week ${isoWeek}`
      };
      
      // Calculate component percentages from rollup data for AI narrative
      function calculatePercentage(actual, goal) {
        if (!actual || !goal) return null;
        return Math.round((actual / goal) * 100);
      }

      const rollupFulfil = {
        sleepPct: calculatePercentage(rollupData.sleep_min_avg, USER_GOALS.sleepMinutes),
        loadPct: calculatePercentage(rollupData.gym_load_sum, USER_GOALS.weeklyTrainingLoad),
        stepsPct: calculatePercentage(rollupData.steps_day_avg, USER_GOALS.steps),
        workPct: calculatePercentage(rollupData.work_hours_sum, USER_GOALS.weeklyWorkHours)
      };
      weekly.rollupFulfil = rollupFulfil;
      
      logWeeklyJob_('weekly_job:loaded_from_rollups', {
        weekStart: rollupData.week_start,
        weekEnd: rollupData.week_end,
        dataGaps: rollupData.data_gaps
      });
    } else {
      weekly = {
        steps:        getWeeklyAverageFromActivity('steps'),
        trainingLoad: getWeeklySumFromActivity('volume_kg'),
        workHours:    getWeeklySumFromActivity('working hours'),
        prs:          getWeeklySumFromActivity('prs') || null,
        sleep:        getWeeklyAverage('Sleep', 'sleep_total_min'),
        rhr:          getWeeklyAverage('HeartRate', 'resting_heart_rate')
      };
      logWeeklyJob_('weekly_job:fallback_to_raw_data', {});
    }
    
    const missingWeeklyFields = [];
    if (typeof weekly.steps !== 'number') { weekly.steps = null; missingWeeklyFields.push('Activity'); }
    if (typeof weekly.sleep !== 'number') { weekly.sleep = null; missingWeeklyFields.push('Sleep'); }
    if (typeof weekly.rhr !== 'number') { weekly.rhr = null; missingWeeklyFields.push('HeartRate'); }
    if (missingWeeklyFields.length) {
      degradeReasons.push(`missing_weekly_data:${missingWeeklyFields.join(',')}`);
      logWeeklyJob_('weekly_job:weekly_data_missing', { missing: missingWeeklyFields });
    }
    logWeeklyJob_('weekly_job:weekly_data_loaded', {
      steps: weekly.steps,
      sleep: weekly.sleep,
      rhr: weekly.rhr,
      trainingLoad: weekly.trainingLoad,
      workHours: weekly.workHours,
      source: usedRollup ? 'WeeklyRollups' : 'raw_data'
    });

    stage = 'load_trend_data';
    logWeeklyJob_('weekly_job:stage', { stage });
    const trend = {
      steps:         get4WeekAverageFromActivity('steps', 'avg'),
      trainingLoad:  get4WeekAverageFromActivity('volume_kg', 'sum'),
      workHours:     get4WeekAverageFromActivity('working hours', 'sum'),
      prs:           get4WeekAverageFromActivity('prs', 'sum') || 0,
      sleep:         get4WeekAverage('Sleep', 'sleep_total_min'),
      rhr:           get4WeekAverage('HeartRate', 'resting_heart_rate')
    };
    logWeeklyJob_('weekly_job:trend_data_loaded', {
      steps: trend.steps,
      sleep: trend.sleep,
      rhr: trend.rhr,
      trainingLoad: trend.trainingLoad,
      workHours: trend.workHours
    });

    stage = 'derive_stats';
    logWeeklyJob_('weekly_job:stage', { stage });
    const sleepConsistency = computeSleepConsistencyWeekly_();
    const acwrInfo = computeWeeklyACWR_(weekly.trainingLoad);
    weekly.sleepConsistency = sleepConsistency;
    weekly.acwr = acwrInfo;
    const derivedStats = computeDerivedStats(weekly, trend, USER_GOALS, sleepConsistency, acwrInfo);
    logWeeklyJob_('weekly_job:derived_ready', {
      degradeReasons: degradeReasons.slice(),
      hasSleepConsistency: Boolean(sleepConsistency),
      hasAcwr: Boolean(acwrInfo)
    });

    const weeklyRollups = getWeeklyRollups_(8);
    const compositeSummary = buildCompositeSummary_({
      weeklyRollups,
      weekly,
      goals: USER_GOALS,
      acwrValue: acwrInfo?.value ?? acwrInfo?.ratio ?? null,
      sleepConsistencySd: sleepConsistency?.sdMinutes ?? null,
      weekMeta,
      readinessPct: usedRollup ? weekly.readinessPct : null,
      outputPct: usedRollup ? weekly.outputPct : null
    });

    const capacity = classifyCapacityWithPurple(weekly, trend, USER_GOALS, derivedStats);
    const decision = decideNextAction(weekly, trend, USER_GOALS, derivedStats, capacity);
    logWeeklyJob_('weekly_job:decision_ready', {
      capacityStatus: capacity?.status || null,
      plan: decision?.plan || null
    });

    const perf = calculatePerformanceIndex(weekly, trend, USER_GOALS);
    const recovery  = scoreFromTarget_(weekly.sleep, USER_GOALS.sleepMinutes);
    const readiness = Math.max(0, Math.min(100, 100 - scoreFromTarget_(weekly.rhr, USER_GOALS.restingHeartRate, true)));

    const scores = {
      overall: Math.round(0.4 * perf.PI + 0.3 * recovery + 0.3 * readiness),
      activity: perf.PI,
      recovery,
      readiness,
      parts: perf.components
    };

    const rhrDeltaValueForScore = parseSignedNumber_(derivedStats?.rhr?.deltaTrendStr);
    const bucketScores = {
      sleep: scoreSleepBucket_({
        sleepThisWeek: weekly.sleep,
        sleepGoal: USER_GOALS.sleepMinutes,
        sdMinutes: sleepConsistency?.sdMinutes,
        rhrDelta: rhrDeltaValueForScore
      }),
      load: scoreLoadBucket_({
        acwr: acwrInfo?.value ?? acwrInfo?.ratio ?? null,
        loadPctVsTrend: derivedStats?.load?.pctTrend
      }),
      activity: scoreActivityBucket_({
        stepsThisWeek: weekly.steps,
        stepsGoal: USER_GOALS.steps,
        floorDays: derivedStats?.steps?.days6k,
        floorTarget: USER_GOALS.stepsFloorDays || CONFIG.Steps.fallbackFloorDays
      }),
      work: scoreWorkBucket_({
        hoursThisWeek: weekly.workHours,
        hoursGoal: USER_GOALS.weeklyWorkHours,
        deepWorkPct: derivedStats?.work?.deepWorkPct ?? null
      })
    };
    Object.values(bucketScores).forEach(bucket => {
      const gradeInfo = gradeFromScore_(bucket.score);
      bucket.grade = gradeInfo.grade;
      bucket.band = gradeInfo.band;
      bucket.bandClass = bandToStatusClass_(gradeInfo.band);
      bucket.bandLabel = bandToLabel_(gradeInfo.band);
      bucket.scoreText = bucket.score != null ? `${bucket.score}/100` : '';
    });
    const totalBucketScore = computeTotalScore_(bucketScores);
    const totalGradeInfo = gradeFromScore_(totalBucketScore);

    stage = 'ai_call';
    const fulfil = derivedStats?.fulfilment || {};
    const bands = derivedStats?.bands || {};
    const baselineSections = composeBaselineSections_(weekly, trend, USER_GOALS, derivedStats, fulfil, bands, decision, FALLBACK_RECOMMENDATIONS);
    const fallbackReport = buildFallbackReport_(scores, derivedStats, baselineSections, decision);
    if (degradeReasons.length) {
      fallbackReport.metadata.degraded = true;
      fallbackReport.metadata.degradeReason = degradeReasons.join('|');
    }

    logWeeklyJob_('weekly_job:ai_prompt_ready', {
      degradeReasons: degradeReasons.slice(),
      bucketScoreTotal: totalBucketScore
    });
    const aiResponseText = callOpenAIChat_(buildEvaluationPrompt(weekly, trend, scores, USER_GOALS, derivedStats, capacity, decision));
    logWeeklyJob_('weekly_job:ai_response_received', { hasResponse: Boolean(aiResponseText) });
    if (!aiResponseText) {
      fallbackReport.metadata.degraded = true;
      fallbackReport.metadata.degradeReason = 'empty_response';
      schemaDiag = 'empty_response';
      aiParseError = 'empty_response';
    }

    let aiReport = null;
    let degradeReason = degradeReasons.join('|');
    if (aiResponseText) {
      const parsed = parseAiReportJson_(aiResponseText);
      logWeeklyJob_('weekly_job:ai_parse_attempt', { ok: parsed.ok, error: parsed.error || null });
      if (parsed.ok) {
        const validation = validateReportSchema_(parsed.data);
        logWeeklyJob_('weekly_job:ai_schema_validation', { ok: validation.ok, errors: validation.errors || null });
        if (validation.ok) {
          aiReport = validation.report;
          aiParseOk = true;
          schemaDiag = schemaDiag || 'ok';
        } else {
          degradeReason = `schema_invalid:${validation.errors.join('|')}`;
          schemaDiag = `schema_errors: ${validation.errors.join('|')}`;
          aiParseError = schemaDiag;
        }
      } else {
        degradeReason = parsed.error;
        schemaDiag = parsed.error || 'parse_error';
        aiParseError = parsed.error || 'parse_error';
      }
    }

    const merged = mergeAiWithFallback_(aiReport, fallbackReport);
    const reportPayload = merged.report;
    const degraded = Boolean(merged.degraded || !aiReport || (degradeReason && degradeReason.length));
    reportPayload.metadata = reportPayload.metadata || {};
    reportPayload.metadata.bucketScores = bucketScores;
    reportPayload.metadata.totalBucketScore = totalBucketScore;
    reportPayload.metadata.totalGrade = totalGradeInfo.grade;
    reportPayload.metadata.totalBand = totalGradeInfo.band;

    if (compositeSummary) {
      reportPayload.metadata.composites = compositeSummary;
    }

    if (degraded) {
      reportPayload.metadata.degraded = true;
      reportPayload.metadata.degradeReason = degradeReason || merged.reason || 'unknown';
    } else {
      reportPayload.metadata.degraded = false;
      reportPayload.metadata.degradeReason = '';
    }

    if (reportPayload.metadata.degradeReason && /coach_call_missing/i.test(reportPayload.metadata.degradeReason)) {
      const planKey = (reportPayload.decision?.plan || compositeSummary?.plan?.code || 'Hold').toString().toLowerCase();
      const fallbackCoachMap = {
        push: 'Push with measured progression; monitor readiness daily.',
        hold: 'Maintain workload and protect sleep routine.',
        sustain: 'Maintain workload and protect sleep routine.',
        recover: 'Deload and bank recovery this week.',
        deload: 'Deload and bank recovery this week.'
      };
      const fallbackCoach = fallbackCoachMap[planKey] || 'Hold steady and reinforce core recovery habits.';
    if (!reportPayload.coachCall || !String(reportPayload.coachCall).trim()) {
      reportPayload.coachCall = fallbackCoach;
    }
    reportPayload.metadata.degraded = false;
    reportPayload.metadata.degradeReason = '';
    degradeReason = '';
    }

    logWeeklyJob_('weekly_job:distribute_prepare', {
      degraded: reportPayload.metadata.degraded,
      degradeReason: reportPayload.metadata.degradeReason || '',
      stage
    });

    // Build driver cards and component rows (moved from top level into try block)
    const readinessTileData = compositeSummary?.readiness || {};
    const outputTileData = compositeSummary?.output || {};
    const compositePlan = compositeSummary?.plan || {};
    const latestRollup = compositeSummary?.latest || null;
    const sleepConsistencySd = compositeSummary?.sleepConsistencySd ?? null;

    // Initialize convenience aliases and computed variables for render prep
    const goals = USER_GOALS || {};
    const report = reportPayload;
    const ds = derivedStats || {};
    
    const sleepConsistencyLabel = sleepConsistency?.label ?? 'Data Gaps';
    const sleepStatusClass = getStatusClass_(sleepConsistencyLabel);
    
    const strengthAcwr = derivedStats?.load?.acwr ?? {};
    const acwrValue = strengthAcwr.value ?? strengthAcwr.ratio ? Number(strengthAcwr.value ?? strengthAcwr.ratio) : null;
    const acwrDisplay = acwrValue != null ? `${acwrValue.toFixed(2)}${strengthAcwr.label ? ` (${strengthAcwr.label})` : ''}` : (strengthAcwr.label || 'Data Gaps');
    const acwrLoadPct = parseSignedNumber_(derivedStats?.load?.pctTrendStr);
    
    const rhrDeltaText = derivedStats?.rhr?.deltaTrendStr ?? '—';
    const rhrDeltaValue = parseSignedNumber_(rhrDeltaText);
    
    const loadTrendValue = trend.trainingLoad;
    const loadGoalValue = goals.weeklyTrainingLoad || null;
    const stepsTrendValue = trend.steps;
    const floorTarget = Math.max(CONFIG.Steps.purpleMinDays, goals.stepsFloorDays || CONFIG.Steps.fallbackFloorDays);
    
    // Bucket scores
    const bucketScoresMeta = report?.metadata?.bucketScores || {};
    const sleepBucketScore = bucketScoresMeta.sleep || scoreSleepBucket_({
      sleepThisWeek: weekly.sleep,
      sleepGoal: goals.sleepMinutes || null,
      sdMinutes: sleepConsistencySd,
      rhrDelta: rhrDeltaValue
    });
    const loadBucketScore = bucketScoresMeta.load || scoreLoadBucket_({
      acwr: acwrValue,
      loadPctVsTrend: acwrLoadPct
    });
    const activityBucketScore = bucketScoresMeta.activity || scoreActivityBucket_({
      stepsThisWeek: weekly.steps,
      stepsGoal: goals.steps || null,
      floorDays: ds?.steps?.days6k ?? null,
      floorTarget
    });
    const workBucketScore = bucketScoresMeta.work || scoreWorkBucket_({
      hoursThisWeek: weekly.workHours,
      hoursGoal: goals.weeklyWorkHours || null,
      deepWorkPct: ds?.work?.deepWorkPct ?? null
    });
    
    // Ensure bucket scores have all necessary properties
    const ensureBucketGrades = (bucket) => {
      if (!bucket.grade) {
        const info = gradeFromScore_(bucket.score);
        bucket.grade = info.grade;
        bucket.band = info.band;
        bucket.bandClass = bandToStatusClass_(info.band);
        bucket.bandLabel = bandToLabel_(info.band);
        bucket.scoreText = bucket.score != null ? `${bucket.score}/100` : '';
      }
      return bucket;
    };
    [sleepBucketScore, loadBucketScore, activityBucketScore, workBucketScore].forEach(ensureBucketGrades);
    
    // Acute deltas
    const sleepAcuteDiff = (weekly.sleep != null && trend.sleep != null) ? weekly.sleep - trend.sleep : null;
    const activityAcuteDiff = parseSignedNumber_(ds?.steps?.pctTrendStr);
    const workAcuteDiff = parseSignedNumber_(ds?.work?.pctTrendStr);
    const loadAcuteDiff = acwrLoadPct != null && isFinite(acwrLoadPct) ? acwrLoadPct : null;
    
    // Score maps
    const bucketScoreMap = {
      sleep: sleepBucketScore,
      load: loadBucketScore,
      activity: activityBucketScore,
      work: workBucketScore
    };
    const acuteMap = {
      sleep: sleepAcuteDiff,
      load: loadAcuteDiff,
      activity: activityAcuteDiff,
      work: workAcuteDiff
    };

    const readinessPctValue = readinessTileData.pct != null ? Math.round(readinessTileData.pct) : null;
    const outputPctValue = outputTileData.pct != null ? Math.round(outputTileData.pct) : null;
    const dataGapsLatest = latestRollup && latestRollup.data_gaps != null ? Number(latestRollup.data_gaps) : null;
    const insufficientGlobal = dataGapsLatest != null && dataGapsLatest >= 5;

    const readinessTrendValue = readinessTileData.trend != null ? readinessTileData.trend : null;
    const outputTrendValue = outputTileData.trend != null ? outputTileData.trend : null;
    const readinessTrendDisplay = !insufficientGlobal && readinessTrendValue != null ? formatTrendArrow_(readinessTrendValue) : '—';
    const outputTrendDisplay = !insufficientGlobal && outputTrendValue != null ? formatTrendArrow_(outputTrendValue) : '—';
    const readinessSubtitle = readinessTileData.subtitle || 'Readiness data missing — log recovery inputs.';
    const outputSubtitle = outputTileData.subtitle || 'Output data missing — keep execution logs.';
    
    // Use rollup fulfillment percentages if available, otherwise compute from derivedStats
    const contextFulfil = (usedRollup && weekly.rollupFulfil !== undefined) ? weekly.rollupFulfil : {
      sleepPct: fulfil.sleepPct != null ? Math.round(fulfil.sleepPct) : null,
      gymPct: fulfil.loadPct != null ? Math.round(fulfil.loadPct) : null,
      stepsPct: fulfil.stepsPct != null ? Math.round(fulfil.stepsPct) : null,
      workPct: fulfil.workPct != null ? Math.round(fulfil.workPct) : null
    };
    
    const planNarrativeLine = compositePlan.narrative
      || buildPlanSummaryText_(readinessPctValue, outputPctValue, readinessTrendValue, outputTrendValue, compositePlan.balance, {
          acwr: acwrValue,
          sleepPct: contextFulfil.sleepPct,
          gymPct: contextFulfil.gymPct,
          stepsPct: contextFulfil.stepsPct,
          workPct: contextFulfil.workPct,
          rhrDelta: rhrDeltaValue,
          floorDays: ds?.steps?.days6k ?? null,
          sleepSd: sleepConsistencySd
        })
      || 'Maintain current workload and protect bedtime/wake windows.';

    // Validate that builder functions have sufficient data
    if (!weekly || !trend || !goals || !ds) {
      logWeeklyJob_('weekly_job:render_prep_missing_data', {
        hasWeekly: !!weekly,
        hasTrend: !!trend,
        hasGoals: !!goals,
        hasDs: !!ds
      });
      throw new Error('Cannot build driver cards: missing required data');
    }

    const driverData = buildSystemDriverCards_({
      sleepFulfil: fmtFulfilment(fulfil.sleepPct),
      sleepSdText: sleepConsistencySd != null ? fmtDurationMinutes_(sleepConsistencySd) : '',
      sleepLabelClass: sleepStatusClass,
      rhrDeltaText,
      rhrDeltaValue,
      sleepWeekly: weekly.sleep,
      sleepTrend: trend.sleep,
      sleepGoal: goals.sleepMinutes || null,
      loadKgText: weekly.trainingLoad != null ? `${fmtInt(weekly.trainingLoad)} kg` : '',
      acwrDisplay,
      acwrValue,
      loadPct: acwrLoadPct,
      loadWeekly: weekly.trainingLoad,
      loadTrend: loadTrendValue,
      loadGoal: loadGoalValue,
      prsThisWeek: weekly.prs,
      stepsText: weekly.steps != null ? `${fmtSteps_(weekly.steps)} • ${fmtFulfilment(fulfil.fitnessPct)}` : '',
      floorDaysValue: ds?.steps?.days6k ?? null,
      floorTarget,
      stepsDeltaPct: parseSignedNumber_(ds?.steps?.pctTrendStr),
      stepsWeekly: weekly.steps,
      stepsTrend: stepsTrendValue,
      stepsGoal: goals.steps || null,
      workHoursText: weekly.workHours != null ? `${Math.round(weekly.workHours)}h` : '',
      workGoalText: goals.weeklyWorkHours ? `${Math.round(goals.weeklyWorkHours)}h` : '',
      workTrendText: trend.workHours != null ? `${Math.round(trend.workHours)}h` : '',
      workHoursValue: weekly.workHours,
      workTrendValue: trend.workHours,
      workGoalValue: goals.weeklyWorkHours || null,
      bucketScores: bucketScoreMap,
      acutes: acuteMap,
      missingCounts: ds?.missing || {},
      degradedMode: Boolean(report?.metadata?.degraded),
      latestRollup,
      insufficientNote: '— (insufficient data (Sat–Fri))'
    });
    const driverCards = driverData.cards;
    const driverMissingNotes = driverData.missingNotes || [];

    const componentRows = buildComponentRows_(weekly, trend, goals, ds, sleepConsistency, acwrValue, bucketScoreMap, acuteMap);

    const degradeReasonFromReport = report.metadata?.degradeReason || '';

    const planOriginalCode = (compositePlan.code || report.decision?.plan || 'Hold').toString();
    const leverOriginal = report.decision?.lever || 'Maintain; keep steps steady';
    const planLower = planOriginalCode.toLowerCase();
    const ACWR_GATING_THRESHOLD = 1.5;
    const gatingSleep = sleepStatusClass === 'status-warning' || sleepStatusClass === 'status-danger';
    const gatingAcwr = acwrValue != null && acwrValue > ACWR_GATING_THRESHOLD;
    let coercedPlan = planLower;
    if (gatingAcwr) {
      coercedPlan = 'recover';
    } else if (gatingSleep && planLower === 'push') {
      coercedPlan = 'hold';
    }
    const planDisplayMap = { push: 'PUSH', sustain: 'HOLD', hold: 'HOLD', deload: 'RECOVER', recover: 'RECOVER' };
    const iconMap = { PUSH: '↑', HOLD: '↔', RECOVER: '↓' };
    const planDisplay = planDisplayMap[coercedPlan] || planDisplayMap.sustain;
    const planIcon = iconMap[planDisplay];

    // NOW generate opening summary - coercedPlan is available
    const drivers = analyzeScoreDrivers_({
      compositeSummary,
      fulfil,
      weekly,
      trend,
      goals,
      sleepConsistency,
      acwrValue,
      readinessTrendPct: readinessTrendValue,
      outputTrendPct: outputTrendValue
    });
    
    // Generate TWO versions: short for header, detailed for Coach's Read
    const shortOpening = generateShortOpening_(drivers, coercedPlan);
    const detailedOpeningArray = generateDetailedOpening_(drivers, coercedPlan, drivers.balance);
    
    Logger.log('=== OPENING SUMMARY DEBUG ===');
    Logger.log('drivers.constraints: ' + JSON.stringify(drivers.constraints));
    Logger.log('shortOpening: ' + shortOpening);
    Logger.log('detailedOpeningArray: ' + JSON.stringify(detailedOpeningArray));
    
    // Tier 1 Header: Use short punchy version
    const updatedPlanNarrativeLine = shortOpening || planNarrativeLine;
    
    // Tier 4 Coach's Read: Use detailed version
    const detailedOpeningText = detailedOpeningArray && detailedOpeningArray.length 
      ? detailedOpeningArray.join(' ')
      : null;
    
    const coachCallText = detailedOpeningText
      ? sanitizeTextForHtml_(detailedOpeningText, 400)
      : sanitizeTextForHtml_(report.coachCall || '', 400);
    
    Logger.log('coachCallText final: ' + coachCallText);
    Logger.log('updatedPlanNarrativeLine: ' + updatedPlanNarrativeLine);
    Logger.log('=== END OPENING SUMMARY DEBUG ===');
    
    const gatingSummaryParts = [
      sleepConsistencyLabel && `Sleep ${sleepConsistencyLabel}`,
      sleepConsistencySd != null && `SD ${fmtDurationMinutes_(sleepConsistencySd)}`,
      gatingAcwr && acwrValue != null && `ACWR ${acwrValue.toFixed(2)}`,
      rhrDeltaText && rhrDeltaText !== '—' && `RHR Δ ${rhrDeltaText}`
    ].filter(Boolean);
    const gatingSummary = gatingSummaryParts.join(' · ');

    const coachNotes = sanitizeArrayForHtml_(report.decision?.notes || [], BULLET_CHAR_LIMIT);
    let leverText = leverOriginal;
    if (gatingAcwr && planDisplay === 'RECOVER') {
      leverText = 'Reduce load 15–25%; prioritise recovery.';
    } else if (gatingSleep && planDisplay === 'HOLD' && planLower === 'push') {
      leverText = 'Stabilise sleep cadence before increasing load.';
    }
    const leverDisplay = sanitizeTextForHtml_(leverText, BULLET_CHAR_LIMIT);
    const coachNotesList = coachNotes.slice();
    if (coercedPlan !== planLower) {
      coachNotesList.push(sanitizeTextForHtml_('Plan adjusted due to gating metrics.', BULLET_CHAR_LIMIT));
    }
    const bulletTags = ['Energy', 'Recovery', 'Behavior'];
    const coachBullets = (report.recommendations || []).slice(0, 3).map((item, index) => ({
      tag: escapeHtml_(bulletTags[index] || 'Focus'),
      text: sanitizeTextForHtml_(item, RECOMMENDATION_CHAR_LIMIT)
    }));

    const coachContext = buildCoachContext_({
      planDisplay,
      planOriginalCode,
      planNarrativeLine,
      leverDisplay,
      decision: report.decision,
      sleepBucketScore,
      loadBucketScore,
      activityBucketScore,
      workBucketScore,
      derivedStats,
      capacity,
      sleepConsistency,
      acwrLabel: strengthAcwr.label,
      gatingSummary,
      degradeReason: report.metadata.degradeReason || ''
    });

    stage = 'render';
    logWeeklyJob_('weekly_job:stage', { stage });
    const finalReport = reportPayload;
    
    // Generate coachRead (or use existing) and replace whereYoureAt with detailed opening
    let coachRead = finalReport.coachRead || generateCoachRead_(coachContext);
    
    // Always replace whereYoureAt with the detailed data-driven opening summary
    if (detailedOpeningArray && detailedOpeningArray.length) {
      Logger.log('Setting whereYoureAt in coachRead structure with detailed opening');
      coachRead.whereYoureAt = detailedOpeningArray;
      finalReport.coachRead = coachRead;
    }
    
    finalReport.prose = coachReadToProse_(coachRead);
    if (finalReport.metadata.totalBucketScore == null) finalReport.metadata.totalBucketScore = totalBucketScore;
    if (!finalReport.metadata.totalGrade) finalReport.metadata.totalGrade = totalGradeInfo.grade;
    if (!finalReport.metadata.totalBand) finalReport.metadata.totalBand = totalGradeInfo.band;
    const safeReport = sanitizeReportForHtml_(finalReport);
    const coachReadSafe = safeReport.coachRead || null;
    const degradeReasonMeta = finalReport.metadata.degradeReason || '';
    const showDegradeBanner = finalReport.metadata.degraded && !/coach_call_missing/i.test(degradeReasonMeta);
    const degradeBannerMsg = showDegradeBanner ? 'AI content degraded this week (schema fail)' : '';

    const gaps = [];
    if (derivedStats.missing.activity) gaps.push(`${derivedStats.missing.activity} missing (Activity)`);
    if (derivedStats.missing.sleep) gaps.push(`${derivedStats.missing.sleep} (Sleep)`);
    if (derivedStats.missing.rhr) gaps.push(`${derivedStats.missing.rhr} (RHR)`);
    
    const gapsNoteMsg = usedRollup && rollupData
      ? `Based on complete week: ${formatDateIso_(weekMeta.start)} to ${formatDateIso_(weekMeta.end)}` + 
        (gaps.length ? ` (Note: ${gaps.join('; ')})` : '')
      : gaps.length 
        ? `Data Gaps: ${gaps.join('; ')} — trends may be noisy.` 
        : '';

    // Compute email heading for logging
    const headingLabel = weekMeta?.label || `Week of ${formatDateIso_(new Date())}`;
    const totalScore = finalReport?.metadata?.totalBucketScore != null ? finalReport.metadata.totalBucketScore : null;
    const totalScoreDisplay = totalScore != null ? `${totalScore}` : (scores.overall != null ? `${Math.round(scores.overall)}` : '—');
    const heading = `${headingLabel} — (${totalScoreDisplay}/100) Health Score`;

    Logger.log(`Stage before send: ${stage}`);
    Logger.log(`Remaining quota: ${MailApp.getRemainingDailyQuota()}`);
    Logger.log('Sending coach report email…');
    const usedFallback = Boolean(!aiParseOk || degradeReasons.length || finalReport.metadata.degraded);
    const emailLogMeta = {
      aiParseOk,
      usedFallback,
      schemaDiag: schemaDiag || finalReport.metadata.degradeReason || 'ok',
      aiParseError
    };

    // Create renderContext with all precomputed render variables
    const renderContext = {
      driverCards,
      componentRows,
      readinessPctValue,
      outputPctValue,
      readinessTrendDisplay,
      readinessSubtitle,
      outputTrendDisplay,
      outputSubtitle,
      planNarrativeLine: updatedPlanNarrativeLine,
      planIcon,
      coachCallText,
      coachNotes,
      leverDisplay,
      coachNotesList,
      coachBullets,
      coachReadSafe,
      gatingSummary,
      gatingSleep,
      degradeReason: degradeReasonFromReport,
      planDisplay,
      gatingAcwr,
      insufficientGlobal,
      latestRollup,
      driverMissingNotes,
      sleepConsistencyLabel,
      sleepConsistencySd,
      acwrValue,
      strengthAcwr,
      rhrDeltaText,
      sleepConsistency
    };

    logWeeklyJob_('weekly_job:email_send_start', {
      heading,
      degraded: finalReport.metadata.degraded,
      degradeReason: finalReport.metadata.degradeReason || ''
    });
    distributeReport(safeReport, scores, weekly, trend, USER_GOALS, [], derivedStats, capacity, decision, gapsNoteMsg, degradeBannerMsg, weekMeta, compositeSummary, emailLogMeta, renderContext);
    logWeeklyJob_('weekly_job:email_send_complete', { heading });

    stage = 'log';
    logWeeklyJob_('weekly_job:stage', { stage });
    logReportToSheet(aiResponseText, weekly, trend, scores, weekMeta);
    logWeeklyJob_('weekly_job:log_sheet_row_appended', { week: weekMeta?.label || 'unknown' });

  } catch (error) {
    logWeeklyJob_('weekly_job:error', { stage, message: error?.message || 'unknown', stack: error?.stack || 'n/a' });
    sendJobFailureEmail_(weekMeta, stage, error);
    throw error;
  } finally {
    logWeeklyJob_('weekly_job:finally', { stage });
    setWeekReferenceOverride(null);
  }
}


// --- Performance Index (unchanged math) ---
function calculatePerformanceIndex(weekly, trend, goals){
  const hoursEff = Math.min(weekly.workHours || 0, CONFIG.Work.extremeHours);
  const workScore = scale(hoursEff / Math.max(1, goals.weeklyWorkHours));
  const loadGoalScore  = scale((weekly.trainingLoad || 0) / Math.max(1, goals.weeklyTrainingLoad));
  const loadTrendScore = scale((weekly.trainingLoad || 0) / Math.max(1, trend.trainingLoad || 1));
  const prBoost = Math.min((weekly.prs || 0) * 2, 6);
  const strengthScore = Math.min(100, Math.round(0.6 * loadGoalScore + 0.4 * loadTrendScore + prBoost));
  const stepScore = scale((weekly.steps || 0) / Math.max(1, goals.steps));
  const days6k = countDaysMeetingFloor_('steps', goals.stepsFloor || CONFIG.Steps.fallbackFloor);
  const fitnessScore = Math.min(100, stepScore + (days6k >= (goals.stepsFloorDays||5) ? 5 : 0));
  const PI = Math.round(0.4 * workScore + 0.4 * strengthScore + 0.2 * fitnessScore);
  return { PI, components: { workScore, strengthScore, fitnessScore, loadGoalScore, loadTrendScore, prBoost, days6k } };
}

// --- Capacity classifier with Purple ---
function classifyCapacityWithPurple(weekly, trend, goals, ds){
  const sleepDefMin = Math.max(0, (goals.sleepMinutes || 0) - (weekly.sleep || 0));
  const rhrDelta    = (weekly.rhr || 0) - (trend.rhr || weekly.rhr || 0);
  const loadRatio   = (weekly.trainingLoad || 0) / Math.max(1, trend.trainingLoad || 1);
  const workHours   = weekly.workHours || 0;
  const acwrRatio   = ds?.load?.acwr?.ratio ?? null;
  const acwrValue   = ds?.load?.acwr?.value ?? null;
  const acwrDisplay = acwrValue != null ? acwrValue : acwrRatio;
  const sriScore    = ds?.sleep?.consistency?.score ?? null;

  let red = 0, amber = 0; const reasons = [];

  if (sleepDefMin >= CONFIG.Sleep.deficitRed) { red++;   reasons.push(`Sleep −${fmtHMin(sleepDefMin)}`); }
  else if (sleepDefMin >= CONFIG.Sleep.deficitAmber) { amber++; reasons.push(`Sleep −${fmtHMin(sleepDefMin)}`); }

  if (rhrDelta >= CONFIG.RHR.redDelta) { red++;   reasons.push(`RHR +${fmtBpm(rhrDelta)} vs 4-wk`); }
  else if (rhrDelta >= CONFIG.RHR.amberDelta) { amber++; reasons.push(`RHR +${fmtBpm(rhrDelta)} vs 4-wk`); }

  if (acwrRatio != null){
    if (acwrRatio >= CONFIG.ACWR.red) { red++; reasons.push(`ACWR high (${fmtAcwr(acwrDisplay)})`); }
    else if (acwrRatio >= CONFIG.ACWR.amber) { amber++; reasons.push(`ACWR rising (${fmtAcwr(acwrDisplay)})`); }
  }

  if (sriScore != null){
    if (sriScore < CONFIG.Sleep.consistencyRed) { red++; reasons.push(`SRI low (${sriScore}/100)`); }
    else if (sriScore < CONFIG.Sleep.consistencyAmber) { amber++; reasons.push(`SRI drifting (${sriScore}/100)`); }
  }

  if (loadRatio >= CONFIG.ACWR.highLoad) { red++;   reasons.push(`Load +${Math.round((loadRatio-1)*100)}% vs 4-wk`); }
  else if (loadRatio >= CONFIG.Load.amberRatio) { amber++; reasons.push(`Load +${Math.round((loadRatio-1)*100)}%`); }

  if (workHours >= CONFIG.Work.plateauHours) { amber++; reasons.push(`Work ${Math.round(workHours)}h (near plateau)`); }

  if (acwrRatio != null && acwrRatio >= CONFIG.ACWR.red && ((sriScore != null && sriScore < CONFIG.Sleep.consistencyRed) || rhrDelta >= CONFIG.RHR.redDelta)) {
    if (!reasons.includes('ACWR spike + fatigue')) reasons.push('ACWR spike + fatigue');
    return { label: 'Red', reasons };
  }

  const underWork = (goals.weeklyWorkHours ? workHours <= CONFIG.Work.purpleGoalRatio * goals.weeklyWorkHours : false) && workHours < CONFIG.Work.plateauHours;
  const underLoad = (trend.trainingLoad ? (weekly.trainingLoad || 0) <= CONFIG.Work.purpleGoalRatio * trend.trainingLoad : false);
  const lowSteps  = ds.steps.days6k < CONFIG.Steps.purpleMinDays;
  const couldBePurple = (underWork && underLoad) || (underWork && lowSteps) || (underLoad && lowSteps);
  const sleepOkForPurple = (sleepDefMin < CONFIG.Sleep.purpleMaxDeficit) && (sriScore == null || sriScore >= CONFIG.Sleep.consistencyAmber);
  const acwrOkForPurple = (acwrRatio == null || acwrRatio <= CONFIG.ACWR.purpleMax);

  if (red >= 2) return { label: 'Red', reasons };
  if (red === 1 || amber >= 1) return { label: 'Amber', reasons };
  if (sleepOkForPurple && acwrOkForPurple && couldBePurple) return { label: 'Purple', reasons: ['Under capacity—low work & training/NEAT'] };
  if (couldBePurple && !sleepOkForPurple) reasons.push('Sleep rhythm unstable');
  return { label: 'Green', reasons };
}


// --- Decision rule (Push / Sustain / Deload + lever) ---
function decideNextAction(weekly, trend, goals, ds, capacity){
  const sleepDefMin = Math.max(0, (goals.sleepMinutes || 0) - (weekly.sleep || 0));
  const rhrDelta    = (weekly.rhr || 0) - (trend.rhr || weekly.rhr || 0);
  const loadRatio   = (weekly.trainingLoad || 0) / Math.max(1, trend.trainingLoad || 1);
  const workEff     = Math.min(weekly.workHours || 0, CONFIG.Work.extremeHours);
  const acwrRatio   = ds?.load?.acwr?.ratio ?? null;
  const acwrValue   = ds?.load?.acwr?.value ?? null;
  const acwrDisplay = acwrValue != null ? acwrValue : acwrRatio;
  const sriScore    = ds?.sleep?.consistency?.score ?? null;

  const canPush = (workEff < CONFIG.Work.extremeHours)
    && (sleepDefMin < CONFIG.Sleep.pushDeficitMax)
    && (rhrDelta <= CONFIG.RHR.amberDelta)
    && (acwrRatio == null || acwrRatio <= CONFIG.ACWR.amber)
    && (sriScore == null || sriScore >= CONFIG.Sleep.consistencyAmber);

  if (canPush && (capacity.label === 'Green' || capacity.label === 'Purple')) {
    const lever = (capacity.label === 'Purple')
      ? 'Use slack: add ~10% training load and one quality session'
      : 'Controlled push: +8% load while keeping sleep 7h+';
    return { plan: 'Push', lever };
  }

  const spike = acwrRatio != null && acwrRatio >= CONFIG.ACWR.red;
  if (spike && ((sriScore != null && sriScore < CONFIG.Sleep.consistencyRed) || sleepDefMin >= CONFIG.Sleep.deficitAmber || rhrDelta >= CONFIG.RHR.redDelta)) {
    return { plan: 'Deload', lever: 'ACWR spike — trim 20% volume and add 60m sleep' };
  }

  const redish = (sleepDefMin >= CONFIG.Sleep.purpleMaxDeficit) + (rhrDelta >= CONFIG.RHR.redDelta) + (loadRatio >= CONFIG.ACWR.highLoad) + (workEff >= CONFIG.Work.extremeHours)
    + (sriScore != null && sriScore < CONFIG.Sleep.severeConsistency) + (acwrRatio != null && acwrRatio >= CONFIG.ACWR.red);
  if (redish >= 2 || capacity.label === 'Red') {
    return { plan: 'Deload', lever: 'Reduce load 15–25%; prioritise sleep consistency and HR recovery' };
  }

  const acwrCaution = acwrRatio != null && acwrRatio > CONFIG.ACWR.amber;
  if (acwrCaution || (sriScore != null && sriScore < CONFIG.Sleep.consistencyAmber) || sleepDefMin >= CONFIG.Sleep.deficitAmber) {
    const lever = (sleepDefMin >= CONFIG.Sleep.deficitAmber)
      ? 'Hold load; add 45–60m nightly sleep before next push'
      : (sriScore != null && sriScore < CONFIG.Sleep.consistencyAmber)
        ? 'Stabilise bedtime/wake; keep load flat until SRI ≥70'
        : `Bank this week; let ACWR fall below ${fmtAcwr(CONFIG.ACWR.purpleMax)} (currently ${fmtAcwr(acwrDisplay)})`;
    return { plan: 'Sustain', lever };
  }

  return { plan: 'Sustain', lever: 'Maintain; keep steps steady' };
}


// --- Score helpers (existing) ---
function scoreFromTarget_(value, target, betterIsLower=false){
  if (value == null || target == null) return 0;
  let ratio = betterIsLower ? (target / Math.max(value, 1)) : (value / Math.max(target, 1));
  let score = Math.min(1.2, Math.max(0, ratio)) * 100;
  return Math.round(Math.min(score, 100));
}
function getTrendArrow(current, trend) { if (current > trend) return '⬆️'; if (current < trend) return '⬇️'; return '➡️'; }




const SECTION_CONFIG = {
  work: { label: 'Work hours', unit: 'hours', betterIsLower: false },
  strength: { label: 'Strength training load', unit: 'kilograms', betterIsLower: false },
  fitness: { label: 'Daily movement', unit: 'steps', betterIsLower: false },
  sleep: { label: 'Sleep duration', unit: 'minutes', betterIsLower: false },
  readiness: { label: 'Readiness (resting heart rate)', unit: 'beats per minute', betterIsLower: true }
};

const SECTION_LABEL_SHORT = {
  work: 'Work',
  strength: 'Strength',
  fitness: 'Movement',
  sleep: 'Sleep',
  readiness: 'Readiness'
};

const ACTION_LIBRARY = {
  work: {
    green: 'Keep the work rhythm steady.',
    yellow_high: 'Trim work hours a little to protect recovery.',
    yellow_low: 'Add a focused block to close the work gap.',
    red_high: 'Pull hours back to avoid burnout.',
    red_low: 'Schedule firm focus time to meet commitments.',
    unknown: 'Note work hours so we can steer next week.',
    noGoal: 'Set a weekly work target to guide decisions.'
  },
  strength: {
    green: 'Maintain the current training mix.',
    yellow_high: 'Dial volume down slightly to bank recovery.',
    yellow_low: 'Add one quality strength session to keep load on track.',
    red_high: 'Deload strength volume this week.',
    red_low: 'Plan progressive overload to build toward the goal.',
    unknown: 'Log strength sessions so we can steer the load.',
    noGoal: 'Set a weekly load target (or proxy) to direct training.'
  },
  fitness: {
    green: 'Keep daily movement habits steady.',
    yellow_high: 'Channel extra steps into easy aerobic sessions.',
    yellow_low: 'Layer in walks to close the movement gap.',
    red_high: 'Hold steps steady and make recovery intentional.',
    red_low: 'Prioritise daily walks to meet the movement goal.',
    unknown: 'Track step counts consistently to steer movement.',
    noGoal: 'Set a daily movement goal to guide choices.'
  },
  sleep: {
    green: 'Keep bedtime and wake routines consistent.',
    yellow_high: 'Use the extra rest to fuel deliberate training.',
    yellow_low: 'Bring lights-out forward to protect sleep time.',
    red_high: 'Hold a firm wake-up time so sleep stays purposeful.',
    red_low: 'Block non-negotiable wind-down time to recover.',
    unknown: 'Log sleep duration so we can adjust quickly.',
    noGoal: 'Set a nightly sleep target to anchor recovery.'
  },
  readiness: {
    green: 'Keep recovery practices consistent.',
    yellow_high: 'Ease up slightly and watch recovery markers.',
    yellow_low: 'You are trending better than goal, stay patient with buildup.',
    red_high: 'Heart rate is well below goal; build gradually while monitoring.',
    red_low: 'Prioritise rest until heart rate settles.',
    unknown: 'Track resting heart rate to steer readiness.',
    noGoal: 'Add a resting heart rate goal to guide recovery.'
  }
};

const ACTION_WHERE_HOW = {
  work: 'via two 90-minute focus sprints',
  strength: 'via the main lifts; tempo 3-1-0',
  fitness: 'via two purposeful walks (20 minutes each)',
  sleep: 'via a fixed 10:00pm wind-down routine',
  readiness: 'via five-minute evening parasympathetic breathing'
};

const ACTION_DEDUP_FALLBACK = {
  work: {
    green: 'Keep work cadence steady to preserve bandwidth.',
    yellow_high: 'Ease workload slightly to free recovery space.',
    yellow_low: 'Add one deliberate focus block to close the work gap.',
    red_high: 'Cut back hours sharply so fatigue drops.',
    red_low: 'Bookend deep-work blocks to rebuild momentum.',
    default: 'Rebalance workload deliberately.'
  },
  strength: {
    green: 'Hold the current strength mix steady.',
    yellow_high: 'Dial strength volume down to bank recovery.',
    yellow_low: 'Layer one quality strength session to lift the load.',
    red_high: 'Deload strength sets while monitoring fatigue.',
    red_low: 'Plan progressive overload carefully to rebuild.',
    default: 'Tune strength load deliberately.'
  },
  fitness: {
    green: 'Keep daily movement habits steady.',
    yellow_high: 'Channel surplus steps into easy aerobic time.',
    yellow_low: 'Layer extra walks to close the movement gap.',
    red_high: 'Hold step volume steady so recovery settles.',
    red_low: 'Prioritise daily walks to rebuild momentum.',
    default: 'Adjust movement deliberately.'
  },
  sleep: {
    green: 'Keep bedtime cadence consistent.',
    yellow_high: 'Use the extra rest intentionally for the training plan.',
    yellow_low: 'Bring lights-out forward to protect sleep time.',
    red_high: 'Hold a firm wake window so sleep stays purposeful.',
    red_low: 'Block a non-negotiable wind-down to recover.',
    default: 'Adjust sleep rhythm deliberately.'
  },
  readiness: {
    green: 'Keep recovery practices steady.',
    yellow_high: 'Ease effort slightly and monitor signals.',
    yellow_low: 'Stay patient with the positive recovery trend.',
    red_high: 'Build gradually while you watch heart rate.',
    red_low: 'Prioritise rest until heart rate settles.',
    default: 'Adjust recovery deliberately.'
  }
};

function getBandVariantKey(band) {
  if (!band) return 'default';
  if (band === 'green') return 'green';
  if (band === 'unknown') return 'default';
  if (band.startsWith('yellow_high')) return 'yellow_high';
  if (band.startsWith('yellow_low')) return 'yellow_low';
  if (band.startsWith('red_high')) return 'red_high';
  if (band.startsWith('red_low')) return 'red_low';
  return 'default';
}

function appendWhereHowClause(sentence, clause) {
  if (!sentence) return '';
  const base = sentence.trim().replace(/\s+$/, '');
  const trimmed = base.replace(/\.+$/, '');
  if (!clause) return `${trimmed}.`;
  const cleanedClause = clause.trim().replace(/\.$/, '');
  return `${trimmed} ${cleanedClause}.`;
}

function describeGoalStatus(fulfilPct, betterIsLower) {
  if (fulfilPct == null || isNaN(fulfilPct)) return null;
  const diff = fulfilPct - 100;
  const effectiveDiff = betterIsLower ? -diff : diff;
  const magnitude = Math.abs(effectiveDiff);
  if (magnitude <= 3) return 'on goal';
  if (magnitude <= 7) return effectiveDiff > 0 ? 'slightly ahead of goal' : 'slightly behind goal';
  if (magnitude <= 12) return effectiveDiff > 0 ? 'ahead of goal' : 'behind goal';
  return effectiveDiff > 0 ? 'well ahead of goal' : 'well behind goal';
}

function buildStatusSentence(sectionKey, cfg, options = {}) {
  const { weeklyValue, goalValue, fulfilPct, extra } = options;
  const label = cfg ? cfg.label : sectionKey;
  const betterIsLower = cfg ? cfg.betterIsLower : false;
  const goalDescriptor = extra && extra.goalDescriptor ? extra.goalDescriptor : 'goal';
  const status = describeGoalStatus(fulfilPct, betterIsLower);
  if (goalValue && status) {
    return `${label} lands ${status} at ${percentAsText(fulfilPct)} of the ${goalDescriptor}.`;
  }
  if (goalValue && weeklyValue != null) {
    return `${label} progress tracks the ${goalDescriptor}; percent insight is limited this week.`;
  }
  if (weeklyValue != null) {
    return `${label} logged ${formatSectionValue(sectionKey, weeklyValue)} with no goal for comparison.`;
  }
  return `${label} data is missing this week.`;
}

function normalizeComparisonText(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isDuplicateWithRecommendations(sentence, recommendations) {
  if (!sentence || !Array.isArray(recommendations) || !recommendations.length) return false;
  const actionNorm = normalizeComparisonText(sentence);
  if (!actionNorm) return false;
  return recommendations.some(rec => {
    const recNorm = normalizeComparisonText(rec);
    if (!recNorm) return false;
    const shorter = actionNorm.length <= recNorm.length ? actionNorm : recNorm;
    const longer = actionNorm.length <= recNorm.length ? recNorm : actionNorm;
    if (!shorter) return false;
    if (!longer.includes(shorter)) return false;
    return (shorter.length / Math.max(longer.length, 1)) >= 0.8;
  });
}

function buildCoachContext_(options) {
  const {
    planDisplay,
    planOriginalCode,
    planNarrativeLine,
    leverDisplay,
    decision,
    sleepBucketScore,
    loadBucketScore,
    activityBucketScore,
    workBucketScore,
    derivedStats,
    capacity,
    sleepConsistency,
    acwrLabel,
    gatingSummary,
    degradeReason
  } = options || {};

  const ds = derivedStats || {};
  const missing = ds.missing || {};
  const coachGapFlags = [];
  if (missing.activity) coachGapFlags.push('activity logging patchy');
  if (missing.sleep) coachGapFlags.push('sleep records patchy');
  if (missing.rhr) coachGapFlags.push('resting heart entries patchy');
  if (!coachGapFlags.length) coachGapFlags.push('data coverage steady');

  const safePlan = String(planDisplay || planOriginalCode || decision?.plan || '').toLowerCase();
  const safeLever = String(leverDisplay || decision?.lever || '').replace(/\d+/g, 'many');
  const safeNarrative = String(planNarrativeLine || '').replace(/\d+/g, 'many');
  const safeCapacityReasons = (capacity?.reasons || []).map(reason => String(reason || '').replace(/\d+/g, 'many'));

  return {
    plan: safePlan,
    planLever: safeLever,
    narrative: safeNarrative,
    sleepStatus: String(sleepBucketScore?.bandLabel || '').toLowerCase(),
    sleepTrend: describeTrendWord_(ds?.sleep?.pctTrendStr),
    loadStatus: String(loadBucketScore?.bandLabel || '').toLowerCase(),
    loadTrend: describeTrendWord_(ds?.load?.pctTrendStr),
    stepsStatus: String(activityBucketScore?.bandLabel || '').toLowerCase(),
    stepsTrend: describeTrendWord_(ds?.steps?.pctTrendStr),
    workStatus: String(workBucketScore?.bandLabel || '').toLowerCase(),
    workTrend: describeTrendWord_(ds?.work?.pctTrendStr),
    sleepConsistencyLabel: String(sleepConsistency?.label || '').toLowerCase(),
    acwrLabel: String(acwrLabel || '').toLowerCase(),
    capacityLabel: String(capacity?.label || '').toLowerCase(),
    capacityReasons: safeCapacityReasons,
    dataFlags: coachGapFlags,
    gatingSummary: String(gatingSummary || '').replace(/\d+/g, 'many'),
    degradeFlag: String(degradeReason || '').replace(/\d+/g, 'many')
  };
}


function parseCoachReadJson_(rawText) {
  const snippet = extractJsonFromText_(rawText);
  if (!snippet) return null;
  try {
    return JSON.parse(snippet);
  } catch (err) {
    console.error('CoachRead JSON parse failed', err);
    return null;
  }
}



function fallbackCoachRead_(context) {
  const plan = (context?.plan || 'Hold').toLowerCase();
  const sleepStatus = (context?.sleepStatus || 'steady').toLowerCase();
  const loadStatus = (context?.loadStatus || 'steady').toLowerCase();
  const stepsStatus = (context?.stepsStatus || 'steady').toLowerCase();
  const workStatus = (context?.workStatus || 'steady').toLowerCase();

  const tonePrefix = plan === 'push'
    ? 'You pushed tempo, mate.'
    : plan === 'recover'
      ? 'You kept the brakes on, mate.'
      : 'You held the line, mate.';

  const where = [
    `${tonePrefix}`,
    `Sleep feels ${sleepStatus} and load sits ${loadStatus}.`,
    `Steps read ${stepsStatus} while work feels ${workStatus}.`
  ];

  const nextOrders = plan === 'recover'
    ? [
        'Keep sessions light and clean.',
        'Lock lights-out before you drift.',
        'Log recovery notes straight after dinner.'
      ]
    : plan === 'push'
      ? [
          'Add a quality effort only after prep is squared away.',
          'Guard your wind-down like kit.',
          'Check the log each night and tighten form.'
        ]
      : [
          'Hold your training rhythm without freelancing.',
          'Protect the same wake window every morning.',
          'Note one win and one gap before rack time.'
        ];

  const tradeOffs = [
    'More load means less tolerance for loose sleep.',
    'Pushing steps will steal focus unless you plan the day.',
    'Extra work blocks need matching recovery discipline.'
  ];

  const gutChecks = [
    'Are you switching off when the schedule says lights-out?',
    'Is your training log honest or dressed up?',
    'Will you front the week without excuses?'
  ];

  return {
    whereYoureAt: where,
    nextOrders,
    tradeOffs,
    gutChecks
  };
}

/**
 * Analyze score drivers to identify strengths, limiters, and trends
 * @param {Object} options - Contains composite summary, fulfillment %, weekly data
 * @returns {Object} Driver analysis with this-week vs trailing context
 */
// Constraint determination thresholds
const CONSTRAINT_THRESHOLDS = {
  READINESS_CRITICAL: 65,
  READINESS_WARNING: 75,
  READINESS_SOLID: 85,
  BALANCE_URGENT: -25,
  BALANCE_REDUCE: -15,
  BALANCE_MAINTAIN_THRESHOLD: -8,
  READINESS_SAFE_MAINTENANCE: 80,
  SLEEP_CONSISTENCY_GOOD: 60,
  SLEEP_CONSISTENCY_FAIR: 45,
  STEPS_GOOD: 85,
  STEPS_FAIR: 75,
  RHR_DELTA_ALERT: 2,
  ACWR_ALERT: 1.5
};

/**
 * Convert numeric score (0-100) to English range description
 * Used consistently across all prompt builders
 */
function describeScoreAsRange_(score) {
  if (score == null) return 'tracking';
  if (score >= 95) return 'high nineties';
  if (score >= 90) return 'low nineties';
  if (score >= 85) return 'mid-eighties';
  if (score >= 80) return 'low eighties';
  if (score >= 75) return 'mid-seventies';
  if (score >= 70) return 'low seventies';
  return 'below seventy';
}

/**
 * Convert balance delta to human-readable context
 */
function describeBalance_(balance) {
  if (balance == null) return 'unknown';
  if (balance > 0) return 'recovery ahead';
  if (balance < 0) return 'output ahead';
  return 'balanced';
}

/**
 * Filter constraint actions to get specific levers (exclude meta-actions)
 * @param {Array} actions - All actions from constraints
 * @param {number} maxLevers - Max number of levers to return
 */
function getSpecificLevers_(actions, maxLevers = 2) {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter(action => action && !action.includes('Maintain load, prioritize'))
    .slice(0, maxLevers);
}

/**
 * Split AI response into sentences, filtering short/malformed ones
 */
function parseSentenceArray_(text, minLength = 5) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\n\n+/g, ' ');

  if (!cleaned || cleaned.length < minLength) return [];
  
  // Split on period + capital letter, handle edge cases
  const sentences = cleaned
    .split(/\.(?=\s+[A-Z])/);
  
  return sentences
    .map(s => {
      const trimmed = s.trim();
      return trimmed.endsWith('.') ? trimmed : trimmed + '.';
    })
    .filter(s => s.length > minLength);
}

/**
 * Describe a limiter object with metric details
 */
function describeLimiter_(limiter) {
  if (!limiter) return 'no clear limiter';
  if (limiter.pct != null) return `${limiter.name} at ${Math.round(limiter.pct)} percent`;
  if (limiter.score != null) return `${limiter.name} at ${Math.round(limiter.score)}`;
  if (limiter.acwr != null) return `${limiter.name} ACWR ${limiter.acwr.toFixed(2)}`;
  return `${limiter.name} elevated`;
}

/**
 * Map readiness score to readiness threshold category
 */
function getReadinessThreshold_(readinessScore) {
  if (readinessScore < CONSTRAINT_THRESHOLDS.READINESS_CRITICAL) return 'critical';
  if (readinessScore < CONSTRAINT_THRESHOLDS.READINESS_WARNING) return 'warning';
  if (readinessScore < CONSTRAINT_THRESHOLDS.READINESS_SOLID) return 'solid';
  return 'strong';
}

/**
 * Get tone guidance and multiplier for a readiness threshold
 */
function getToneFromThreshold_(threshold) {
  const toneMap = {
    'critical': { guidance: 'Direct, controlled anger - warning signals', multiplier: 2 },
    'warning': { guidance: 'Mild frustration - pattern repeating or warning signs', multiplier: 1.5 },
    'solid': { guidance: 'Neutral, matter-of-fact', multiplier: 1 },
    'strong': { guidance: 'Neutral, matter-of-fact', multiplier: 1 }
  };
  return toneMap[threshold] || { guidance: 'Neutral, matter-of-fact', multiplier: 1 };
}

/**
 * Check if balance context requires load reduction
 */
function shouldReduceLoad_(balanceContext) {
  return ['reduce', 'urgent_reduce'].includes(balanceContext);
}

/**
 * Check if balance context requires maintaining load
 */
function shouldMaintainLoad_(balanceContext) {
  return balanceContext === 'maintain';
}

/**
 * Check if balance context allows ramping load
 */
function shouldRamp_(balanceContext) {
  return balanceContext === 'ramp';
}

/**
 * Determine actionable constraints based on scores, balance, and specific metrics
 * Returns flags that guide suggestion specificity and tone
 */
function determineConstraints_(outputScore, readinessScore, balance, limiters = {}) {
  // Input validation
  if (readinessScore == null || outputScore == null) {
    return {
      readinessThreshold: 'unknown',
      balanceContext: 'maintain',
      limitersRequireAction: [],
      toneMultiplier: 1
    };
  }

  const readinessThreshold = getReadinessThreshold_(readinessScore);
  const toneConfig = getToneFromThreshold_(readinessThreshold);

  const constraints = {
    readinessThreshold,
    balanceContext: null,
    limitersRequireAction: [],
    toneMultiplier: toneConfig.multiplier
  };

  // Balance-based action constraints
  // Balance = Readiness - Output (negative means output outpacing readiness)
  if (balance <= CONSTRAINT_THRESHOLDS.BALANCE_URGENT) {
    constraints.balanceContext = 'urgent_reduce';
    constraints.limitersRequireAction.push('Deload week required');
    constraints.toneMultiplier = Math.max(constraints.toneMultiplier, 2);
  } else if (balance <= CONSTRAINT_THRESHOLDS.BALANCE_REDUCE) {
    constraints.balanceContext = 'reduce';
    constraints.limitersRequireAction.push('Reduce load 15-20%');
  } else if (balance <= CONSTRAINT_THRESHOLDS.BALANCE_MAINTAIN_THRESHOLD && readinessScore >= CONSTRAINT_THRESHOLDS.READINESS_SAFE_MAINTENANCE) {
    // Output outpacing recovery, but readiness is solid
    constraints.balanceContext = 'maintain';
    constraints.limitersRequireAction.push('Maintain load, prioritize recovery quality');
  } else if (balance <= CONSTRAINT_THRESHOLDS.BALANCE_MAINTAIN_THRESHOLD) {
    // Output outpacing recovery AND readiness is weak
    constraints.balanceContext = 'reduce';
    constraints.limitersRequireAction.push('Reduce load 10-15%');
  } else if (balance >= 8) {
    constraints.balanceContext = 'ramp';
    constraints.limitersRequireAction.push('Capacity available - consider progressive increase');
  } else {
    constraints.balanceContext = 'maintain';
  }

  // Specific metric constraints
  if (limiters.sleepConsistencyScore != null) {
    if (limiters.sleepConsistencyScore > CONSTRAINT_THRESHOLDS.SLEEP_CONSISTENCY_GOOD) {
      constraints.limitersRequireAction.push('Sleep consistency solid');
    } else if (limiters.sleepConsistencyScore > CONSTRAINT_THRESHOLDS.SLEEP_CONSISTENCY_FAIR) {
      constraints.limitersRequireAction.push('Stabilize bedtime ±30 minutes');
    } else {
      constraints.limitersRequireAction.push('Fix lights-out time - major consistency gap');
    }
  }

  if (limiters.stepsPct != null) {
    if (limiters.stepsPct < CONSTRAINT_THRESHOLDS.STEPS_GOOD) {
      if (limiters.stepsPct >= CONSTRAINT_THRESHOLDS.STEPS_FAIR) {
        constraints.limitersRequireAction.push('Add 2000-3000 steps daily');
      } else {
        constraints.limitersRequireAction.push('Major step gap - prioritize 500 step walks');
      }
    }
  }

  if (limiters.rhrDelta != null && limiters.rhrDelta > CONSTRAINT_THRESHOLDS.RHR_DELTA_ALERT) {
    constraints.limitersRequireAction.push('RHR elevated - reduce load 15%');
    constraints.toneMultiplier = Math.max(constraints.toneMultiplier, 1.5);
  }

  if (limiters.acwrValue != null && limiters.acwrValue > CONSTRAINT_THRESHOLDS.ACWR_ALERT) {
    constraints.limitersRequireAction.push('ACWR spike - trim 20% volume and add 60m sleep');
    constraints.toneMultiplier = Math.max(constraints.toneMultiplier, 1.5);
  }

  return constraints;
}

function analyzeScoreDrivers_(options) {
  const {
    compositeSummary,
    fulfil,
    weekly,
    trend,
    goals,
    sleepConsistency,
    acwrValue,
    readinessTrendPct,
    outputTrendPct
  } = options || {};

  const latest = compositeSummary?.latest || {};
  const outputPct = compositeSummary?.output?.pct;
  const readinessPct = compositeSummary?.readiness?.pct;

  // Output components (from fulfillment %)
  const outputComponents = [
    { name: 'gym load', pct: fulfil?.strengthPct, weekly: weekly?.trainingLoad, trend: trend?.trainingLoad },
    { name: 'steps', pct: fulfil?.fitnessPct, weekly: weekly?.steps, trend: trend?.steps },
    { name: 'work hours', pct: fulfil?.workPct, weekly: weekly?.workHours, trend: trend?.workHours }
  ].filter(c => c.pct != null);

  // Readiness components
  const readinessComponents = [
    { name: 'sleep volume', pct: fulfil?.sleepPct, weekly: weekly?.sleep, trend: trend?.sleep },
    { name: 'sleep consistency', score: sleepConsistency?.score, label: sleepConsistency?.label },
    { name: 'resting heart rate', weekly: weekly?.rhr, trend: trend?.rhr },
    { name: 'ACWR', value: acwrValue }
  ];

  // Find output drivers
  const outputSorted = outputComponents.sort((a, b) => (b.pct || 0) - (a.pct || 0));
  const outputStrength = outputSorted[0];
  const outputLimiter = outputSorted[outputSorted.length - 1];

  // Determine if driven by this week or trailing
  const outputThisWeekImproved = outputStrength?.weekly > outputStrength?.trend;
  const outputLimiterIsTrailing = outputLimiter?.weekly <= outputLimiter?.trend;

  // Find readiness drivers
  let readinessStrength = null;
  let readinessLimiter = null;

  // Sleep volume check
  if (fulfil?.sleepPct >= 95) readinessStrength = { name: 'sleep volume', pct: fulfil.sleepPct };
  else if (fulfil?.sleepPct < 85) readinessLimiter = { name: 'sleep volume', pct: fulfil.sleepPct };

  // Sleep consistency check
  if (!readinessLimiter && sleepConsistency?.score < 65) {
    readinessLimiter = { name: 'sleep consistency', score: sleepConsistency.score };
  } else if (!readinessStrength && sleepConsistency?.score >= 80) {
    readinessStrength = { name: 'sleep consistency', score: sleepConsistency.score };
  }

  // ACWR check
  if (!readinessLimiter && acwrValue && acwrValue > 1.3) {
    readinessLimiter = { name: 'training load', acwr: acwrValue };
  }

  // RHR check (if delta is bad)
  const rhrDelta = weekly?.rhr && trend?.rhr ? weekly.rhr - trend.rhr : null;
  if (!readinessLimiter && rhrDelta && rhrDelta > 3) {
    readinessLimiter = { name: 'heart rate', delta: rhrDelta };
  }

  // Calculate balance for constraint determination
  const balance = readinessPct != null && outputPct != null ? readinessPct - outputPct : 0;

  // Determine actionable constraints
  const limitersData = {
    sleepConsistencyScore: sleepConsistency?.score,
    stepsPct: fulfil?.fitnessPct,
    rhrDelta,
    acwrValue
  };

  const constraints = determineConstraints_(outputPct, readinessPct, balance, limitersData);

  return {
    output: {
      score: outputPct,
      strength: outputStrength,
      limiter: outputLimiter,
      thisWeekDriven: outputThisWeekImproved,
      limiterIsTrailing: outputLimiterIsTrailing
    },
    readiness: {
      score: readinessPct,
      strength: readinessStrength,
      limiter: readinessLimiter
    },
    balance,
    constraints,
    trends: {
      readiness: readinessTrendPct
    }
  };
}

/**
 * Build short opening prompt (2 sentences, ~40 words)
 * Used in Tier 1 header for quick scan
 */
function buildShortOpeningPrompt_(drivers, plan) {
  const { output, readiness, constraints } = drivers || {};
  
  if (!output || !readiness) {
    return 'You are an elite Australian coach. Write two sentences summarizing output and readiness status.';
  }

  const outputDesc = describeScoreAsRange_(output.score);
  const readinessDesc = describeScoreAsRange_(readiness.score);
  const trendSymbol = drivers.trends?.readiness > 5 ? '↑' : drivers.trends?.readiness < -5 ? '↓' : '↔';
  const shouldCut = shouldReduceLoad_(constraints?.balanceContext);

  return [
    'You are an elite Australian coach giving a quick 2-sentence status update for the report header.',
    'Write exactly 2 sentences. Be direct and scannable in under 10 seconds.',
    '',
    'FORMAT:',
    'Sentence 1: [Condition] → [Status]',
    'Sentence 2: [Action] — [Next step]',
    '',
    'DATA:',
    `Output: ${outputDesc} (${output.strength?.name || 'execution'})`,
    `Readiness: ${readinessDesc}${trendSymbol} (${readiness.limiter?.name || 'mixed'})`,
    `Trend: ${drivers.trends?.readiness > 5 ? 'improving' : drivers.trends?.readiness < -5 ? 'declining' : 'steady'}`,
    `Action: ${shouldCut ? 'Cut load' : 'Maintain load'}`,
    '',
    'EXAMPLES (your style, 2 sentences each):',
    '- Output strong, readiness solid↑ on good sleep. Maintain load and lock sleep ±30min.',
    '- Output high but readiness dropped to mid-seventies. Cut load 15% and prioritize consistent sleep.',
    '- Both tracking well but steps lagging behind goal. Add 3000 steps daily; everything else steady.',
    '',
    'RULES:',
    '- EXACTLY 2 sentences',
    '- Use arrows (↑↓↔) for trends',
    '- Max 40 words total',
    '- Tone: Direct, no fluff, Australian coach',
    '- NO percentages or symbols (use ranges like "low eighties")',
    '- NO motivational language',
    '',
    'Return ONLY the two sentences. No JSON, no labels.'
  ].join('\n');
}

/**
 * Generate short opening (2 sentences)
 * Used in Tier 1 header
 */
function generateShortOpening_(drivers, plan) {
  try {
    const prompt = buildShortOpeningPrompt_(drivers, plan);
    const raw = callOpenAIChat_(prompt, { 
      model: 'gpt-4-turbo', 
      maxTokens: 120,
      temperature: 0.3 
    });
    return (raw || '').trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Short opening generation failed:', error);
    // Fallback - two sentences
    const outputDesc = drivers?.output?.score >= 90 ? 'strong' : drivers?.output?.score >= 80 ? 'solid' : 'tracking';
    const readinessDesc = drivers?.readiness?.score >= 80 ? 'solid' : drivers?.readiness?.score >= 70 ? 'caution' : 'warning';
    return `Output ${outputDesc}, readiness ${readinessDesc}. Focus on ${drivers?.readiness?.limiter?.name || 'recovery'}.`;
  }
}

/**
 * Build detailed opening summary prompt (2-3 sentences, ~120 words)
 * Used in Coach's Read section with full context
 */
function buildDetailedOpeningPrompt_(drivers, plan, balance) {
  const { output, readiness, constraints, trends } = drivers || {};
  
  if (!output || !readiness) {
    return 'You are an elite coach. Write 2-3 sentences summarizing output, readiness, and the action.';
  }

  const outputDesc = describeScoreAsRange_(output.score);
  const readinessDesc = describeScoreAsRange_(readiness.score);
  const readinessTrendNote = trends?.readiness != null
    ? trends.readiness > 5 ? ' and improving' : trends.readiness < -5 ? ' but trending down' : ''
    : '';

  // Output descriptions - no percentages in the prompt
  const outputStrengthDesc = output.strength 
    ? `${output.strength.name} performing well`
    : 'no clear strength';
  
  const outputLimiterDesc = output.limiter
    ? `${output.limiter.name} needs attention`
    : 'no clear limiter';

  const readinessStrengthDesc = readiness.strength
    ? `${readiness.strength.name}`
    : 'no clear strength';

  const readinessLimiterDesc = describeLimiter_(readiness.limiter);
  const balanceContext = describeBalance_(balance);
  const toneConfig = getToneFromThreshold_(constraints?.readinessThreshold);
  const specificLevers = getSpecificLevers_(constraints?.limitersRequireAction, 2);

  return [
    'You are an elite Australian strength and conditioning coach writing detailed opening context.',
    'Write exactly 2-3 sentences explaining output, readiness, and the specific action.',
    '',
    'SCORES & DRIVERS:',
    `Output: ${outputDesc} – ${outputStrengthDesc}, limited by ${outputLimiterDesc}`,
    `Readiness: ${readinessDesc}${readinessTrendNote} – ${readinessStrengthDesc}, held back by ${readinessLimiterDesc}`,
    `Balance: ${balanceContext}`,
    `Plan intent: ${plan}`,
    '',
    'SENTENCE STRUCTURE:',
    'Sentence 1 (WHAT): Output + readiness levels, key strengths + limiters, trend',
    'Sentence 2 (SO WHAT): What balance means, why limiter matters, system health',
    'Sentence 3 (NOW WHAT): Specific action for this week',
    '',
    'ACTION GUIDANCE:',
    `Context: ${constraints?.balanceContext || 'maintain'}`,
    specificLevers.length > 0 ? `Specific levers: ${specificLevers.join('; ')}` : 'No urgent constraints',
    '',
    'EXAMPLES:',
    '"Output high, driven by solid gym work. Readiness is solid↑ on good sleep volume, but consistency is trailing. Maintain load while locking bedtime ±30min."',
    '"Output and readiness both tracking well. Steps are the gap, running 12% below goal. Add 3000 steps daily this week; everything else holds."',
    '"Output dropping to low nineties, readiness down to mid-seventies. Sleep consistency tanked—system is waving flags. Cut volume 15%, add sleep, lock consistent bedtime."',
    '',
    `TONE: ${toneConfig.guidance}`,
    '',
    'CRITICAL RULES:',
    '- NO percentages or numbers in ranges',
    '- NO motivational language',
    '- NO mentioning missing data',
    '- DO NOT use "struggling" if readiness >= 80',
    '- Explain the SPECIFIC lever for this week',
    '',
    'Return ONLY 2-3 sentences as plain text.'
  ].join('\n');
}

/**
 * Generate detailed opening summary (2-3 sentences)
 * Used in Coach's Read > Where You're At section
 */
function generateDetailedOpening_(drivers, plan, balance) {
  const MIN_SENTENCE_LENGTH = 5;

  try {
    const prompt = buildDetailedOpeningPrompt_(drivers, plan, balance);
    const raw = callOpenAIChat_(prompt, { 
      model: 'gpt-4-turbo', 
      maxTokens: 250,
      temperature: 0.3 
    });
    
    const sentences = parseSentenceArray_(raw, MIN_SENTENCE_LENGTH);
    
    // Return 2-3 sentences max
    if (sentences.length >= 2) {
      return sentences.slice(0, 3);
    }
    
    // If we got 1 long sentence, return it wrapped in array
    if (sentences.length === 1) {
      return sentences;
    }
  } catch (error) {
    console.error('Detailed opening generation failed:', error);
  }
  
  // Fallback - array of 3 sentences
  const plan_lower = (plan || 'hold').toLowerCase();
  return [
    `Your output's tracking ${drivers?.output?.score ? 'strong' : 'steady'} while readiness ${drivers?.readiness?.score ? 'holds solid' : 'needs support'}.`,
    `The limiter is ${drivers?.readiness?.limiter?.name || 'recovery'}, creating a gap between your output and recovery capacity.`,
    `I want you to ${plan_lower === 'recover' ? 'prioritize recovery quality' : plan_lower === 'push' ? 'maintain load and monitor closely' : 'hold pattern and refine execution'}.`
  ];
}

/**
 * Build opening summary prompt with driver analysis and constraint-based guidance
 * NOTE: This is a legacy 3-sentence generator. Prefer generateShortOpening_ and generateDetailedOpening_.
 */
function buildOpeningSummaryPrompt_(drivers, plan, balance) {
  const { output, readiness, constraints, trends } = drivers || {};

  if (!output || !readiness) {
    return 'You are an elite Australian coach. Write three sentences summarizing output, readiness, and action.';
  }

  const outputDesc = describeScoreAsRange_(output.score);
  const readinessDesc = describeScoreAsRange_(readiness.score);
  const balanceDesc = describeBalance_(balance);

  // Output descriptions - no percentages
  const outputStrengthDesc = output.strength 
    ? `${output.strength.name} performing well`
    : 'no clear strength';
  
  const outputLimiterDesc = output.limiter
    ? `${output.limiter.name} needs attention`
    : 'no clear limiter';

  const readinessStrengthDesc = readiness.strength
    ? `${readiness.strength.name}`
    : 'no clear strength';

  const readinessLimiterDesc = describeLimiter_(readiness.limiter);

  // Trend context
  const readinessTrendNote = trends?.readiness != null
    ? trends.readiness > 5 ? ' and improving' : trends.readiness < -5 ? ' but trending down' : ''
    : '';

  // Tone and action guidance
  const toneConfig = getToneFromThreshold_(constraints?.readinessThreshold);
  const specificLevers = getSpecificLevers_(constraints?.limitersRequireAction, 2);
  
  let actionGuidance = 'Maintain current approach';
  if (shouldReduceLoad_(constraints?.balanceContext)) {
    actionGuidance = constraints.balanceContext === 'urgent_reduce' 
      ? 'Immediate load reduction required'
      : 'Reduce load 10-20% this week';
  } else if (shouldMaintainLoad_(constraints?.balanceContext)) {
    actionGuidance = 'Maintain load, prioritize recovery execution';
  } else if (shouldRamp_(constraints?.balanceContext)) {
    actionGuidance = 'Capacity available - consider progressive increase';
  }

  return [
    'You are an elite Australian strength and conditioning coach giving a 3-sentence opening brief.',
    'Write in first person coaching voice - use "your", "you", "you\'ve", "mate".',
    '',
    'SCORES & DRIVERS:',
    `- Output: ${outputDesc} – ${outputStrengthDesc}, limited by ${outputLimiterDesc}`,
    `- Readiness: ${readinessDesc}${readinessTrendNote} – ${readinessStrengthDesc}, held back by ${readinessLimiterDesc}`,
    `- Balance: ${balanceDesc}`,
    `- Plan: ${plan}`,
    '',
    'SENTENCE STRUCTURE:',
    'Sentence 1 (WHAT): Output + readiness scores with drivers',
    'Sentence 2 (SO WHAT): What balance means for capacity',
    'Sentence 3 (NOW WHAT): Specific action for this week',
    '',
    'ACTION GUIDANCE:',
    `- Context: ${constraints?.balanceContext || 'maintain'}`,
    `- Action: ${actionGuidance}`,
    specificLevers.length > 0 ? `- Levers: ${specificLevers.join('; ')}` : '',
    '',
    `TONE: ${toneConfig.guidance}`,
    '- If readiness >= 80: Use "solid", "on track", "executing well"',
    '- If readiness < 75: Be direct - "system struggling", "waving red flags"',
    '',
    'CRITICAL RULES:',
    '- NO percentages or symbols',
    '- NO motivational language',
    '- NO mentioning missing data',
    '- DO NOT use "struggling" if readiness >= 80',
    '',
    'Return ONLY 3 sentences, nothing else.'
  ].join('\n');
}

/**
 * Generate opening summary using AI with structured driver analysis
 */
function generateOpeningSummary_(drivers, plan, balance) {
  try {
    const prompt = buildOpeningSummaryPrompt_(drivers, plan, balance);
    const raw = callOpenAIChat_(prompt, { 
      model: 'gpt-4-turbo', 
      maxTokens: 200, 
      temperature: 0.3 
    });
    
    // Clean up response
    const cleaned = String(raw || '')
      .trim()
      .replace(/^["']|["']$/g, '') // Remove wrapping quotes
      .replace(/\n\n+/g, ' ') // Collapse multiple newlines
      .trim();
    
    if (cleaned && cleaned.length > 20) {
      // Split into sentences and return as array
      const sentences = cleaned
        .split(/\.(?=\s+[A-Z])/) // Split on period followed by space and capital
        .map(s => s.trim() + (s.endsWith('.') ? '' : '.'))
        .filter(s => s.length > 5);
      
      return sentences.length >= 3 ? sentences.slice(0, 3) : [cleaned];
    }
  } catch (error) {
    console.error('Opening summary generation failed', error);
  }
  
  // Fallback
  return [
    `Your output's tracking ${drivers.output.score ? 'steady' : 'limited'} while readiness ${drivers.readiness.score ? 'holds' : 'needs work'}.`,
    `Body's showing you can ${plan === 'push' ? 'add load' : plan === 'recover' ? 'need recovery' : 'hold pattern'}.`,
    `I want you to ${plan === 'recover' ? 'pull back and bank sleep' : plan === 'push' ? 'add one quality session' : 'maintain current rhythm'}.`
  ];
}

function coachReadToProse_(coachRead) {
  if (!coachRead) return '';
  const block = (title, lines) => {
    if (!lines || !lines.length) return '';
    return `${title}:\n${lines.join('\n')}`;
  };
  return [
    block('Where You’re At', coachRead.whereYoureAt),
    block('Next Orders', coachRead.nextOrders),
    block('Plays You Can’t Have Both Ways', coachRead.tradeOffs),
    block('Gut Checks', coachRead.gutChecks)
  ].filter(Boolean).join('\n\n');
}

function generateCoachRead_(context) {
  try {
    const prompt = buildCoachReadPrompt_(context);
    const raw = callOpenAIChat_(prompt, { model: 'gpt-4-turbo', maxTokens: 400, temperature: 0.2 });
    const parsed = normaliseCoachRead_(parseCoachReadJson_(raw));
    if (validateCoachRead_(parsed)) {
      return parsed;
    }
    console.warn('CoachRead validation failed, using fallback.');
  } catch (error) {
    console.error('CoachRead generation failed', error);
  }
  return fallbackCoachRead_(context);
}

function buildFallbackActionSentence(sectionKey, band) {
  const variant = getBandVariantKey(band);
  const fallbackMap = ACTION_DEDUP_FALLBACK[sectionKey] || {};
  const base = fallbackMap[variant] || fallbackMap.default || 'Adjust this lever deliberately.';
  return base.endsWith('.') ? base : `${base}.`;
}

function toPercentWord(text) {
  if (!text) return '—';
  return String(text).replace(/%/g, ' percent');
}

function percentAsText(pct){
  if (pct == null || isNaN(pct)) return 'no percent insight';
  const rounded = Math.round(pct);
  return `${rounded} percent`;
}

function formatMinutesToWords(totalMinutes){
  if (totalMinutes == null || isNaN(totalMinutes)) return 'no recorded minutes';
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (mins) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  if (!parts.length) parts.push('0 minutes');
  return parts.join(' ');
}

function formatSectionValue(sectionKey, value){
  if (value == null || value === '') return 'no data logged';
  const numericValue = Number(value);
  if (!isFinite(numericValue)) return 'no data logged';
  switch (sectionKey) {
    case 'work':
      return `${(Math.round(numericValue * 10) / 10).toString()} hours`;
    case 'strength':
      return `${Math.round(numericValue).toLocaleString()} kilograms`;
    case 'fitness':
      return `${Math.round(numericValue).toLocaleString()} steps`;
    case 'sleep':
      return formatMinutesToWords(numericValue);
    case 'readiness':
      return `${Math.round(numericValue)} beats per minute`;
    default:
      return `${Math.round(numericValue)}`;
  }
}

function buildActionSentence(sectionKey, band, hasGoal, betterIsLower){
  const library = ACTION_LIBRARY[sectionKey] || {};
  if (!hasGoal) return library.noGoal || 'Set a goal to guide next week.';
  if (!band || band === 'unknown') return library.unknown || 'Track this metric to steer next steps.';
  const base = library[band];
  if (base) return base;
  if (band.startsWith('yellow')) return betterIsLower ? (library.yellow_high || library.yellow_low) : (library.yellow_low || library.yellow_high) || library.green;
  if (band.startsWith('red')) return betterIsLower ? (library.red_high || library.red_low) : (library.red_low || library.red_high) || library.yellow_low || library.red_low;
  return library.green || 'Stay the course.';
}

function buildContextClause(sectionKey, context){
  const { weeklyValue, trendValue, extra } = context;
  switch (sectionKey) {
    case 'work':
      if (trendValue && weeklyValue >= trendValue * CONFIG.Trend.workHigh) {
        return 'Work time beats the four week norm; protect recovery.';
      }
      break;
    case 'strength':
      if ((trendValue && weeklyValue >= trendValue * CONFIG.Trend.strengthHigh) || (extra && extra.acwrRatio && extra.acwrRatio >= CONFIG.ACWR.amber)) {
        return 'Load tops four week average; keep next week easy.';
      }
      break;
    case 'fitness':
      if (trendValue && weeklyValue <= trendValue * CONFIG.Trend.fitnessLow) {
        return 'Steps trail four week trend; plan extra walks.';
      }
      break;
    case 'sleep':
      if (extra && extra.sleepConsistencyScore != null && extra.sleepConsistencyScore < 65) {
        return 'Sleep rhythm drifting; lock in lights-out times.';
      }
      if (trendValue && weeklyValue <= trendValue * CONFIG.Trend.sleepLow) {
        return 'Sleep time dipped below trend; wind down earlier.';
      }
      break;
    case 'readiness':
      if (trendValue && weeklyValue >= trendValue + CONFIG.Trend.readinessHighDelta) {
        return 'Heart rate trend climbing; schedule extra recovery.';
      }
      break;
    default:
      break;
  }
  return null;
}

function buildSectionNarrative(sectionKey, options, contextCollector, recommendations){
  const cfg = SECTION_CONFIG[sectionKey];
  const sentences = [];
  let contextHighlight = null;
  const { weeklyValue, goalValue, fulfilPct, band, trendValue, extra } = options || {};
  const betterIsLower = cfg ? cfg.betterIsLower : false;

  sentences.push(buildStatusSentence(sectionKey, cfg, options || {}));

  const clause = ACTION_WHERE_HOW[sectionKey] || '';
  let actionSentence = appendWhereHowClause(
    buildActionSentence(sectionKey, band, Boolean(goalValue), betterIsLower),
    clause
  );

  if (isDuplicateWithRecommendations(actionSentence, recommendations)) {
    actionSentence = appendWhereHowClause(
      buildFallbackActionSentence(sectionKey, band),
      clause
    );
    if (isDuplicateWithRecommendations(actionSentence, recommendations)) {
      actionSentence = appendWhereHowClause('Action: Follow this lever in a fresh way.', clause);
    }
  }

  sentences.push(actionSentence);

  const context = buildContextClause(sectionKey, { weeklyValue, trendValue, extra });
  if (context) {
    sentences.push(`Context: ${context}`);
    contextHighlight = context;
  }

  if (contextHighlight && Array.isArray(contextCollector)) {
    contextCollector.push({ section: SECTION_LABEL_SHORT[sectionKey] || sectionKey, message: contextHighlight });
  }

  return { text: sentences.join(' '), contextHighlight };
}

function composeBaselineSections_(weekly, trend, goals, ds, fulfil, bands, decision, recommendations){
  const strengthAcwr = ds?.load?.acwr;
  const sleepConsistency = ds?.sleep?.consistency || {};
  const contextHighlights = [];

  const activitySummary = buildSectionNarrative('work', {
    weeklyValue: weekly.workHours,
    goalValue: goals.weeklyWorkHours || null,
    fulfilPct: fulfil.workPct,
    band: bands.work,
    trendValue: trend.workHours,
    extra: {
      acwrRatio: strengthAcwr?.ratio || strengthAcwr?.value || null
    }
  }, contextHighlights, recommendations);

  const strengthGoalValue = goals.weeklyTrainingLoad || (fulfil.strengthProxyGoal ? trend.trainingLoad : null);
  const strengthSummary = buildSectionNarrative('strength', {
    weeklyValue: weekly.trainingLoad,
    goalValue: strengthGoalValue,
    fulfilPct: fulfil.strengthPct,
    band: bands.strength,
    trendValue: trend.trainingLoad,
    extra: {
      acwrRatio: strengthAcwr?.ratio || strengthAcwr?.value || null,
      goalDescriptor: fulfil.strengthProxyGoal ? 'proxy goal (four week average)' : 'goal'
    }
  }, contextHighlights, recommendations);

  const fitnessSummary = buildSectionNarrative('fitness', {
    weeklyValue: weekly.steps,
    goalValue: goals.steps || null,
    fulfilPct: fulfil.fitnessPct,
    band: bands.fitness,
    trendValue: trend.steps,
    extra: {}
  }, contextHighlights, recommendations);

  const sleepSummary = buildSectionNarrative('sleep', {
    weeklyValue: weekly.sleep,
    goalValue: goals.sleepMinutes || null,
    fulfilPct: fulfil.sleepPct,
    band: bands.sleep,
    trendValue: trend.sleep,
    extra: {
      sleepConsistencyScore: sleepConsistency.score
    }
  }, contextHighlights, recommendations);

  const readinessSummary = buildSectionNarrative('readiness', {
    weeklyValue: weekly.rhr,
    goalValue: goals.restingHeartRate || null,
    fulfilPct: fulfil.rhrPct,
    band: bands.readiness,
    trendValue: trend.rhr,
    extra: {}
  }, contextHighlights, recommendations);

  const coachCall = buildCoachCall(bands, contextHighlights, decision);

  return {
    activityBullets: [activitySummary.text, strengthSummary.text, fitnessSummary.text],
    recoveryBullets: [sleepSummary.text],
    readinessBullets: [readinessSummary.text],
    contextHighlights,
    coachCall
  };
}


function buildCoachCall(bands, contexts, decision){
  if (!bands) return '';
  const met = [];
  const watch = [];
  const strain = [];
  Object.keys(SECTION_LABEL_SHORT).forEach(key => {
    const label = SECTION_LABEL_SHORT[key];
    const band = bands[key];
    if (!band || band === 'unknown') return;
    if (band === 'green') {
      met.push(label);
    } else if (band.startsWith('yellow')) {
      watch.push(label);
    } else if (band.startsWith('red')) {
      strain.push(label);
    }
  });

  const parts = [];
  if (met.length) parts.push(`Goals met: ${formatList(met)}.`);
  if (watch.length) parts.push(`Watch: ${formatList(watch)}.`);
  if (strain.length) parts.push(`Needs action: ${formatList(strain)}.`);

  if (contexts && contexts.length) {
    const highlight = contexts[0];
    parts.push(`${highlight.section}: ${highlight.message}.`);
  }

  if (decision && decision.plan) {
    let planLine = '';
    switch (decision.plan) {
      case 'Push':
        planLine = 'Plan: Push with a measured progression while monitoring recovery.';
        break;
      case 'Deload':
        planLine = 'Plan: Deload and bank recovery time.';
        break;
      case 'Sustain':
      default:
        planLine = 'Plan: Hold steady and reinforce routines.';
        break;
    }
    parts.push(planLine);
  }

  return parts.join(' ');
}

// Reporter functions extracted to Reporters.js:
// - renderCoachReadSection_()
// - buildCapacitySentence()
// - buildPlanSummaryText_()
// - distributeReport()

// --- Logging (top-level) ---


