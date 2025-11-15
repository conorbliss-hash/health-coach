/**
 * Sleep timing utilities shared across reporting scripts.
 */

function parseTimeToMinutes_(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes() + (value.getSeconds ? value.getSeconds() : 0) / 60;
  }
  const str = String(value).trim();
  if (!str) return null;
  const parts = str.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = parts.length > 2 ? Number(parts[2]) : 0;
  if ([h, m, s].some(n => isNaN(n))) return null;
  return h * 60 + m + s / 60;
}

function collectSleepMidpoints_(data, idxStart, idxEnd) {
  const mids = [];
  let missing = 0;
  if (idxStart === -1 || idxEnd === -1) {
    return { mids, missing: data.length };
  }
  for (const row of data) {
    const startMin = parseTimeToMinutes_(row[idxStart]);
    let endMin = parseTimeToMinutes_(row[idxEnd]);
    if (startMin == null || endMin == null) {
      missing++;
      continue;
    }
    if (endMin <= startMin) endMin += 24 * 60;
    const mid = (startMin + endMin) / 2;
    mids.push(mid % (24 * 60));
  }
  return { mids, missing };
}

function sleepBandLabelFromSd_(sdMinutes) {
  if (sdMinutes == null || !isFinite(sdMinutes)) return 'Data gap';
  const sd = Math.max(0, Math.round(sdMinutes));
  if (sd <= 15) return 'Elite';
  if (sd <= 30) return 'Stable';
  if (sd <= 45) return 'Drifting';
  if (sd <= 60) return 'Irregular';
  return 'Chaotic';
}

function computeSleepConsistencyWeekly_() {
  const [start, end] = getWeekBounds_();
  const { headers, data } = getSleepRowsByDateRange_(start, end);
  if (!data.length) return { score: null, label: 'Data gap', source: 'missing', sdMinutes: null, gaps: 7 };

  const idxConsistency = sleepHeaderIndex_(headers, 'Sleep_consistency');
  const idxStart = sleepHeaderIndex_(headers, 'start_time');
  const idxEnd = sleepHeaderIndex_(headers, 'end_time');
  const idxDate = sleepHeaderIndex_(headers, 'date');

  if (idxConsistency !== -1) {
    const vals = data
      .map(r => {
        const raw = r[idxConsistency];
        if (raw === '' || raw == null) return NaN;
        const num = Number(raw);
        return isNaN(num) ? NaN : num;
      })
      .filter(n => !isNaN(n));
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const score = Math.max(0, Math.min(100, Math.round(avg)));
      const gaps = data.length - vals.length;
      const timing = collectSleepMidpoints_(data, idxStart, idxEnd);
      const sdMinutes = timing.mids.length >= 2 ? Math.round(stdev_(timing.mids)) : null;
      const label = sdMinutes != null ? sleepBandLabelFromSd_(sdMinutes) : labelSleepConsistency_(score);
      return { score, label, source: 'recorded', sdMinutes, gaps };
    }
  }

  if (idxStart === -1 || idxEnd === -1 || idxDate === -1) {
    return { score: null, label: 'Data gap', source: 'missing', sdMinutes: null, gaps: data.length };
  }

  const timing = collectSleepMidpoints_(data, idxStart, idxEnd);
  const mids = timing.mids;

  if (mids.length < 2) {
    const fallbackGaps = Math.max(data.length - mids.length, timing.missing);
    return { score: null, label: 'Data gap', source: 'proxy', sdMinutes: null, gaps: fallbackGaps };
  }

  const sd = stdev_(mids);
  return { score: null, label: sleepBandLabelFromSd_(sd), source: 'proxy', sdMinutes: Math.round(sd), gaps: timing.missing };
}

function labelSleepConsistency_(score) {
  if (score == null || isNaN(score)) return 'Data gap';
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Stable';
  if (score >= 60) return 'Drifting';
  if (score >= 45) return 'Irregular';
  return 'Chaotic';
}

function sleepHeaderIndex_(headers, name) {
  return headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
}

function getSleepRowsByDateRange_(start, end) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Sleep');
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
