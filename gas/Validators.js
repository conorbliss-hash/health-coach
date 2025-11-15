// ==== Validators.gs ====
// Schema validation, text sanitization, normalization, security

// --- HTML escaping & sanitization ---
function escapeHtml_(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeTextForHtml_(text, maxChars) {
  if (!text) return '';
  let result = String(text).trim();
  if (maxChars && result.length > maxChars) {
    result = result.substring(0, maxChars).trim() + '…';
  }
  return escapeHtml_(result);
}

function sanitizeArrayForHtml_(arr, maxChars) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => sanitizeTextForHtml_(item, maxChars))
    .filter(item => item.length > 0);
}

function sanitizeCoachRead_(coachRead) {
  if (!coachRead || typeof coachRead !== 'object') return null;
  const normalizeList = key => {
    const list = Array.isArray(coachRead[key]) ? coachRead[key] : [];
    return list
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(item => item.length > 0 && !COACH_READ_BANNED_REGEX.test(item));
  };
  return {
    whereYoureAt: normalizeList('whereYoureAt'),
    nextOrders: normalizeList('nextOrders'),
    tradeOffs: normalizeList('tradeOffs'),
    gutChecks: normalizeList('gutChecks')
  };
}

function sanitizeReportForHtml_(report) {
  if (!report || typeof report !== 'object') return { sections: {} };
  const sections = report.sections || {};
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    return {
      title: sanitizeTextForHtml_(obj.title, SECTION_TITLE_LIMIT),
      bullets: sanitizeArrayForHtml_(obj.bullets || [], BULLET_CHAR_LIMIT),
      notes: sanitizeArrayForHtml_(obj.notes || [], BULLET_CHAR_LIMIT),
      severity: sanitizeTextForHtml_(obj.severity, 100)
    };
  };
  return {
    metadata: report.metadata || {},
    sections: {
      activity: sanitize(sections.activity),
      recovery: sanitize(sections.recovery),
      readiness: sanitize(sections.readiness)
    },
    insights: sanitizeArrayForHtml_(report.insights || [], BULLET_CHAR_LIMIT),
    coachCall: sanitizeTextForHtml_(report.coachCall || '', COACH_CALL_CHAR_LIMIT),
    recommendations: sanitizeArrayForHtml_(report.recommendations || [], RECOMMENDATION_CHAR_LIMIT),
    decision: report.decision || {},
    warnings: sanitizeArrayForHtml_(report.warnings || [], BULLET_CHAR_LIMIT),
    prose: sanitizeTextForHtml_(report.prose || '', 2000)
  };
}

// --- Text normalization ---
function normalizeString_(value, maxChars) {
  if (value == null) return '';
  let result = String(value).trim();
  if (maxChars && result.length > maxChars) {
    result = result.substring(0, maxChars).trim();
  }
  return result;
}

function normalizeStringArray_(arr, maxItems, maxChars) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => normalizeString_(item, maxChars))
    .filter(item => item.length > 0)
    .slice(0, maxItems);
}

function normalizeObservationText_(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\.\,\-]/g, '');
}

function ensureSentence_(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
    return trimmed;
  }
  return `${trimmed}.`;
}

// --- Number parsing ---
function parseSignedNumber_(text) {
  if (text == null) return null;
  const str = String(text).trim();
  if (!str) return null;
  const match = str.match(/([+-]?)(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const num = parseFloat(match[2]);
  return isFinite(num) ? sign * num : null;
}

function countWords_(text) {
  if (!text) return 0;
  const words = String(text).trim().split(/\s+/);
  return words.filter(w => w.length > 0).length;
}

// --- Severity & status mapping ---
function loadSeverityKey_(label) {
  if (!label) return 'unknown';
  const map = {
    'Under-stimulus': 'under',
    'In band': 'inBand',
    'Overreach': 'overreach',
    'High risk': 'highRisk',
    'Unknown': 'unknown'
  };
  return map[label] || 'unknown';
}

function getStatusClass_(label) {
  if (!label) return 'status-neutral';
  const lower = String(label).toLowerCase();
  if (lower.includes('elite') || lower.includes('stable') || lower.includes('good')) return 'status-success';
  if (lower.includes('warning') || lower.includes('drifting')) return 'status-warning';
  if (lower.includes('danger') || lower.includes('irregular') || lower.includes('chaotic')) return 'status-danger';
  return 'status-neutral';
}

// --- Data schema validation ---
function validateDataSchema_() {
  const ss = SpreadsheetApp.getActive();
  const errors = [];
  Object.keys(DATA_SCHEMA_REQUIREMENTS).forEach(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      errors.push(`${sheetName}: missing tab`);
      return;
    }
    const range = sh.getDataRange();
    if (!range) {
      errors.push(`${sheetName}: no data range`);
      return;
    }
    const values = range.getValues();
    if (!values.length) {
      errors.push(`${sheetName}: empty sheet`);
      return;
    }
    const headers = values[0].map(h => String(h || '').trim().toLowerCase());
    const headerSet = new Set(headers);
    DATA_SCHEMA_REQUIREMENTS[sheetName].forEach(requirement => {
      const candidates = Array.isArray(requirement) ? requirement : [requirement];
      const satisfied = candidates.some(name => headerSet.has(String(name || '').toLowerCase()));
      if (!satisfied) {
        const label = candidates[0];
        errors.push(`${sheetName}: missing column (want: ${label})`);
      }
    });
  });
  return { ok: errors.length === 0, errors };
}

