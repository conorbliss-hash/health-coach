/**
 * Debug script to check WeeklyRollups data
 * Run this manually in Apps Script editor
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
