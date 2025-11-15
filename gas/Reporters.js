/**
 * Reporters.js
 * 
 * Email and HTML report generation module.
 * 
 * Extracted functions:
 * - distributeReport() - Main email/HTML generation and delivery (~450 lines)
 * - renderCoachReadSection_() - Coach read HTML section rendering
 * - buildCapacitySentence() - Capacity decision text builder
 * - buildPlanSummaryText_() - Plan narrative text generator
 * 
 * Dependencies:
 * - Constants.js (CONFIG, COACH_VOICE, formatters)
 * - Formatters.js (escapeHtml_, sanitizeTextForHtml_, fmtInt, fmtBpm, fmtHMin, fmtDurationMinutes_, fmtAcwr, bandToLabel_, bandToStatusClass_, gradeFromScore_)
 * - Validators.js (escapeHtml_, sanitizeTextForHtml_)
 * - Scoring.js (scoreActivityBucket_, scoreWorkBucket_, scoreLoadBucket_, scoreSleepBucket_, computeTotalScore_, gradeFromScore_)
 * - JobPipeline.js (logWeeklyJob_, logEmailLogEntry_)
 * - Main.js helpers (parseSignedNumber_, getStatusClass_, computeIsoWeekNumber_)
 */

/**
 * Email report HTML/CSS styling
 * - Responsive design with CSS custom properties
 * - Color scheme: Primary blue, gray scale, status colors
 * - Email-safe structure for Gmail/Outlook compatibility
 */
