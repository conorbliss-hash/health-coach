# How to Read Weekly Scores from WeeklyRollups

## ✅ SOLUTION IMPLEMENTED: Option A

The WeeklyRollups sheet now contains **all weeks** (complete and incomplete), so your reporting system can always read the most recent complete week's scores.

## How It Works

### WeeklyRollups Sheet Structure
```
week_start | week_end | sleep_min_avg | rhr_avg | ... | data_gaps | readiness_pct | output_pct
2025-10-25 | 2025-10-31| 464.1        | 66.7    | ... | 0         | 88            | 96
2025-11-01 | 2025-11-07| 472.7        | 66.4    | ... | 0         | 90            | 83
2025-11-08 | 2025-11-14| 450.0        | 67.0    | ... | 6         | 75            | 60
```

### Key Fields
- **`data_gaps`**: Number of missing days (0-7)
  - `0` = Complete week with 7 days of data ✅
  - `1-6` = Partial week (in progress) ⚠️
  - `7` = No data for this week ❌

- **`readiness_pct`**: Recovery score (0-100)
- **`output_pct`**: Performance score (0-100)

## Reading Logic for Your Reporting System

### Pseudo-code:
```python
# Get all weeks from WeeklyRollups sheet, sorted by week_start descending
weeks = get_weekly_rollups_data().sort_by('week_start', descending=True)

# Find the most recent COMPLETE week (data_gaps == 0)
latest_complete_week = weeks.filter(data_gaps == 0).first()

# Use these scores in your report
readiness = latest_complete_week.readiness_pct
output = latest_complete_week.output_pct
week_label = f"Week of {latest_complete_week.week_start}"

# Optional: Show a note if it's not the current week
current_week_start = get_current_saturday()
if latest_complete_week.week_start < current_week_start:
    note = f"Based on complete week ending {latest_complete_week.week_end}"
```

### Google Sheets Formula Example:
If your reporting dashboard is in Google Sheets:

```
# Get readiness from most recent complete week
=QUERY(WeeklyRollups!A:N, 
  "SELECT M WHERE L = 0 ORDER BY A DESC LIMIT 1", 
  0)
  
# Get output from most recent complete week  
=QUERY(WeeklyRollups!A:N,
  "SELECT N WHERE L = 0 ORDER BY A DESC LIMIT 1",
  0)
  
# Get the week label
=QUERY(WeeklyRollups!A:N,
  "SELECT A WHERE L = 0 ORDER BY A DESC LIMIT 1",
  0)
```

Where:
- Column A = `week_start`
- Column L = `data_gaps`
- Column M = `readiness_pct`
- Column N = `output_pct`

## Example Scenarios

### Scenario 1: Saturday (Week Start)
**Date**: Saturday, Nov 8, 2025
**WeeklyRollups contains**:
- 2025-11-01 to 2025-11-07 (data_gaps=0) ✅ COMPLETE
- 2025-11-08 to 2025-11-14 (data_gaps=6) ⚠️ PARTIAL (1 day)

**Your report should show**:
```
WEEK OF 2025-11-08
(Based on complete week ending Nov 7)

READINESS: 90%
OUTPUT: 83%
```

### Scenario 2: Mid-Week Wednesday
**Date**: Wednesday, Nov 12, 2025
**WeeklyRollups contains**:
- 2025-11-01 to 2025-11-07 (data_gaps=0) ✅ COMPLETE
- 2025-11-08 to 2025-11-14 (data_gaps=2) ⚠️ PARTIAL (5 days)

**Your report should show**:
```
WEEK OF 2025-11-08
(Based on complete week ending Nov 7)

READINESS: 90%
OUTPUT: 83%
```

### Scenario 3: Friday (Week End)
**Date**: Friday, Nov 14, 2025
**WeeklyRollups contains**:
- 2025-11-01 to 2025-11-07 (data_gaps=0) ✅ COMPLETE
- 2025-11-08 to 2025-11-14 (data_gaps=0) ✅ COMPLETE

**Your report should show**:
```
WEEK OF 2025-11-08

READINESS: 87%
OUTPUT: 85%
```

## Benefits of This Approach

✅ **Always shows complete 7-day scores** (no misleading partial data)
✅ **Consistent throughout the week** (same scores from Sat-Fri)
✅ **Updates automatically** when new week completes
✅ **Simple to implement** (just filter by `data_gaps = 0`)
✅ **Source of truth** is the WeeklyRollups sheet

## Migration Notes

### What Changed:
- **Before**: WeeklyRollups only included weeks with `data_gaps = 0`
- **After**: WeeklyRollups includes ALL weeks, use `data_gaps` to filter

### Backward Compatibility:
✅ Old logic still works - just add `WHERE data_gaps = 0` to your queries

### New Capability:
- Can now see partial week progress if desired
- Can show "week-to-date" scores by reading the current week
- Can display data quality warnings based on `data_gaps` value

## Summary

**Always read from the most recent row in WeeklyRollups where `data_gaps = 0`**

This ensures your weekly report always displays complete, accurate 7-day scores, even on the first day of a new week.
