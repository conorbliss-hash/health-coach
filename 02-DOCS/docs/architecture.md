# Architecture

**Health_Coach** is a multi-layer system that:
1. Syncs health data from Google Fit to Google Sheets (Python `sync/` layer)
2. Renders weekly email reports with coaching guidance (Google Apps Script `gas/` layer)
3. Provides UI components for manual interventions (`ui/` layer)

---

## System Overview

```
┌─────────────────┐
│  Google Fit     │  (User's fitness data)
│  APIs           │
└────────┬────────┘
         │
         │ Pull fitness metrics
         │ (activity, sleep, heart rate)
         │
    ┌────▼─────────────────────────────┐
    │   sync/fit_to_sheets.py           │  Python sync layer
    │   • Extract from Fit APIs         │  (cron job / GitHub Actions)
    │   • Merge with manual edits       │
    │   • Write consolidated data       │
    └────┬─────────────────────────────┘
         │
         │ Writes to Sheet
         │
    ┌────▼──────────────────┐
    │  Google Sheets        │  (Data lake / manual edit layer)
    │  • Activity tab       │
    │  • Sleep tab          │
    │  • HeartRate tab      │
    └────┬──────────────────┘
         │
         │ Read for weekly report
         │
    ┌────▼─────────────────────────────┐
    │   gas/Main.js (GAS)               │  Weekly job runner
    │   • Orchestrates report pipeline  │
    │   • Computes derived stats        │
    │   • Renders HTML email            │
    │   • Sends to coach                │
    └────┬─────────────────────────────┘
         │
         │ Distributed to:
         │
    ┌────▼─────────────────┐
    │  Email Report        │  (Coach's inbox weekly)
    │  • Coaching guidance │
    │  • Performance data  │
    │  • Visual cards      │
    └──────────────────────┘
```

---

## Codebase Layers

### Layer 1: Python Sync (`sync/`)

**Purpose**: Extract health data from Google Fit, merge intelligently with manual edits, write consolidated state to Google Sheets.

**Files**:
- `sync/fit_to_sheets.py` – CLI entry point; orchestrates extract → merge → write
- `sync/config.py` – Configuration, credentials, spreadsheet IDs
- `sync/sheets.py` – Sheet I/O: read/write DataFrames, merge logic
- `sync/time.py` – Timezone normalization, week/day calculations
- `sync/utils.py` – Utility functions: filtering, validation, logging

**Key Principles**:
- **Deterministic merge**: Same input always produces same output
- **Preserve manual edits**: New data merged around existing rows/formulas
- **Graceful fallback**: No Google Fit sessions? Use sleep segments instead

**Typical Flow**:
```
1. fetch_fit_sessions()  → Raw activity data from Google Fit
2. fetch_fit_sleep()     → Raw sleep segments
3. merge_activity()      → Merge with existing Activity sheet
4. merge_sleep()         → Merge with existing Sleep sheet
5. write_to_sheets()     → Publish consolidated state
```

---

### Layer 2: Google Apps Script (`gas/`)

**Purpose**: Weekly job that reads consolidated health data, computes insights, renders HTML email, sends to coach.

**Architecture**: **8 specialized modules** (Phase 2 refactoring)

```
gas/
├── Main.js                 # Entry point (weeklyReportJob)
├── Constants.js            # CONFIG, COACH, schemas, thresholds
├── Formatters.js           # 20+ formatting functions (pct, time, etc)
├── Validators.js           # Input validation functions
├── Scoring.js              # 18+ scoring algorithms
├── JobPipeline.js          # Job orchestration, logging, error handling
├── Builders.js             # Build report cards and tables
├── Reporters.js            # Render HTML email, distribute
└── appsscript.json         # GAS manifest
```

**Module Responsibilities**:

| Module | Purpose | LOC |
|--------|---------|-----|
| `Main.js` | Weekly job orchestration | 1,707 |
| `Constants.js` | Configuration & thresholds | 119 |
| `Formatters.js` | Text formatting (pct, time, date) | 205 |
| `Validators.js` | Input guards, null checks | 280 |
| `Scoring.js` | Derived metrics (ACWR, SRI, fulfillment) | 241 |
| `JobPipeline.js` | Logging, error handling, job flow | 114 |
| `Builders.js` | Report cards, metrics tables, summary | 659 |
| `Reporters.js` | HTML rendering, email delivery | 647 |

**Data Flow**:

```
weeklyReportJob()
  ├─ Read sheets (Activity, Sleep, HeartRate)
  ├─ Compute metrics:
  │   └─ Scoring.js: ACWR, SRI, resting HR delta, fulfillment %, etc
  ├─ Prepare render context:
  │   ├─ Format values (Formatters.js)
  │   ├─ Validate inputs (Validators.js)
  │   └─ Grade performance (Builders.js: ensureBucketGrade_)
  ├─ Build report structure:
  │   ├─ System driver cards (Builders.js)
  │   ├─ Metrics tables (Builders.js)
  │   └─ Coach narrative (Reporters.js)
  ├─ Render HTML:
  │   └─ Reporters.js: buildEmailHTML() + EMAIL_REPORT_CSS
  └─ Distribute:
      └─ Reporters.js: distributeReport()
```

---

### Layer 3: UI Components (`ui/`)

**Purpose**: Frontend components for manual interventions, data entry, coaching interface.