const EMAIL_REPORT_CSS = `
  :root {
    --color-primary: #2C6BED;
    --color-gray-900: #111827;
    --color-gray-700: #374151;
    --color-gray-600: #4B5563;
    --color-gray-500: #6B7280;
    --color-gray-300: #D1D5DB;
    --color-gray-200: #E5E7EB;
    --color-gray-50: #F9FAFB;
    --color-success: #10B981;
    --color-warning: #F59E0B;
    --color-danger: #EF4444;
    --color-purple: #8B5CF6;
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 16px;
    --space-4: 24px;
    --space-5: 32px;
    --radius-card: 12px;
  }
  body { font-family: 'Inter', sans-serif; color: var(--color-gray-900); line-height: 1.6; font-size: 14px; background: var(--color-gray-50); }
  .container { max-width: 900px; margin: auto; padding: var(--space-5); background: #fff; border-radius: 20px; box-shadow: 0 12px 32px rgba(17,24,39,0.08); }
  h1 { font-size: 28px; margin: 0 0 var(--space-3); color: var(--color-gray-900); }
  h2 { font-size: 18px; margin: 0 0 var(--space-2); color: var(--color-gray-900); }
  p { margin: 0; }
  .t1 { border-bottom: 1px solid var(--color-gray-200); padding-bottom: var(--space-4); margin-bottom: var(--space-4); }
  .t1-row { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: flex-start; }
  .t1-main { flex: 1 1 280px; }
  .t1-week { font-size: 12px; color: var(--color-gray-500); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--space-1); }
  .t1-score { display: flex; align-items: baseline; gap: var(--space-2); font-weight: 700; margin-bottom: var(--space-1); }
  .t1-score-grade { font-size: 48px; font-weight: 700; line-height: 1; }
  .t1-score-meta { font-size: 12px; color: var(--color-gray-600); text-transform: uppercase; letter-spacing: 0.08em; }
  .t1-plan { font-size: 14px; font-weight: 600; color: var(--color-gray-700); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--space-2); }
  .plan-copy { font-size: 13px; color: var(--color-gray-700); margin-bottom: var(--space-3); line-height: 1.4; }
  .t1-tiles { flex: 1 1 220px; display: grid; gap: var(--space-3); }
  .tile { background: var(--color-gray-50); border: 1px solid var(--color-gray-200); border-radius: var(--radius-card); padding: var(--space-3); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); }
  .tile-label { font-size: 12px; color: var(--color-gray-500); text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: var(--space-1); }
  .tile-value { font-size: 34px; font-weight: 700; color: var(--color-gray-900); line-height: 1; }
  .tile-trend { font-size: 12px; color: var(--color-gray-600); margin-top: var(--space-1); }
  .tile-subtitle { font-size: 13px; color: var(--color-gray-700); margin-top: var(--space-1); line-height: 1.4; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .badge.status-success { background: rgba(16,185,129,0.16); color: var(--color-success); }
  .badge.status-warning { background: rgba(245,158,11,0.16); color: var(--color-warning); }
  .badge.status-danger { background: rgba(239,68,68,0.16); color: var(--color-danger); }
  .badge.status-purple { background: rgba(139,92,246,0.16); color: var(--color-purple); }
  .badge.status-neutral { background: rgba(55,65,81,0.12); color: var(--color-gray-700); }
  .card-score { display: flex; align-items: baseline; gap: var(--space-2); margin-bottom: var(--space-1); }
  .card-grade { font-size: 32px; font-weight: 700; color: var(--color-gray-900); line-height: 1; }
  .card-score-meta { font-size: 12px; color: var(--color-gray-600); text-transform: uppercase; letter-spacing: 0.08em; }
  .card-severity { font-size: 12px; color: var(--color-gray-600); margin-bottom: var(--space-2); letter-spacing: 0.04em; text-transform: uppercase; }
  .banner { padding: var(--space-2); border-radius: var(--radius-card); margin-bottom: var(--space-3); font-size: 13px; }
  .banner-warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: var(--color-warning); }
  .banner-neutral { background: rgba(44,107,237,0.08); border: 1px solid rgba(44,107,237,0.2); color: var(--color-primary); }
  .t2 { margin-bottom: var(--space-4); display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); }
  .card { border: 1px solid var(--color-gray-200); border-top: 4px solid var(--color-gray-200); border-radius: var(--radius-card); padding: var(--space-3); background: #fff; box-shadow: 0 6px 18px rgba(17,24,39,0.05); }
  .card h2 { font-size: 16px; margin-bottom: var(--space-2); }
  .card ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
  .card ul li { display: flex; justify-content: space-between; font-size: 13px; color: var(--color-gray-700); }
  .card ul li span:last-child { font-weight: 600; color: var(--color-gray-900); }
  .card-insight { margin-top: var(--space-2); font-size: 13px; color: var(--color-gray-700); }
  .card--recovery { border-top-color: var(--color-purple); }
  .card--workload { border-top-color: var(--color-danger); }
  .card--activity { border-top-color: var(--color-success); }
  .card--cognition { border-top-color: var(--color-warning); }
  .insights { margin-bottom: var(--space-4); }
  .insights ul { list-style: disc inside; margin: 0; padding: 0; color: var(--color-gray-700); }
  .t-method { border: 1px solid var(--color-gray-200); border-radius: var(--radius-card); padding: var(--space-3); margin-bottom: var(--space-4); background: rgba(17,24,39,0.02); }
  .t-method h2 { font-size: 16px; margin-bottom: var(--space-2); color: var(--color-gray-900); }
  .method-list { margin: 0; padding-left: var(--space-3); display: grid; gap: var(--space-2); color: var(--color-gray-700); }
  .method-list li { font-size: 13px; line-height: 1.5; }
  .method-list strong { color: var(--color-gray-900); }
  .t3-table { width: 100%; border-collapse: collapse; margin-bottom: var(--space-4); }
  .t3-table th, .t3-table td { padding: var(--space-2); text-align: left; font-size: 13px; }
  .t3-table th { background: var(--color-gray-50); color: var(--color-gray-700); text-transform: uppercase; letter-spacing: 0.04em; }
  .t3-table tr:nth-child(even) { background: rgba(17,24,39,0.02); }
  .t3-table td { color: var(--color-gray-900); }
  .t4 { border-top: 1px solid var(--color-gray-200); padding-top: var(--space-4); margin-bottom: var(--space-4); }
  .coach-plan { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
  .coach-plan-icon { font-size: 26px; line-height: 1; }
  .coach-plan h2 { font-size: 18px; margin: 0; }
  .coach-note { font-size: 13px; color: var(--color-gray-700); margin-bottom: var(--space-2); }
  .coach-bullets { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
  .coach-bullets li { display: flex; gap: var(--space-2); align-items: baseline; font-size: 13px; }
  .coach-tag { display: inline-block; min-width: 70px; font-size: 11px; text-transform: uppercase; color: var(--color-gray-500); letter-spacing: 0.05em; }
  .coach-read { border: 1px solid var(--color-gray-200); border-radius: var(--radius-card); padding: var(--space-4); margin-bottom: var(--space-4); background: var(--color-gray-50); }
  .coach-read h2 { font-size: 18px; margin: 0 0 var(--space-2); color: var(--color-gray-800); }
  .coach-read-block { margin-bottom: var(--space-3); }
  .coach-read-block h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-gray-500); margin: 0 0 var(--space-1); }
  .coach-read-block p { margin: 0 0 var(--space-1); font-size: 13px; color: var(--color-gray-800); }
  .coach-read-block ul { margin: 0; padding-left: var(--space-3); }
  .coach-read-block li { font-size: 13px; color: var(--color-gray-800); margin: 0 0 var(--space-1); }
  .t5 { background: rgba(17,24,39,0.02); border: 1px solid var(--color-gray-200); border-radius: var(--radius-card); padding: var(--space-3); }
  .t5 h2 { font-size: 16px; margin-bottom: var(--space-2); }
  .t5 pre { background: rgba(17,24,39,0.04); border-radius: var(--radius-card); padding: var(--space-2); font-family: 'Roboto Mono', monospace; font-size: 12px; white-space: pre-wrap; color: var(--color-gray-700); }
  .page-break-before { page-break-before: always; break-before: page; }
  @media print { body { background: #fff; } .container { box-shadow: none; } }
`;

/**
 * Ensures a bucket score has grade, band, and display properties
 * - Computes grade from score if missing
 * - Used for sleep, load, activity, work buckets
 * @param {Object} bucketScore - Score object with score property
 * @return {Object} Score with grade, band, bandClass, bandLabel, scoreText
 */
function ensureBucketGrade_(bucketScore) {
  if (!bucketScore.grade) {
    const info = gradeFromScore_(bucketScore.score);
    bucketScore.grade = info.grade;
    bucketScore.band = info.band;
    bucketScore.bandClass = bandToStatusClass_(info.band);
    bucketScore.bandLabel = bandToLabel_(info.band);
    bucketScore.scoreText = bucketScore.score != null ? `${bucketScore.score}/100` : '';
  }
  return bucketScore;
}

