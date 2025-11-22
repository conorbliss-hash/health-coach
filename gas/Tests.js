// ==== Tests.gs ====
// Consolidated test and debug functions for data verification
// These are NOT production code - use for debugging only

/**
 * Test missing data detection for the current week
 * Shows which sheets have incomplete data
 */
function testMissingDataDetection() {
  Logger.clear();
  Logger.log('=== TEST: Missing Data Detection ===\n');
  
  const weekData = getWeekData_(new Date());
  const derivedStats = computeDerivedStats(weekData.weekly, weekData.trend, weekData.goals, null, null);
  
  Logger.log('Activity missing: ' + derivedStats.missing.activity);
  Logger.log('Sleep missing: ' + derivedStats.missing.sleep);
  Logger.log('RHR missing: ' + derivedStats.missing.rhr);
  
  const [start, end] = getWeekBounds_();
  Logger.log('\nWeek bounds:');
  Logger.log('Start: ' + start.toString());
  Logger.log('End: ' + end.toString());
}

/**
 * Verify Activity sheet data counting
 * Lists last 6 rows and reports unique dates found
 */
function testActivityCounting() {
  Logger.clear();
  Logger.log('=== TEST: Activity Counting ===\n');
  
  const [start, end] = getWeekBounds_();
  const sh = SpreadsheetApp.getActive().getSheetByName('Activity');
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  const iDate = headers.findIndex(h => h.toLowerCase() === 'date');
  
  Logger.log(`Activity sheet has ${values.length} data rows`);
  Logger.log('\nLast 6 rows:');
  
  const seen = new Set();
  for (let i = Math.max(0, values.length - 6); i < values.length; i++) {
    const d = values[i][iDate];
    const dateStr = (typeof d === 'string')
      ? d.startsWith("'") ? d.substring(1) : d
      : Utilities.formatDate(d, 'Europe/Stockholm', 'yyyy-MM-dd');
    
    Logger.log(`Row ${i + 2}: ${dateStr}`);
    
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = dateStr.substring(0, 10).split('-');
      const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
      if (localDate >= start && localDate <= end) {
        seen.add(dateStr.substring(0, 10));
      }
    }
  }
  
  Logger.log(`\nUnique dates in week: ${seen.size}`);
  Logger.log(`Missing: ${7 - seen.size}`);
}

/**
 * Check all sheets for data completeness
 * Shows row counts and date ranges for Activity, Sleep, HeartRate
 */
function testAllSheets() {
  Logger.clear();
  Logger.log('=== TEST: All Sheets Data Check ===\n');
  
  const ss = SpreadsheetApp.getActive();
  const sheetNames = ['Activity', 'HeartRate', 'Sleep'];
  
  for (const sheetName of sheetNames) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      Logger.log(`${sheetName}: NOT FOUND`);
      continue;
    }
    
    const values = sh.getDataRange().getValues();
    const headers = values.shift().map(String);
    const iDate = headers.findIndex(h => h.toLowerCase() === 'date');
    
    if (iDate === -1) {
      Logger.log(`${sheetName}: DATE COLUMN NOT FOUND`);
      continue;
    }
    
    // Get first and last dates
    let firstDate = null, lastDate = null;
    for (let i = 0; i < Math.min(1, values.length); i++) {
      firstDate = values[i][iDate];
    }
    for (let i = Math.max(0, values.length - 1); i < values.length; i++) {
      lastDate = values[i][iDate];
    }
    
    Logger.log(`\n${sheetName}:`);
    Logger.log(`  Total rows: ${values.length}`);
    Logger.log(`  First date: ${firstDate}`);
    Logger.log(`  Last date: ${lastDate}`);
    Logger.log(`  Missing count: ${countMissingDaysInWeek_(sheetName)}`);
  }
}

/**
 * Deep inspection of raw cell values
 * Shows how JavaScript interprets date cells from each sheet
 */
function testRawCellValues() {
  Logger.clear();
  Logger.log('=== TEST: Raw Cell Value Inspection ===\n');
  
  const ss = SpreadsheetApp.getActive();
  const sheetNames = ['Activity', 'HeartRate', 'Sleep'];
  
  for (const sheetName of sheetNames) {
    Logger.log(`\n[${sheetName}] Last 3 rows:`);
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      Logger.log('  Sheet not found');
      continue;
    }
    
    const values = sh.getDataRange().getValues();
    const lastRows = values.slice(Math.max(0, values.length - 3));
    
    for (const row of lastRows) {
      const raw = row[0];
      Logger.log(`  Raw: "${raw}" (type: ${typeof raw})`);
      if (raw instanceof Date) {
        Logger.log(`    As Date: ${raw.toString()}`);
      }
    }
  }
}

/**
 * Test date parsing with apostrophe stripping
 * Verifies extractDateString_() helper works correctly
 */
function testDateParsing() {
  Logger.clear();
  Logger.log('=== TEST: Date String Extraction ===\n');
  
  const testCases = [
    "'2025-11-21",     // apostrophe-prefixed
    "2025-11-21",      // plain string
    new Date(2025, 10, 21), // Date object
    45599  // Excel serial number
  ];
  
  for (const testVal of testCases) {
    const result = extractDateString_(testVal);
    Logger.log(`Input: ${testVal} (type: ${typeof testVal})`);
    Logger.log(`  Output: "${result}"\n`);
  }
}

/**
 * Verify sheet data after running fit_to_sheets.py sync
 * Checks if latest data (Nov 21) made it to the sheet
 */
