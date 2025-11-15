# API Reference

Quick reference for key modules, functions, and constants in the Health_Coach codebase.

---

## Google Apps Script (GAS)

### Main Entry Point

**`gas/Main.js`**

```javascript
function main()
// Backwards-compatible entry point (proxies to weeklyReportJob)

function weeklyReportJob()
// Primary weekly report job
// - Reads Google Sheets (Activity, Sleep, HeartRate tabs)
// - Computes metrics (ACWR, SRI, HR delta, fulfillment %)
// - Builds and renders HTML email
// - Distributes to coach
// Runs weekly on Thursday 05:00 UTC (time-based trigger)
```

---

### Constants (`gas/Constants.js`)

**Configuration**:
```javascript
const CONFIG = {
  COACH_EMAIL: "coach@example.com",
  SPREADSHEET_ID: "sheet-id",
  ACTIVITY_SHEET: "Activity",
  SLEEP_SHEET: "Sleep",
  HEARTRATE_SHEET: "HeartRate"
};

const COACH_VOICE = {
  sleep: { success: {...}, warning: {...}, danger: {...}, neutral: {...} },
  load: { ... },
  cardio: { ... },
  work: { ... }
  // Coaching directives for each metric & grade
};

const OBS_LABELS = {
  success: "Stable",
  warning: "Moderate deficit",
  danger: "Severe deficit",
  neutral: "Data gap"
};
```

**Thresholds**:
```javascript
const ACWR_GATING_THRESHOLD = 1.5;           // Acute:Chronic ratio cutoff
const CAPACITY_WORK_THRESHOLD_LOW = 0.85;    // Low capacity marker
const CAPACITY_WORK_THRESHOLD_HIGH = 0.95;   // High capacity marker
const CAPACITY_SENTENCE_MAX_LENGTH = 180;    // Narrative truncation
```

---

### Formatters (`gas/Formatters.js`)

**Text Formatting Functions**:

```javascript
function fmtPct(n)
// Format number as percentage: fmtPct(0.85) → "85%"

function fmtHMin(totalMinutes)
// Format minutes as h:mm: fmtHMin(125) → "2h 5m"

function fmtDayOfWeek(dateObj)
// Format date as day name: fmtDayOfWeek(new Date()) → "Thursday"

function fmtDate(dateObj)
// Format date as "DD Mon YYYY": fmtDate(new Date()) → "08 Nov 2025"

function fmtDateRange(startDate, endDate)
// Format date range: fmtDateRange(...) → "07 Nov – 12 Nov"

function fmtDateISO(dateObj)
// Format ISO 8601: fmtDateISO(new Date()) → "2025-11-08"

// ... and 15+ more formatting utilities
```

---

### Validators (`gas/Validators.js`)

**Input Validation**:

```javascript
function isValidEmail(email: string): boolean
// Validate email format

function isValidMetric(value: any): boolean
// Check if value is valid number (0-100 typically)

function isValidScore(score: any): boolean
// Check if score is in valid range

function validateMetrics(metrics: Object): boolean
// Batch validate metrics object

// ... and more validation functions
```

---

### Scoring (`gas/Scoring.js`)

**Derived Metrics**:

```javascript
function computeACWR(currentWeekVolume, priorWeekVolume): number
// Acute:Chronic Workload Ratio
// ACWR = current week / (3-week average prior)

function computeSRI(sleepTimes): number
// Sleep Regularity Index (0-100)
// Higher = more consistent sleep times

function computeRestingHeartRateDelta(recent, baseline): number
// Change in resting HR from baseline

function computeFulfillmentPercent(metricsData, targets): number
// What % of days met the target?

// ... and 14+ more scoring functions
```

---

### Builders (`gas/Builders.js`)

**Report Structure Generation**:

```javascript
function buildSystemDriverCards_(renderContext): Array
// Build the 4 main metric cards (sleep, load, cardio, work)
// Returns array of card objects for HTML templating

function buildComponentRows_(renderContext): Array
// Build detailed metrics rows (ACWR table, SRI table, etc.)
// Each row includes metric, value, status, coaching directive

function buildCompositeSummary_(renderContext): Object
// Build capacity summary narrative
// Returns text with capacity grade, key observations

function ensureBucketGrade_(score): string
// Helper: Map score (0-100) to grade
// Returns: 'success' | 'warning' | 'danger' | 'neutral'

function isValidMetric_(value): boolean
// Helper: Check if metric is valid number
```

---

### Reporters (`gas/Reporters.js`)

**Email Generation & Delivery**:

```javascript
function distributeReport(renderContext)
// Main entry: Build HTML email, send to coach
// Logs execution success/failure

function renderCoachReadSection_(renderContext): string
// Render coach-facing introduction & key observations
// Returns HTML string

function buildCapacitySentence(renderContext): string
// Build narrative sentence about overall capacity
// Returns: "Capacity is [grade], [observations]"

function buildPlanSummaryText_(renderContext): string
// Build plan/next steps narrative
// Returns: Coaching directives for the week

// Email Template
const EMAIL_REPORT_CSS = "..."
// 220 lines of email-safe CSS styling
// Extracted from inline styles for reusability
```

---

### Job Pipeline (`gas/JobPipeline.js`)

**Orchestration & Logging**:

```javascript
function setupLogging(jobName: string): Logger
// Initialize logging context

function logInfo(message: string, data?: Object)
// Log info-level message

function logError(error: Error | string, context?: Object)
// Log error and context

function executeWithErrorHandling(fn: Function, fallback?: any): any
// Wrap function execution with try-catch and logging
```

---

## Python Sync (`sync/`)

### Entry Point

**`fit_to_sheets.py`**

```bash
python fit_to_sheets.py                    # Standard run
python fit_to_sheets.py --dry-run          # Preview
python fit_to_sheets.py --verbose          # Debug output
python fit_to_sheets.py --include-now      # Include current day
python fit_to_sheets.py --test-spreadsheet-id <ID>  # Test sheet
```

---

### Configuration (`sync/config.py`)

```python
SPREADSHEET_ID = "your-sheet-id"
ACTIVITY_SHEET_NAME = "Activity"
SLEEP_SHEET_NAME = "Sleep"
HEARTRATE_SHEET_NAME = "HeartRate"
TIMEZONE = "Europe/Stockholm"

# Credentials paths
CLIENT_SECRET_FILE = "client_secret.json"
SERVICE_ACCOUNT_FILE = "service_account.json"
TOKEN_FILE = "token.json"
```

---

### Data I/O (`sync/sheets.py`)

```python
def read_sheet(sheet_name: str) -> pd.DataFrame
# Read worksheet into DataFrame

def write_sheet(sheet_name: str, df: pd.DataFrame)
# Write DataFrame to worksheet

def merge_activity(new_data: pd.DataFrame, existing: pd.DataFrame) -> pd.DataFrame
# Merge new activity with existing rows
# Preserves manual edits, deduplicates by timestamp

def merge_sleep(new_data: pd.DataFrame, existing: pd.DataFrame) -> pd.DataFrame
# Merge sleep sessions and segments
# Handles in-progress sessions (null end time)

def merge_heartrate(new_data: pd.DataFrame, existing: pd.DataFrame) -> pd.DataFrame
# Append and deduplicate HR readings by timestamp
```

---

### Time Utilities (`sync/time.py`)

```python
def get_week_bounds(reference_date: datetime) -> Tuple[datetime, datetime]
# Get Saturday–Friday bounds for week containing reference_date
# TZ-aware, respects Europe/Stockholm

def normalize_to_tz(dt: datetime) -> datetime
# Normalize datetime to configured timezone

def is_in_week(dt: datetime, week_bounds: Tuple) -> bool
# Check if datetime falls within week bounds
```

---

### Utilities (`sync/utils.py`)