// Magic constants for capacity decision logic
const CAPACITY_WORK_THRESHOLD_LOW = 0.85;  // Work hours below 85% of goal = "below target"
const CAPACITY_WORK_THRESHOLD_HIGH = 0.95;  // Work hours at 95%+ of goal = "near plateau"
const CAPACITY_SENTENCE_MAX_LENGTH = 180;    // Max chars before dropping clauses from sentence

/**
 * Check if a metric value is non-zero (not one of the standard "no data" strings)
 * @param {string|number|null} value - Metric value to check
 * @param {string[]} zeroStrings - Array of strings representing "zero" (e.g., ['—', '+0h 0m'])
 * @return {boolean} True if value is present and not a zero string
 */
function isNonZeroMetric_(value, zeroStrings) {
  if (value == null || value === '' || value === '—') return false;
  return !zeroStrings.includes(String(value).trim());
}

// AI configuration constants
const AI_CONFIG = {
  MAX_TOKENS: 80,
  TEMPERATURE: 0.5,
  MIN_RESPONSE_LENGTH: 20
};

// Threshold constants
const THRESHOLDS = {
  ACWR_SPIKE: 1.3,
  RHR_ELEVATED: 3,
  SLEEP_DEFICIT: 90,
  SLEEP_CONSISTENCY: 60,
  STEPS_LOW: 75,
  WORK_OVERLOAD: 110
};

/**
 * Helper function to expand text with AI, with fallback
 */
function expandWithAI_(prompt, fallback) {
  try {
    const aiText = callOpenAIChat_(prompt, {
      model: 'gpt-4o-mini',
      maxTokens: AI_CONFIG.MAX_TOKENS,
      temperature: AI_CONFIG.TEMPERATURE
    });
    
    if (aiText && aiText.trim().length >= AI_CONFIG.MIN_RESPONSE_LENGTH) {
      return aiText.trim();
    }
  } catch (error) {
    Logger.log(`AI expansion failed: ${error.message}`);
  }
  return fallback;
}