**Files**:
- `ui/index.js` – Main UI entry point
- `ui/adapter-metrics.js` – Metrics display adapter
- `ui/adapter-narrative.js` – Narrative/coaching text adapter
- `ui/validators.js` – Client-side input validation
- `ui/labels.js` – UI labels and text constants
- `ui/text.js` – Text formatting utilities

**Usage**: Embedded in Google Sheets or as standalone tool for editing coaching narratives, manual metric overrides, etc.

---

## Data Flow: Weekly Report Generation

```
1. FETCH
   └─ Read Google Sheets (Activity, Sleep, HeartRate tabs)

2. COMPUTE
   ├─ Extract week bounds (Saturday → Friday, TZ-aware)
   ├─ Compute metrics:
   │   ├─ Activity: ACWR (Acute:Chronic Workload Ratio)
   │   ├─ Sleep: SRI (Sleep Regularity Index)
   │   ├─ Heart: Resting HR, delta from baseline
   │   └─ Fulfillment: % of days meeting targets
   └─ Grade performance (success / warning / danger / neutral)

3. PREPARE RENDER CONTEXT
   ├─ Format metrics (pct, time, date)
   ├─ Validate all values (bounds checks, null handling)
   ├─ Prepare coaching voice (directives, re-check intervals)
   └─ Build narrative (capacity sentence, observations)

4. BUILD STRUCTURE
   ├─ System driver cards (sleep, load, cardio, work)
   ├─ Metrics tables (ACWR, SRI, fulfillment)
   ├─ Appendix (baseline stats, missing days)
   └─ Footer (signature, next steps)

5. RENDER HTML
   ├─ Merge context into HTML template
   ├─ Apply CSS (email-safe styling)
   ├─ Sanitize for email clients
   └─ Generate final HTML

6. DISTRIBUTE
   ├─ Send email to coach
   ├─ Log execution (Apps Script logs)
   └─ Handle errors gracefully
```

---

## Key Design Decisions

See [`docs/decisions.md`](./decisions.md) for detailed rationale.

**Quick Summary**:
- **Rendercontext pattern**: Collect render variables into single object (avoids 15+ parameters)
- **Nullish coalescing (`??`)**: Distinguish falsy vs. missing values
- **Named constants**: All thresholds and magic numbers in `Constants.js`
- **Helper functions**: DRY principle → `ensureBucketGrade_()`, `isValidMetric_()`, `isNonZeroMetric_()`
- **Modularization**: 8 specialized modules instead of 1 monolithic file

---

## Configuration & Customization

### Google Fit → Sheets Sync

**Edit** `sync/config.py`:
```python
SPREADSHEET_ID = "your-sheet-id"
ACTIVITY_SHEET_NAME = "Activity"
SLEEP_SHEET_NAME = "Sleep"
TIMEZONE = "Europe/Stockholm"
```

**Run**:
```bash
python fit_to_sheets.py  # Standard run
python fit_to_sheets.py --dry-run  # Preview
python fit_to_sheets.py --verbose  # Debug output
```

### Weekly Report Job

**Edit** `gas/Constants.js`:
```javascript
const CONFIG = {
  COACH_EMAIL: "coach@example.com",
  SPREADSHEET_ID: "your-sheet-id",
  // ... more config
};

const CAPACITY_WORK_THRESHOLD_LOW = 0.85;   // Tunable
const CAPACITY_WORK_THRESHOLD_HIGH = 0.95;  // Tunable
```

**Deploy**:
```bash
cd gas && clasp push
```

**Run manually** in Apps Script editor: Click "Run" next to `main()` or `weeklyReportJob()`.

---

## Testing

### Python Layer
```bash
pytest tests/  # Unit tests for merge logic
pytest tests/ -v --cov=sync  # With coverage
```

### UI Layer
```bash
npm test  # Jest tests for UI components
npm test -- --coverage
```

### Google Apps Script
- Manual test via Apps Script editor: "Run" button
- Check logs: Apps Script → Execution logs
- Test email delivery by running `weeklyReportJob()` manually

---

## Deployment

### Development → Production

**Python Sync**:
```bash
# Local: cron job or manual run
python fit_to_sheets.py

# CI/CD: GitHub Actions (daily at 04:00 UTC)
.github/workflows/daily-sync.yml
```

**Google Apps Script**:
```bash
cd gas
clasp push --force  # Deploy to GAS project
# Weekly job runs automatically on Thursday 05:00 UTC (via Time-based trigger)
```

---

## Troubleshooting

See [`docs/troubleshooting.md`](./troubleshooting.md) for common issues.

**Quick Reference**:
- **Sync failures**: Check `sync/config.py` credentials, spreadsheet permissions
- **Report not sending**: Check Apps Script logs, email address in `Constants.js`
- **Wrong metrics**: Verify sheet structure matches schema (Activity, Sleep tabs)

---

## Future Roadmap

- [ ] Add real-time notifications (Slack integration)
- [ ] Multi-coach support (send different reports to different coaches)
- [ ] Customizable report templates (coach-specific messaging)
- [ ] Mobile app for manual data entry
- [ ] Analytics dashboard (historical trends)

---

**See Also**: 
- [`README.md`](../README.md) – Quick start
- [`docs/decisions.md`](./decisions.md) – Why things are designed this way
- [`docs/deployment.md`](./deployment.md) – How to deploy
- [`docs/api-reference.md`](./api-reference.md) – Function reference