```python
def safe_num(value: any, default: float = 0.0) -> float
# Coerce to float; return default if invalid

def fmt_pct(value: float) -> str
# Format as percentage

def round_metric(value: float, decimals: int = 1) -> float
# Round metric with specified precision

def validate_dataframe(df: pd.DataFrame, schema: Dict) -> bool
# Validate DataFrame matches expected schema
```

---

### Google Fit API (`sync/fit_to_sheets.py`)

```python
def fetch_fit_sessions(start_date: datetime, end_date: datetime) -> List[Dict]
# Query Google Fit Activities API
# Returns activity sessions with duration, energy, etc.

def fetch_fit_sleep(start_date: datetime, end_date: datetime) -> List[Dict]
# Query Google Fit Sleep Sessions API
# Returns sleep sessions and segments

def fetch_fit_heartrate(start_date: datetime, end_date: datetime) -> List[Dict]
# Query Google Fit Heart Rate API
# Returns HR readings with timestamp
```

---

## UI Components (`ui/`)

### Adapter: Metrics (`ui/adapter-metrics.js`)

```javascript
function adaptMetricsForDisplay(rawMetrics)
// Transform raw metrics into displayable format
// Returns formatted metrics ready for UI rendering

function formatMetricValue(value, unit)
// Format individual metric with unit
// Example: formatMetricValue(0.85, '%') → "85%"
```

---

### Adapter: Narrative (`ui/adapter-narrative.js`)

```javascript
function adaptNarrativeForDisplay(rawText)
// Transform raw coaching narrative for UI display
// Handles truncation, highlighting, etc.

function parseCoachDirective(text)
// Parse directive into structured form
// Returns { action, target, timeframe }
```

---

### Validators (`ui/validators.js`)

```javascript
function validateUserInput(input)
// Client-side validation for manual metric entries

function validateEmail(email)
// Validate email format

function validateDateRange(start, end)
// Validate date range (start <= end)
```

---

## Data Schemas

### Google Sheets Structure

**Activity Tab**:
```
| Date       | Time  | Activity     | Duration (min) | Energy (kcal) | RPE |
|------------|-------|--------------|----------------|---------------|-----|
| 2025-11-07 | 18:30 | Run          | 45             | 850           | 7   |
| 2025-11-08 | 10:00 | Strength     | 60             | 450           | 6   |
```

**Sleep Tab**:
```
| Date       | Bedtime | Wake Time | Duration (h) | Quality |
|------------|---------|-----------|--------------|---------|
| 2025-11-07 | 22:30   | 06:30     | 8.0          | Good    |
| 2025-11-08 | 23:00   | 06:45     | 7.75         | Fair    |
```

**HeartRate Tab**:
```
| Timestamp         | Heart Rate (bpm) |
|-------------------|------------------|
| 2025-11-08 06:30  | 58               |
| 2025-11-08 19:00  | 62               |
```

---

## Environment Variables

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=<your-sheet-id>
GOOGLE_CLIENT_SECRET_JSON=<path-or-json>
GOOGLE_SERVICE_ACCOUNT_JSON=<path-or-json>
GOOGLE_FIT_TOKEN_JSON=<path-or-json>
TZ=Europe/Stockholm
```

---

## Common Patterns

### Null-Coalescing
```javascript
// ✅ Correct: Only coalesces null/undefined
const value = rawValue ?? defaultValue;

// ❌ Wrong: Also coalesces 0, "", false
const value = rawValue || defaultValue;
```

### Guard Clauses
```javascript
// ✅ Fail-fast
function processMetric(value) {
  if (!isValidMetric_(value)) return null;
  if (value < 0 || value > 100) return null;
  // Now proceed safely
}
```

### Rendercontext Pattern
```javascript
// ✅ Single object instead of 15+ parameters
const renderContext = {
  sleepSri,
  acwrValue,
  capacityGrade,
  // ... all render variables
};
distributeReport(renderContext);
```

---

**See Also**:
- [`docs/architecture.md`](./architecture.md) – System design
- [`docs/decisions.md`](./decisions.md) – Why these APIs exist
- [`docs/deployment.md`](./deployment.md) – How to deploy

---

**Last Updated**: 8 November 2025