function buildPlanSummaryText_(readinessPct, outputPct, readinessTrend, outputTrend, balance, context = {}) {
  const isValidNumber = v => v != null && typeof v === 'number' && isFinite(v);
  
  if (!isValidNumber(readinessPct) || !isValidNumber(outputPct)) {
    return 'Maintain current workload and protect bedtime/wake windows.';
  }
  
  const {
    acwr = null,
    sleepPct = null,
    gymPct = null,
    stepsPct = null,
    workPct = null,
    rhrDelta = null,
    floorDays = null,
    sleepSd = null
  } = context;
  
  // Find limiting factor (priority order)
  const limiters = [];
  
  // 1. ACWR spike (highest priority - injury risk)
  if (isValidNumber(acwr) && acwr >= THRESHOLDS.ACWR_SPIKE) {
    limiters.push({
      priority: 1,
      type: 'acwr_spike',
      core: `ACWR ${acwr.toFixed(2)} (spike)—trim 20% gym volume this week.`,
      context: `Sleep ${sleepPct}%, steps ${stepsPct}%.`,
      aiPrompt: `Training load spiked (ACWR ${acwr.toFixed(2)}). Sleep at ${sleepPct}%, steps ${stepsPct}%. Recommend: reduce gym volume 20%. Expand to 20-30 words with context about injury risk and recovery timing.`
    });
  }
  
  // 2. RHR elevated (recovery issue)
  if (isValidNumber(rhrDelta) && rhrDelta >= THRESHOLDS.RHR_ELEVATED) {
    limiters.push({
      priority: 2,
      type: 'rhr_elevated',
      core: `RHR +${Math.round(rhrDelta)}bpm—extra rest day this week.`,
      context: `Sleep ${sleepPct}%, gym ${gymPct}%.`,
      aiPrompt: `Resting heart rate elevated +${Math.round(rhrDelta)}bpm. Sleep ${sleepPct}%, gym ${gymPct}%. Recommend: extra rest day. Expand to 20-30 words explaining recovery signals and training adjustment.`
    });
  }
  
  // 3. Sleep deficit
  if (isValidNumber(sleepPct) && sleepPct < THRESHOLDS.SLEEP_DEFICIT) {
    const deficit = sleepPct < 85 ? 'significantly short' : 'short';
    limiters.push({
      priority: 3,
      type: 'sleep_deficit',
      core: `Sleep ${sleepPct}% (${deficit})—add 60min tonight.`,
      context: `Gym ${gymPct}%, steps ${stepsPct}%.`,
      aiPrompt: `Sleep at ${sleepPct}% of goal (${deficit}). Gym ${gymPct}%, steps ${stepsPct}%. Recommend: add 60min sleep tonight. Expand to 20-30 words about recovery debt and performance impact.`
    });
  }
  
  // 4. Sleep consistency poor
  if (isValidNumber(sleepSd) && sleepSd >= THRESHOLDS.SLEEP_CONSISTENCY) {
    limiters.push({
      priority: 4,
      type: 'sleep_consistency',
      core: `Sleep inconsistent (SD ${Math.round(sleepSd)}min)—fix bedtime/wake windows.`,
      context: `Gym ${gymPct}%, steps ${stepsPct}%.`,
      aiPrompt: `Sleep inconsistent (standard deviation ${Math.round(sleepSd)} minutes). Gym ${gymPct}%, steps ${stepsPct}%. Recommend: anchor bedtime/wake times. Expand to 20-30 words on circadian rhythm and consistency benefits.`
    });
  }
  
  // 5. Steps/cardio low
  if (isValidNumber(stepsPct) && stepsPct < THRESHOLDS.STEPS_LOW) {
    const floorContext = isValidNumber(floorDays) ? ` Floor days ${floorDays}/5.` : '';
    limiters.push({
      priority: 5,
      type: 'steps_low',
      core: `Steps ${stepsPct}%—walk 30min after dinner.${floorContext}`,
      context: `Gym ${gymPct}%, sleep ${sleepPct}%.`,
      aiPrompt: `Steps at ${stepsPct}% of goal${floorContext ? `, floor days ${floorDays}/5` : ''}. Gym ${gymPct}%, sleep ${sleepPct}%. Recommend: 30min walk after dinner. Expand to 20-30 words on base cardio and recovery activity.`
    });
  }
  
  // 6. Work hours high
  if (isValidNumber(workPct) && workPct > THRESHOLDS.WORK_OVERLOAD) {
    limiters.push({
      priority: 6,
      type: 'work_overload',
      core: `Work ${workPct}% (high)—protect two focus blocks daily.`,
      context: `Sleep ${sleepPct}%, gym ${gymPct}%.`,
      aiPrompt: `Work hours at ${workPct}% (above target). Sleep ${sleepPct}%, gym ${gymPct}%. Recommend: protect two focus blocks daily. Expand to 20-30 words on cognitive load and stress management.`
    });
  }
  
  // Sort by priority and pick the top limiter
  limiters.sort((a, b) => a.priority - b.priority);
  
  if (limiters.length > 0) {
    const limiter = limiters[0];
    const fallback = `${limiter.core} ${limiter.context}`.trim();
    return expandWithAI_(limiter.aiPrompt, fallback);
  }
  
  // No clear limiter - everything balanced
  const metrics = [];
  if (isValidNumber(sleepPct)) metrics.push(`Sleep ${sleepPct}%`);
  if (isValidNumber(gymPct)) metrics.push(`gym ${gymPct}%`);
  if (isValidNumber(stepsPct)) metrics.push(`steps ${stepsPct}%`);
  
  const metricsText = metrics.length > 0 ? ` ${metrics.join(', ')}.` : '';
  const balancedCore = `Metrics balanced—maintain current rhythm.${metricsText}`;
  const balancedPrompt = `All metrics on track: Sleep ${sleepPct}%, gym ${gymPct}%, steps ${stepsPct}%. Expand to 20-30 words encouraging consistency and noting what's working well.`;
  
  return expandWithAI_(balancedPrompt, balancedCore.trim());
}

function renderCoachReadSection_(coachRead) {
  if (!coachRead) return '';
  const renderParagraphs = lines => (lines && lines.length) ? lines.map(line => `<p>${line}</p>`).join('') : '';
  const renderList = lines => (lines && lines.length)
    ? `<ul>${lines.map(line => `<li>${line}</li>`).join('')}</ul>`
    : '';

  return `
    <section class="coach-read">
      <h2>Coach&rsquo;s Read</h2>
      <div class="coach-read-block">
        <h3>Where You&rsquo;re At</h3>
        ${renderParagraphs(coachRead.whereYoureAt)}
      </div>
      <div class="coach-read-block">
        <h3>Next Orders</h3>
        ${renderList(coachRead.nextOrders)}
      </div>
      <div class="coach-read-block">
        <h3>Plays You Can&rsquo;t Have Both Ways</h3>
        ${renderList(coachRead.tradeOffs)}
      </div>
      <div class="coach-read-block">
        <h3>Gut Checks</h3>
        ${renderList(coachRead.gutChecks)}
      </div>
    </section>
  `;
}

