// ==== Constants.gs ====
// Schema definitions, configuration thresholds, coaching library

// --- Report schema ---
const REPORT_SCHEMA_VERSION = '1.0';
const REPORT_SECTION_KEYS = ['activity', 'recovery', 'readiness'];
const SECTION_TITLE_LIMIT = 140;
const BULLET_CHAR_LIMIT = 260;
const RECOMMENDATION_WORD_LIMIT = 14;
const RECOMMENDATION_CHAR_LIMIT = 90;
const COACH_CALL_CHAR_LIMIT = 320;

// --- Default report content ---
const DEFAULT_ACTIVITY_TITLE = 'Output shifted from normal — act accordingly this week.';
const DEFAULT_RECOVERY_TITLE = 'Sleep roughly on target; timing consistency needs attention.';
const DEFAULT_READINESS_TITLE = 'Body signals mixed; stay conservative and reassess mid-week.';
const SHOW_HUMAN_APPENDIX = true;

// --- Fallback recommendations (when AI fails) ---
const FALLBACK_RECOMMENDATIONS = [
  'Hold core training blocks with focused execution.',
  'Protect sleep routine with fixed lights-out.',
  'Monitor resting heart rate before harder efforts.',
  'Log sessions and recovery notes nightly.'
];

// --- Operations & email ---
const OPS_EMAIL = 'conor.bliss.henaghan@gmail.com';

// --- Data schema requirements (validation) ---
const DATA_SCHEMA_REQUIREMENTS = {
  Activity: [
    ['date'],
    ['steps'],
    ['volume_kg', 'volume', 'training_load_kg'],
    ['working hours', 'work_hours', 'work hours']
  ],
  Sleep: [
    ['date'],
    ['sleep_total_min', 'sleep_total_minutes', 'sleep']
  ],
  HeartRate: [
    ['date'],
    ['value', 'resting_heart_rate', 'resting heart rate', 'restinghr', 'resting hr', 'restingheartrate', 'restingheartratebpm', 'rhr', 'hr_avg', 'hr average', 'hrminavg']
  ]
};

// --- Configuration thresholds ---
const CONFIG = {
  ACWR: {
    amber: 1.15,
    red: 1.30,
    highLoad: 1.25,
    purpleMax: 1.10,
    alertHigh: 1.20,
    alertLow: 0.80
  },
  Sleep: {
    deficitAmber: 45,
    deficitRed: 90,
    purpleMaxDeficit: 60,
    pushDeficitMax: 30,
    consistencyAmber: 70,
    consistencyRed: 60,
    severeConsistency: 55
  },
  RHR: {
    amberDelta: 3,
    redDelta: 5
  },
  Work: {
    plateauHours: 55,
    extremeHours: 60,
    purpleGoalRatio: 0.8
  },
  Load: {
    amberRatio: 1.10
  },
  Steps: {
    purpleMinDays: 3,
    fallbackFloor: 6000,
    fallbackFloorDays: 5
  },
  Trend: {
    workHigh: 1.08,
    strengthHigh: 1.10,
    fitnessLow: 0.90,
    sleepLow: 0.92,
    readinessHighDelta: 2
  }
};

// --- Coaching library ---
const COACH = {
  sleep: {
    fix: 'Fix lights-out 22:30. Recheck SRI in 7 days.',
    lock: 'Lock bedtime window 22:30-06:30. Recheck SRI in 7 days.',
    hold: 'Hold current routine. Recheck SRI in 7 days.'
  },
  load: {
    deload: 'Deload now: -30% volume for 2 sessions. Resume base Monday.',
    under: 'Add +8% volume; keep RPE <=8. Review Sunday.',
    hold: 'Keep volume steady. Next check in 48h.',
    rebuild: 'Schedule two heavy sets per lift. Review load Sunday.'
  },
  activity: {
    addWalk: 'Walk 30 min after dinner today. Hit 6k+ on 5/7 days.',
    boost: 'Add 15 min lunch walk. Review totals Sunday.',
    ease: 'Keep extras easy Z1. Audit legs Friday.'
  },
  readiness: {
    rest: 'Complete rest day, mobility work, sleep 8h+.',
    assess: 'Light movement only (easy walk). Reassess tomorrow AM.',
    monitor: 'Light session only; monitor how you feel mid-week.'
  }
};

// --- Coach read validation ---
const COACH_READ_BANNED_REGEX = /\b(ACWR|HRV|SRI|SD)\b|[%\u2264\u2265\u2206\u0394]/i;