// --- Report schema validation ---
function validateReportSchema_(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { ok: false, errors: ['root_not_object'] };
  }

  const metadata = obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {};
  const version = normalizeString_(metadata.version || obj.version || '', 20);
  const normalized = {
    metadata: {
      version: version || REPORT_SCHEMA_VERSION,
      model: normalizeString_(metadata.model || '', 40)
    }
  };

  // Insights
  const insights = normalizeStringArray_(obj.insights, 3, BULLET_CHAR_LIMIT);
  if (insights.length !== 3) {
    errors.push('insights_length');
  }
  normalized.insights = insights;

  // Sections
  const sections = {};
  if (!obj.sections || typeof obj.sections !== 'object') {
    errors.push('sections_missing');
  }
  REPORT_SECTION_KEYS.forEach(key => {
    const section = obj.sections && typeof obj.sections[key] === 'object' ? obj.sections[key] : {};
    const title = normalizeString_(section.title, SECTION_TITLE_LIMIT);
    if (!title) errors.push(`${key}_title_missing`);
    const bullets = normalizeStringArray_(section.bullets, 4, BULLET_CHAR_LIMIT);
    if (!bullets.length) errors.push(`${key}_bullets_missing`);
    const notes = normalizeStringArray_(section.notes || [], 2, BULLET_CHAR_LIMIT);
    sections[key] = { title, bullets, notes };
  });
  normalized.sections = sections;

  // Recommendations
  const recommendations = normalizeStringArray_(obj.recommendations, 5, RECOMMENDATION_CHAR_LIMIT);
  if (recommendations.length < 4) {
    errors.push('recommendations_insufficient');
  }
  const recsOverLimit = recommendations.some(rec => countWords_(rec) > RECOMMENDATION_WORD_LIMIT);
  if (recsOverLimit) errors.push('recommendation_word_limit');
  normalized.recommendations = recommendations;

  // Decision
  const decision = obj.decision && typeof obj.decision === 'object' ? obj.decision : {};
  const plan = normalizeString_(decision.plan, 40);
  const lever = normalizeString_(decision.lever, BULLET_CHAR_LIMIT);
  if (!plan) errors.push('decision_plan_missing');
  if (!lever) errors.push('decision_lever_missing');
  normalized.decision = {
    plan,
    lever,
    notes: normalizeStringArray_(decision.notes || [], 3, BULLET_CHAR_LIMIT)
  };

  const coachCall = normalizeString_(obj.coachCall || '', COACH_CALL_CHAR_LIMIT);
  if (!coachCall) errors.push('coach_call_missing');
  normalized.coachCall = coachCall;

  normalized.warnings = normalizeStringArray_(obj.warnings || [], 4, BULLET_CHAR_LIMIT);
  normalized.prose = normalizeString_(obj.prose || '', 2000);

  const ok = errors.length === 0;
  return { ok, report: normalized, errors };
}

// --- Coach read validation ---
function normaliseCoachRead_(data) {
  if (!data || typeof data !== 'object') return null;
  const normalizeList = key => {
    const list = Array.isArray(data[key]) ? data[key] : [];
    return list
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  };
  return {
    whereYoureAt: normalizeList('whereYoureAt'),
    nextOrders: normalizeList('nextOrders'),
    tradeOffs: normalizeList('tradeOffs'),
    gutChecks: normalizeList('gutChecks')
  };
}

function validateCoachRead_(coachRead) {
  if (!coachRead) return false;
  const sections = ['whereYoureAt', 'nextOrders', 'tradeOffs', 'gutChecks'];
  return sections.every(section => {
    const lines = coachRead[section];
    if (!Array.isArray(lines) || !lines.length) return false;
    return lines.every(line => typeof line === 'string' && line.length && !COACH_READ_BANNED_REGEX.test(line));
  });
}