function buildCapacitySentence(capacity, decision, ds, weekly, goals){
  if (!capacity || !decision || !ds) return '';
  
  const recoveryBits = [];
  if (ds.sleep && ds.sleep.deltaGoalStr && isNonZeroMetric_(ds.sleep.deltaGoalStr, ['—', '+0h 0m'])) {
    recoveryBits.push(`Sleep ${ds.sleep.deltaGoalStr}`);
  }
  const rhrDelta = ds.rhr && ds.rhr.deltaTrendStr;
  if (isNonZeroMetric_(rhrDelta, ['+0 bpm', '0 bpm'])) {
    recoveryBits.push(`RHR ${rhrDelta}`);
  }
  const recoveryClause = recoveryBits.length ? recoveryBits.join(' & ') : 'Recovery steady';

  const strainBits = [];
  if (ds.load && ds.load.pctTrendStr && isNonZeroMetric_(ds.load.pctTrendStr, ['0%', '+0%'])) {
    let clause = `Load ${ds.load.pctTrendStr}`;
    const acwr = ds.load.acwr;
    if (acwr && acwr.value != null && acwr.label !== 'Data Gaps' && (acwr.value >= CONFIG.ACWR.alertHigh || acwr.value <= CONFIG.ACWR.alertLow)) {
      clause += ` (ACWR ${fmtAcwr(acwr.value)})`;
    }
    strainBits.push(clause);
  }
  const strainClause = strainBits.length ? strainBits.join(' & ') : 'Strain stable';

  const bandwidthBits = [];
  const workGoal = goals.weeklyWorkHours || 0;
  const workHours = weekly.workHours || 0;
  if (workGoal && workHours < CAPACITY_WORK_THRESHOLD_LOW * workGoal) {
    bandwidthBits.push('Work below target');
  } else if (workGoal && workHours >= CAPACITY_WORK_THRESHOLD_HIGH * workGoal) {
    bandwidthBits.push('Work near plateau');
  }
  if (ds.steps && ds.steps.days6k < Math.max(CONFIG.Steps.purpleMinDays, (goals.stepsFloorDays || CONFIG.Steps.fallbackFloorDays))) {
    bandwidthBits.push('Movement inconsistent');
  }
  const sleepConsistency = ds.sleep?.consistency;
  if (sleepConsistency && sleepConsistency.score != null && sleepConsistency.score < CONFIG.Sleep.consistencyAmber) {
    const label = (sleepConsistency.label || 'Irregular').toLowerCase();
    bandwidthBits.push(`Sleep ${label} (SRI ${sleepConsistency.score}/100)`);
  }
  const bandwidthClause = bandwidthBits.length ? bandwidthBits.join(' & ') : 'Bandwidth steady';

  const clauses = [recoveryClause, strainClause, bandwidthClause];
  while (clauses.length > 0) {
    const sentence = `Capacity: ${capacity.label} — ${clauses.join('; ')}. ${decision.plan}: ${decision.lever}`;
    if (sentence.length <= CAPACITY_SENTENCE_MAX_LENGTH) return sentence;
    clauses.pop();
  }
  return `Capacity: ${capacity.label} — ${recoveryClause}. ${decision.plan}: ${decision.lever}`;
}

/**
 * Generates and distributes HTML email report with complete health metrics
 * 
 * Main function orchestrating email/HTML generation and delivery.
 * Renders system driver cards, metrics table, coach notes, and appendix.
 * 
 * @param {Object} report - Report metadata and bucket scores
 * @param {Object} scores - Score computation results
 * @param {Object} weekly - Weekly metrics (sleep, rhr, steps, work)
 * @param {Object} trend - 4-week trend metrics
 * @param {Object} goals - User goals (sleep minutes, steps, work hours, etc.)
 * @param {string[]} [warnings=[]] - Alert messages (ACWR, data gaps, etc.)
 * @param {Object|null} [dsStats=null] - Data stats (load, sleep, steps, work, rhr details)
 * @param {Object|null} [capacity=null] - Capacity decision object {label, display}
 * @param {Object|null} [decision=null] - Action decision {plan, lever, label}
 * @param {string} [gapsNote=''] - Message if data gaps detected
 * @param {string} [degradeBanner=''] - Message if AI degraded or fallback triggered
 * @param {Object|null} [weekMeta=null] - Week metadata {label, iso, number}
 * @param {Object|null} [composites=null] - Composite readiness/output data
 * @param {Object|null} [emailLogMeta=null] - Email log metadata
 * @param {Object} [renderContext={}] - Precomputed render variables from prep stage
 *   - driverCards, componentRows, readinessPctValue, outputPctValue, etc.
 *   - Contains 30+ derived display values to avoid recomputation
 * 
 * @return {void} Sends email and logs delivery
 * 
 * Note: Renders directly to email. Context destructuring handles 30+ variables;
 * all have safe defaults to prevent rendering errors if data is missing.
 */
