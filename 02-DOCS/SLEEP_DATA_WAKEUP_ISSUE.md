# Mi Fitness → Google Health → Google Sheets: Wake-Up Detection Issue

## Problem

Wake-ups detected by Mi Fitness are being incorrectly registered as the **end of a sleep cycle** in your data pipeline, creating false positives or duplicate entries.

---

## Root Cause Analysis

### How the Current Pipeline Works

1. **Mi Fitness Band** → Detects sleep stages locally
2. **Google Health App** → Syncs sleep data from Mi Fitness
3. **Google Fit API** → `com.google.sleep.segment` data type (sleep stage breakdowns)
4. **fit_to_sheets.py** → Processes segments into sleep sessions

### The Issue

In `fit_to_sheets.py` (lines 900-920), wake-ups are detected by checking if a segment's `stage` value is in `SLEEP_STAGES_AWAKE`:

```python
SLEEP_STAGES_AWAKE = [SLEEP_STAGE_AWAKE, SLEEP_STAGE_OUT_OF_BED]  # Values: 1, 3

for segment in night_segments:
    stage = segment["value"][0]["intVal"]
    duration_mins = (end_nanos - start_nanos) / (1e9 * 60)
    if stage in SLEEP_STAGES_AWAKE:
        time_awake_min += duration_mins
        if was_asleep:
            wake_up_count += 1  # ← Counts each AWAKE segment as a wake-up
        was_asleep = False
    elif stage in SLEEP_STAGES_ASLEEP:
        sleep_minutes += duration_mins
        was_asleep = True
```

**Problem**: Some Mi Fitness devices (especially older ones) incorrectly classify brief transitions between sleep stages as "AWAKE" periods, or they create spurious "out of bed" events at the end of sleep cycles that aren't real wake-ups.

---

## Potential Solutions

### Solution 1: Filter Out Micro-Wake-Ups (Recommended - Code Change)

**Idea:** Ignore wake-ups shorter than a threshold (e.g., 1-2 minutes), as these are likely false positives.

**Edit `fit_to_sheets.py` around line 920:**

```python
# Current code
if stage in SLEEP_STAGES_AWAKE:
    time_awake_min += duration_mins
    if was_asleep:
        wake_up_count += 1
    was_asleep = False

# Better code (filter micro-wake-ups)
if stage in SLEEP_STAGES_AWAKE:
    time_awake_min += duration_mins
    if was_asleep and duration_mins >= 2.0:  # ← Only count wake-ups >= 2 minutes
        wake_up_count += 1
    was_asleep = False
```

**Pros:**
- Simple, one-line fix
- Filters out false positives from device quirks
- Keeps real wake-ups (typically 5+ minutes)

**Cons:**
- May miss very brief real wake-ups
- Threshold may need tuning per device

---

### Solution 2: Exclude Final Wake-Up Segment (Partial Fix)

**Idea:** Don't count the final "AWAKE" segment (the one at wake time), since that's expected.

```python
# After processing all segments, check if the last segment is AWAKE
if night_segments:
    last_segment = night_segments[-1]
    last_stage = last_segment["value"][0]["intVal"]
    if last_stage in SLEEP_STAGES_AWAKE:
        # This is the final wake-up, don't count it
        final_duration = (int(last_segment["endTimeNanos"]) - int(last_segment["startTimeNanos"])) / (1e9 * 60)
        time_awake_min -= final_duration
        wake_up_count = max(0, wake_up_count - 1)
```

**Pros:**
- Targets the specific issue (end-of-cycle being counted)

**Cons:**
- Only fixes one type of false positive
- May not work if segment ordering is wrong

---

### Solution 3: Google Health App Settings (Configuration)

If the issue is at the **Mi Fitness → Google Health** sync level, try these settings:

1. **In Google Health App:**
   - Settings → Sleep
   - Disable any "Automatic sleep tracking" if you're manually entering sleep
   - Try disabling "Sleep stage detection" if the device is misclassifying stages

2. **In Mi Fitness App (on your phone/watch):**
   - Check if there's a "Sleep sensitivity" or "Sleep stage detection" setting
   - Try setting it to "Low sensitivity" or "Conservative mode" if available
   - Disable "Wake detection" if available (the wearable will still track sleep, just not individual wake-ups)

---

### Solution 4: Google Fit Settings (API Level)

Google Fit itself has limited settings, but you can:

1. **Clear Sleep Data Cache:**
   - Go to Google Health/Fit
   - Settings → Data and Privacy → Delete sleep data → Re-sync from Mi Fitness

2. **Disable Sleep Sync Temporarily:**
   - Temporarily disconnect Mi Fitness from Google Health
   - Manually enter sleep data in Google Health for a day
   - See if the issue persists (isolates whether it's a device or sync issue)

---

## Recommended Approach (Step-by-Step)

### Phase 1: Diagnose (No Changes)
1. Look at your Google Fit sleep segment data directly:
   ```bash
   # In fit_to_sheets.py, add debug output around line 930:
   for segment in night_segments:
       stage = segment["value"][0]["intVal"]
       duration_mins = (end_nanos - start_nanos) / (1e9 * 60)
       print(f"  Segment: stage={stage} ({['ASLEEP','AWAKE','OUT_OF_BED'][stage-1]}) duration={duration_mins:.1f}min")
   ```

2. Run the script and inspect the output
3. Look for patterns:
   - Are all final segments marked as AWAKE?
   - Are there many sub-1-minute AWAKE segments?
   - Do segments look realistic?

### Phase 2: Apply Fix (Recommendation: Solution 1)
1. Edit `fit_to_sheets.py` to filter micro-wake-ups (duration < 2 minutes)
2. Test with `--dry-run` to preview changes
3. Run actual sync and check the results

### Phase 3: Verify
1. Check your Sleep sheet for:
   - Wake-up counts that look reasonable (0-3 per night, not 10+)
   - Wake-up durations that are realistic (not all 0-30 seconds)
2. Adjust threshold if needed (try 1min, 2min, 5min)

---

## Quick Diagnostic: Check Raw Data

Add this to `fit_to_sheets.py` before line 950 (when outputting results):

```python
# DEBUG: Print wake-up details
if wake_up_count > 3:
    print(f"  ⚠️  High wake-up count: {wake_up_count} (might indicate false positives)")
if time_awake_min > 30:
    print(f"  ⚠️  High awake time: {time_awake_min:.1f}min")
```

Run with `--verbose` and look for warnings.

---

## Google Fit API Documentation References

- [Sleep Segment Data Type](https://developers.google.com/fit/rest/v1/data-types/com.google.sleep.segment)
  - Stage 1: Awake
  - Stage 2: Sleep
  - Stage 3: Out of bed
  - Stage 4: Light sleep
  - Stage 5: Deep sleep
  - Stage 6: REM sleep

- [Sleep Sessions](https://developers.google.com/fit/rest/v1/data-types#sleep_session)

---

## My Recommendation

**Start with Solution 1** (filter micro-wake-ups < 2 minutes). This is:
- ✅ Low risk (minimal code change)
- ✅ Addresses the most common issue (spurious short AWAKE segments)
- ✅ Doesn't require external tool changes
- ✅ Easy to revert if it doesn't work

If that doesn't work, move to:
1. Check raw segment data with debug output
2. Contact Mi Fitness support or check their documentation
3. Try Solution 4 (clear sync cache and re-sync)

Would you like me to implement Solution 1 in your code?

---

**Date Created:** 15 November 2025  
**Issue Context:** Wake-ups incorrectly registered as end-of-cycle events