function testPostSyncVerification() {
  Logger.clear();
  Logger.log('=== TEST: Post-Sync Data Verification ===\n');
  
  const ss = SpreadsheetApp.getActive();
  const sheetNames = ['Activity', 'HeartRate', 'Sleep'];
  
  for (const sheetName of sheetNames) {
    const sh = ss.getSheetByName(sheetName);
    const values = sh.getDataRange().getValues();
    
    // Check last row
    const lastRow = values[values.length - 1];
    const lastDate = lastRow[0];
    
    Logger.log(`${sheetName}:`);
    Logger.log(`  Last row: "${lastDate}"`);
    
    // Check if Nov 21 is present
    let hasNov21 = false;
    for (const row of values) {
      const dateStr = typeof row[0] === 'string'
        ? (row[0].startsWith("'") ? row[0].substring(1) : row[0])
        : Utilities.formatDate(row[0], 'Europe/Stockholm', 'yyyy-MM-dd');
      if (dateStr.includes('2025-11-21')) {
        hasNov21 = true;
        break;
      }
    }
    
    Logger.log(`  Has Nov 21: ${hasNov21 ? 'YES ✓' : 'NO ✗'}`);
  }
}

/**
 * Debug script to check WeeklyRollups data
 * Run this manually in Apps Script editor to inspect rollup consistency
 */
function debugWeeklyRollups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName('WeeklyRollups');
  
  if (!ws) {
    Logger.log('WeeklyRollups sheet not found');
    return;
  }
  
  const data = ws.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  Logger.log(`=== WeeklyRollups Debug ===`);
  Logger.log(`Total rows: ${rows.length}`);
  Logger.log(`Headers: ${headers.join(', ')}`);
  
  // Find week_start and data_gaps columns
  const weekStartIdx = headers.indexOf('week_start');
  const weekEndIdx = headers.indexOf('week_end');
  const dataGapsIdx = headers.indexOf('data_gaps');
  const outputPctIdx = headers.indexOf('output_pct');
  const readinessPctIdx = headers.indexOf('readiness_pct');
  
  Logger.log(`\nColumn indices: week_start=${weekStartIdx}, week_end=${weekEndIdx}, data_gaps=${dataGapsIdx}`);
  
  // Show all rows with data_gaps=0
  Logger.log('\n=== Complete weeks (data_gaps=0) ===');
  rows.forEach((row, idx) => {
    const gaps = Number(row[dataGapsIdx]);
    if (gaps === 0) {
      const weekStart = row[weekStartIdx];
      const weekEnd = row[weekEndIdx];
      const outputPct = row[outputPctIdx];
      const readinessPct = row[readinessPctIdx];
      Logger.log(`Row ${idx + 2}: ${weekStart} to ${weekEnd} | output_pct=${outputPct} | readiness_pct=${readinessPct}`);
      
      // Show date parsing
      const dateObj = new Date(weekStart);
      Logger.log(`  Parsed as: ${dateObj} (timestamp: ${dateObj.getTime()})`);
    }
  });
  
  // Test the actual function
  Logger.log('\n=== Testing getLatestCompleteWeekFromRollups() ===');
  const result = getLatestCompleteWeekFromRollups();
  if (result) {
    Logger.log(`Returned week: ${result.week_start} to ${result.week_end}`);
    Logger.log(`Output: ${result.output_pct}%, Readiness: ${result.readiness_pct}%`);
  } else {
    Logger.log('Function returned null');
  }
}

/**
 * Detailed inspection of HeartRate data for specific date ranges
 * Used to debug date parsing and timezone issues in sheet data
 */
function inspectHeartRateData() {
  Logger.clear();
  Logger.log('=== DETAILED HeartRate Sheet Inspection ===');
  
  const prevWeekDate = new Date();
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  
  const WEEK_REFERENCE_OVERRIDE_BACKUP = WEEK_REFERENCE_OVERRIDE;
  WEEK_REFERENCE_OVERRIDE = prevWeekDate;
  const [start, end] = getWeekBounds_(prevWeekDate);
  WEEK_REFERENCE_OVERRIDE = WEEK_REFERENCE_OVERRIDE_BACKUP;
  
  Logger.log('Week: ' + Utilities.formatDate(start, 'UTC', 'yyyy-MM-dd') + ' to ' + Utilities.formatDate(end, 'UTC', 'yyyy-MM-dd'));
  Logger.log('Start timestamp: ' + start.getTime());
  Logger.log('End timestamp: ' + end.getTime());
  
  const ss = SpreadsheetApp.getActive();
  const hrSheet = ss.getSheetByName('HeartRate');
  const values = hrSheet.getDataRange().getValues();
  
  Logger.log('\n=== Column Headers ===');
  const headers = values[0];
  for (let i = 0; i < headers.length; i++) {
    Logger.log('[' + i + ']: ' + headers[i]);
  }
  
  const dateColIdx = headers.findIndex(h => String(h).toLowerCase() === 'date');
  Logger.log('\nDate column index: ' + dateColIdx);
  
  Logger.log('\n=== All HeartRate Rows ===');
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const dateVal = row[dateColIdx];
    const dateObj = new Date(dateVal);
    const isInWeek = dateObj >= start && dateObj <= end;
    
    Logger.log('Row ' + i + ': dateVal="' + dateVal + '" | parsed=' + dateObj + ' | inWeek=' + isInWeek + ' | rhr=' + row[1] + ' | max=' + row[2] + ' | avg=' + row[3]);
  }
  
  Logger.log('\n=== Checking for Nov 21 specifically ===');
  for (let i = 1; i < values.length; i++) {
    const dateVal = values[i][dateColIdx];
    const dateStr = String(dateVal);
    if (dateStr.includes('2025-11-21') || dateStr.includes('11/21')) {
      Logger.log('FOUND Nov 21: Row ' + i + ', dateVal="' + dateVal + '", rhr=' + values[i][1]);
    }
  }
}