function distributeReport(report, scores, weekly, trend, goals, warnings = [], dsStats = null, capacity = null, decision = null, gapsNote = '', degradeBanner = '', weekMeta = null, composites = null, emailLogMeta = null, renderContext = {}) {
  // Convenience aliases for function parameters
  const gapsNoteMsg = gapsNote;
  const degradeBannerMsg = degradeBanner;
  const ds = dsStats || {};
  
  // Destructure renderContext for precomputed render variables
  const {
    driverCards = [],
    componentRows = [],
    readinessPctValue = null,
    outputPctValue = null,
    readinessTrendDisplay = '—',
    readinessSubtitle = 'Readiness data missing — log recovery inputs.',
    outputTrendDisplay = '—',
    outputSubtitle = 'Output data missing — keep execution logs.',
    planNarrativeLine = 'Maintain current workload and protect bedtime/wake windows.',
    planIcon = '↔',
    coachCallText = '',
    coachNotes = [],
    leverDisplay = '',
    coachNotesList = [],
    coachBullets = [],
    coachReadSafe = null,
    gatingSummary = '',
    gatingSleep = false,
    degradeReason = '',
    planDisplay = 'HOLD',
    gatingAcwr = false,
    insufficientGlobal = false,
    latestRollup = null,
    driverMissingNotes = [],
    sleepConsistencyLabel = 'Data Gaps',
    sleepConsistencySd = null,
    acwrValue = null,
    strengthAcwr = {},
    rhrDeltaText = '—',
    sleepConsistency = {}
  } = renderContext;
  
  const headingLabel = weekMeta?.label || `Week of ${formatDateIso_(new Date())}`;
  const totalScore = report?.metadata?.totalBucketScore != null ? report.metadata.totalBucketScore : null;
  const totalScoreDisplay = totalScore != null ? `${totalScore}` : (scores.overall != null ? `${Math.round(scores.overall)}` : '—');
  const totalGrade = report?.metadata?.totalGrade || (totalScore != null ? gradeFromScore_(totalScore).grade : '—');
  const totalBandKey = report?.metadata?.totalBand || (totalScore != null ? gradeFromScore_(totalScore).band : 'neutral');
  const totalBandClass = bandToStatusClass_(totalBandKey);
  const totalBandLabel = bandToLabel_(totalBandKey);
  const heading = `${headingLabel} — (${totalScoreDisplay}/100) Health Score`;

  // These variables now come from renderContext, so compute only derived values
  const sleepConsistencyScore = (typeof sleepConsistency.score === 'number') ? Math.max(0, Math.min(100, Math.round(sleepConsistency.score))) : null;
  const sleepConsistencyGaps = sleepConsistency.gaps != null ? sleepConsistency.gaps : null;
  const sleepStatusClass = getStatusClass_(sleepConsistencyLabel);
  const sleepConsistencyTextParts = [];
  if (sleepConsistencyLabel) sleepConsistencyTextParts.push(sleepConsistencyLabel);
  if (sleepConsistencySd != null) sleepConsistencyTextParts.push(`SD ${fmtDurationMinutes_(sleepConsistencySd)}`);
  if (sleepConsistencyGaps != null) sleepConsistencyTextParts.push(`${sleepConsistencyGaps} gaps`);
  const sleepConsistencyLine = sleepConsistencyTextParts.join(' · ') || 'Data Gaps';

  const acwrDisplay = acwrValue != null ? `${acwrValue.toFixed(2)}${strengthAcwr.label ? ` (${strengthAcwr.label})` : ''}` : (strengthAcwr.label || 'Data Gaps');
  const acwrLoadPct = parseSignedNumber_(ds?.load?.pctTrendStr);

  const rhrDeltaValue = parseSignedNumber_(rhrDeltaText);
  const loadTrendValue = trend.trainingLoad;
  const loadGoalValue = goals.weeklyTrainingLoad || null;
  const stepsTrendValue = trend.steps;

  const floorTarget = Math.max(CONFIG.Steps.purpleMinDays, goals.stepsFloorDays || CONFIG.Steps.fallbackFloorDays);
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
  ensureBucketGrade_(sleepBucketScore);
  ensureBucketGrade_(loadBucketScore);
  ensureBucketGrade_(activityBucketScore);
  ensureBucketGrade_(workBucketScore);

  const totalBucketScore = report?.metadata?.totalBucketScore != null
    ? report.metadata.totalBucketScore
    : computeTotalScore_({ sleep: sleepBucketScore, load: loadBucketScore, activity: activityBucketScore, work: workBucketScore });

  const sleepAcuteDiff = (weekly.sleep != null && trend.sleep != null) ? weekly.sleep - trend.sleep : null;
  const activityAcuteDiff = parseSignedNumber_(ds?.steps?.pctTrendStr);
  const workAcuteDiff = parseSignedNumber_(ds?.work?.pctTrendStr);
  const loadAcuteDiff = acwrLoadPct != null && isFinite(acwrLoadPct) ? acwrLoadPct : null;

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

  const sanitizeCard = card => ({
    key: card.key,
    className: card.className,
    title: escapeHtml_(card.title),
    metrics: (card.metrics || []).map(m => ({ label: escapeHtml_(m.label), value: escapeHtml_(m.value) })),
    insight: sanitizeTextForHtml_(card.insight || '', 140),
    grade: escapeHtml_(card.grade || '—'),
    score: card.score ? escapeHtml_(card.score) : '',
    bandClass: card.bandClass || '',
    bandLabel: card.bandLabel ? escapeHtml_(card.bandLabel) : '',
    severity: sanitizeTextForHtml_(card.severity || '', 140)
  });
  const cleanedCards = driverCards.map(sanitizeCard).filter(card => card.metrics.length || card.insight);

  const cleanedRows = componentRows.map(row => {
    const metric = escapeHtml_(row.metric);
    const currentText = escapeHtml_(row.current || '—');
    let current = currentText;
    if (row.badge) {
      const badgeClass = `badge ${row.badge.className || 'status-neutral'}`;
      const badgeLabel = escapeHtml_(row.badge.label || 'Status');
      current = `${currentText} <span class="${badgeClass}">${badgeLabel}</span>`;
    }
    return {
      metric,
      current,
      average: escapeHtml_(row.average || '—'),
      acute: escapeHtml_(row.acute || '—'),
      target: escapeHtml_(row.target || '—'),
      fourWeekGoal: escapeHtml_(row.fourWeekGoal || '—')
    };
  });

  const appendixLines = [
    `Sleep minutes: ${weekly.sleep != null ? fmtHMin(weekly.sleep) : '—'} (4-wk ${trend.sleep != null ? fmtHMin(trend.sleep) : '—'})${goals.sleepMinutes ? ` — Goal ${fmtHMin(goals.sleepMinutes)}` : ''}`,
    `Sleep SD: ${sleepConsistencySd != null ? fmtDurationMinutes_(sleepConsistencySd) : '—'} (${sleepConsistencyLabel}) — Goal ≤30m`,
    `Resting HR: ${weekly.rhr != null ? fmtBpm(weekly.rhr) : '—'} (4-wk ${trend.rhr != null ? fmtBpm(trend.rhr) : '—'})${goals.restingHeartRate ? ` — Baseline ${fmtBpm(goals.restingHeartRate)}` : ''}`,
    `ACWR: ${acwrValue != null ? acwrValue.toFixed(2) : '—'} (${strengthAcwr.label || 'Data Gaps'}) — Target 0.8–1.3`,
    `Steps: ${weekly.steps != null ? fmtInt(weekly.steps) : '—'} (4-wk ${trend.steps != null ? fmtInt(trend.steps) : '—'})${goals.steps ? ` — Goal ${fmtInt(goals.steps)}` : ''}`,
    `Work hours: ${weekly.workHours != null ? Math.round(weekly.workHours) : '—'}h (4-wk ${trend.workHours != null ? Math.round(trend.workHours) : '—'}h)${goals.weeklyWorkHours ? ` — Goal ${Math.round(goals.weeklyWorkHours)}h` : ''}`,
    `Data completeness — Activity: ${ds?.missing?.activity || 0} missing; Sleep: ${ds?.missing?.sleep || 0}; RHR: ${ds?.missing?.rhr || 0}`,
    `Sleep consistency source: ${sleepConsistency.source || 'unknown'}`
  ];
  if (driverMissingNotes.length) appendixLines.push(...driverMissingNotes);
  if (degradeReason && !/coach_call_missing/i.test(degradeReason)) appendixLines.push(`AI fallback: ${degradeReason}`);
  if (gatingAcwr && planDisplay === 'RECOVER') appendixLines.push('Plan adjusted due to ACWR gating (>1.5).');
  const appendixPre = escapeHtml_(appendixLines.map(line => `• ${line}`).join('\n'));

  const gapsHtml = gapsNoteMsg ? `<div class="banner banner-neutral">${escapeHtml_(gapsNoteMsg)}</div>` : '';
  const degradeHtml = degradeBannerMsg ? `<div class="banner banner-warning">${escapeHtml_(degradeBannerMsg)}</div>` : '';

  const css = EMAIL_REPORT_CSS;

  const tierOneHtml = `
    <header class="t1">
      <div class="t1-row">
        <div class="t1-main">
          <div class="t1-week">${escapeHtml_(headingLabel)}</div>
          <div class="t1-score">
            <span class="t1-score-grade">${escapeHtml_(totalGrade)}</span>
            ${totalScoreDisplay !== '—' ? `<span class="t1-score-meta">${escapeHtml_(totalScoreDisplay)}/100</span>` : ''}
            ${totalBandLabel ? `<span class="badge ${totalBandClass}">${escapeHtml_(totalBandLabel)}</span>` : ''}
          </div>
          <div class="t1-plan">Plan: ${escapeHtml_(planDisplay)}</div>
          <div class="plan-copy">${escapeHtml_(planNarrativeLine)}</div>
        </div>
        <div class="t1-tiles">
          <div class="tile">
            <span class="tile-label">Readiness</span>
            <span class="tile-value">${readinessPctValue != null ? `${readinessPctValue}%` : '—'}</span>
            <span class="tile-trend">${escapeHtml_(readinessTrendDisplay)}</span>
            <span class="tile-subtitle">${escapeHtml_(readinessSubtitle)}</span>
          </div>
          <div class="tile">
            <span class="tile-label">Output</span>
            <span class="tile-value">${outputPctValue != null ? `${outputPctValue}%` : '—'}</span>
            <span class="tile-trend">${escapeHtml_(outputTrendDisplay)}</span>
            <span class="tile-subtitle">${escapeHtml_(outputSubtitle)}</span>
          </div>
        </div>
      </div>
    </header>`;

  const tierTwoHtml = cleanedCards.length ? `
    <section class="t2">
      ${cleanedCards.map(card => `
        <article class="${card.className}">
          <h2>${card.title}</h2>
          ${card.grade ? `<div class="card-score"><span class="card-grade">${card.grade}</span>${card.score ? `<span class="card-score-meta">${card.score}</span>` : ''}${card.bandLabel ? ` <span class="badge ${card.bandClass}">${card.bandLabel}</span>` : ''}</div>` : ''}
          ${card.severity ? `<p class="card-severity">${card.severity}</p>` : ''}
          <ul>
            ${card.metrics.map(m => `<li><span>${m.label}</span><span>${m.value}</span></li>`).join('')}
          </ul>
          ${card.insight ? `<p class="card-insight">${card.insight}</p>` : ''}
        </article>
      `).join('')}
    </section>` : '';

  const coachReadHtml = coachReadSafe ? renderCoachReadSection_(coachReadSafe) : '';

  const tierThreeHtml = `
    <section class="t3">
      <table class="t3-table">
        <thead><tr><th>Metric</th><th>This Week</th><th>4-wk Avg</th><th>This Week vs 4-wk</th><th>Goal</th><th>4-wk vs Goal</th></tr></thead>
        <tbody>
          ${cleanedRows.map(row => `<tr><td>${row.metric}</td><td>${row.current}</td><td>${row.average}</td><td>${row.acute}</td><td>${row.target}</td><td>${row.fourWeekGoal}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`;

  const defaultCoachLine = planNarrativeLine || gatingSummary || 'No additional coach notes this week.';
  const coachNote = coachCallText || escapeHtml_(defaultCoachLine);
  const tierFourHtml = `
    <section class="t4 coach">
      <div class="coach-plan">
        <span class="coach-plan-icon">${planIcon}</span>
        <div>
          <h2>Plan: ${planDisplay}</h2>
          <p class="coach-note">${coachNote}</p>
        </div>
      </div>
      <div class="coach-note">${leverDisplay}</div>
      ${coachBullets.length ? `<ul class="coach-bullets">${coachBullets.map(item => `<li><span class="coach-tag">${item.tag}</span><span>${item.text}</span></li>`).join('')}</ul>` : ''}
      ${coachNotesList.length ? `<p class="coach-note">${coachNotesList.join(' ')}</p>` : ''}
    </section>`;

  const methodologyHtml = `
    <section class="t-method">
      <h2>How we calculate this</h2>
      <ul class="method-list">
        <li><strong>Readiness</strong> A recency-weighted 4-week composite of recovery inputs: Sleep vs goal (40%), Resting HR trend (30%, lower is better), Sleep variability SD (20%, lower is better), ACWR balance (10%, closer to 1.0 is better). Weekly input scores are blended with weights 40/30/20/10 (most recent week carries more weight). Scaled to 0–100%.</li>
        <li><strong>Output</strong> A recency-weighted 4-week composite of execution outputs: Gym load vs goal (40%), Steps vs goal (30%), Work hours vs goal (30%). Weekly output scores are blended with weights 50/25/15/10 (this week counts most). Scaled to 0–100%.</li>
        <li><strong>Plan</strong> Balance = Readiness − Output → Push (≥ +8), Hold (−7 to +7), Recover (≤ −8). (Arrows show week-over-week change; all values capped to 0–100% for readability.)</li>
      </ul>
    </section>`;

  const tierFiveHtml = `
    <section class="t5 appendix">
      <h2>Appendix — Raw Metrics</h2>
      <pre>${appendixPre}</pre>
    </section>`;

  const insightsHtml = '';

  const finalHtml = `
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>${css}</style>
      </head>
      <body>
        <div class="container">
          ${gapsHtml}
          ${degradeHtml}
          ${tierOneHtml}
          ${tierTwoHtml}
          ${coachReadHtml}
          <div class="page-break-before">
            ${tierFourHtml}
            ${methodologyHtml}
            ${tierFiveHtml}
          </div>
          ${insightsHtml}
        </div>
      </body>
    </html>
  `;

  const blob = Utilities.newBlob(finalHtml, 'text/html', 'Weekly_Report.html');
  const pdf = blob.getAs('application/pdf');
  const recipient = CONFIG.REPORT_RECIPIENT || 'your-email@example.com'; // Update with your email
  const emailPlanText = planNarrativeLine && planNarrativeLine.trim()
    ? planNarrativeLine.trim()
    : 'Your weekly performance report is attached.';
  const emailHtmlBody = `<p>${sanitizeTextForHtml_(emailPlanText, 600)}</p>`;
  const emailOptions = {
    attachments: [pdf.setName(`${heading}.pdf`)],
    htmlBody: emailHtmlBody
  };
  const attachmentCount = emailOptions.attachments ? emailOptions.attachments.length : 0;
  logWeeklyJob_('email:render_ready', {
    heading,
    attachments: attachmentCount,
    degradeBanner: Boolean(degradeBanner)
  });
  const emailLogPayload = {
    to: recipient,
    subject: heading,
    method: 'GmailApp',
    status: '',
    error: '',
    htmlUrl: emailLogMeta?.htmlUrl || '',
    pdfUrl: emailLogMeta?.pdfUrl || '',
    jsonUrl: emailLogMeta?.jsonUrl || '',
    aiParseOk: emailLogMeta?.aiParseOk,
    usedFallback: emailLogMeta?.usedFallback,
    schemaDiag: emailLogMeta?.schemaDiag || '',
    aiParseError: emailLogMeta?.aiParseError || ''
  };
  try {
    logWeeklyJob_('email:send_attempt', { heading, to: recipient });
    GmailApp.sendEmail(recipient, heading, emailPlanText, emailOptions);
    logWeeklyJob_('email:send_success', { heading });
    logEmailLogEntry_({
      ...emailLogPayload,
      status: 'sent'
    });
  } catch (error) {
    logWeeklyJob_('email:send_error', { heading, message: error?.message || 'unknown' });
    logEmailLogEntry_({
      ...emailLogPayload,
      status: 'failed',
      error: error?.message || 'unknown'
    });
    throw error;
  }
}
