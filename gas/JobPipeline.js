// ==== JobPipeline.gs ====
// Job orchestration, logging, email notifications

// --- Structured logging for job execution ---
function logWeeklyJob_(stage, info = null) {
  let detail = '';
  if (info && typeof info === 'object') {
    try {
      detail = ` | data=${JSON.stringify(info)}`;
    } catch (err) {
      detail = ` | data_error=serialization_failed`;
    }
  } else if (info != null) {
    detail = ` | data=${info}`;
  }
  Logger.log(`[WeeklyReport] ${stage}${detail}`);
}

// --- Email notifications ---
function sendOpsEmail_(subject, body) {
  try {
    MailApp.sendEmail(OPS_EMAIL, subject, body);
  } catch (err) {
    Logger.log(`[Email Error] Could not send ops email: ${err?.message || 'unknown'}`);
  }
}

function sendSchemaFailureEmail_(errors, weekMeta) {
  const subject = `HealthReport SCHEMA FAILED ${weekMeta?.isoLabel || ''}`.trim();
  const body = `Weekly report generation failed at schema validation.\n\nWeek: ${weekMeta?.label || 'Unknown'}\nErrors:\n${errors.map(e => `  • ${e}`).join('\n')}\n\nAction: check the Activity, Sleep, and HeartRate tabs for missing columns.`;
  sendOpsEmail_(subject, body);
}

function sendJobFailureEmail_(weekMeta, stage, error) {
  const subject = `HealthReport FAILED ${weekMeta?.isoLabel || ''}`.trim();
  const body = `Weekly report generation failed.\n\nWeek: ${weekMeta?.label || 'Unknown'}\nStage: ${stage}\nMessage: ${error?.message || 'Unknown error'}\nStack: ${error?.stack || 'n/a'}\n\nNext step: review Apps Script logs and rerun once resolved.`;
  sendOpsEmail_(subject, body);
}

// --- Report logging to sheet ---
function logReportToSheet(reportContent, weekly = null, trend = null, scores = null, weekMeta = null) {
  const ss = SpreadsheetApp.getActive();
  const reportSheet = ss.getSheetByName('ReportLog') || ss.insertSheet('ReportLog');
  if (!reportSheet) {
    logWeeklyJob_('weekly_job:report_log_sheet_missing', {});
    return;
  }
  const lastCol = reportSheet.getLastColumn() || 1;
  const headers = reportSheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  if (!headers || !headers.length) {
    reportSheet.appendRow(['Week', 'Date', 'Score', 'Weekly Steps', '4W Trend Steps', 'Report Excerpt']);
  }
  const weekLabel = weekMeta?.label || new Date().toISOString().split('T')[0];
  const scoreValue = scores?.overall != null ? scores.overall : '—';
  const weeklySteps = weekly?.steps != null ? Math.round(weekly.steps) : '—';
  const trendSteps = trend?.steps != null ? Math.round(trend.steps) : '—';
  const excerpt = reportContent ? reportContent.substring(0, 200) : '(no content)';
  reportSheet.appendRow([weekLabel, new Date(), scoreValue, weeklySteps, trendSteps, excerpt]);
  logWeeklyJob_('weekly_job:log_sheet_row_appended', { week: weekLabel });
}

// --- Email log entry ---
function logEmailLogEntry_(entry = {}) {
  const ss = SpreadsheetApp.getActive();
  const emailLogSheet = ss.getSheetByName('EmailLog') || ss.insertSheet('EmailLog');
  if (!emailLogSheet) {
    logWeeklyJob_('weekly_job:email_log_sheet_missing', {});
    return;
  }
  const lastCol = emailLogSheet.getLastColumn() || 1;
  const headers = emailLogSheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  if (!headers || !headers.length) {
    emailLogSheet.appendRow(['Date', 'Week', 'Recipient', 'Subject', 'Status', 'AI Parse OK', 'Used Fallback', 'Schema Diag']);
  }
  const row = [
    new Date(),
    entry.week || '—',
    entry.recipient || OPS_EMAIL,
    entry.subject || '—',
    entry.status || 'sent',
    entry.aiParseOk ? 'yes' : 'no',
    entry.usedFallback ? 'yes' : 'no',
    entry.schemaDiag || 'ok'
  ];
  emailLogSheet.appendRow(row);
  logWeeklyJob_('weekly_job:email_log_entry_appended', { status: entry.status });
}

// --- Trigger setup ---
function setupWeeklyTrigger() {
  const ss = SpreadsheetApp.getActive();
  const projectName = ss.getName();
  const scriptId = ScriptApp.getScriptId();
  const triggers = ScriptApp.getProjectTriggers();
  const existingTrigger = triggers.find(t =>
    t.getHandlerFunction() === 'weeklyReportJob' &&
    t.getEventType() === ScriptApp.EventType.CLOCK
  );
  if (existingTrigger) {
    logWeeklyJob_('weekly_trigger:already_exists', {});
    return;
  }
  const trigger = ScriptApp.newTrigger('weeklyReportJob')
    .timeBased()
    .weeklyOn(ScriptApp.Day.FRIDAY)
    .atHour(19)
    .create();
  logWeeklyJob_('weekly_trigger:created', {
    day: 'Friday',
    hour: 19,
    triggerId: trigger.getUniqueId(),
    projectName
  });
}
