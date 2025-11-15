# Health Coach Automation - Technical Reference

## Purpose and Scope
This document captures the automation that keeps the Health Coach Google Sheet populated with the latest Google Fit metrics. It emphasises the runtime workflow (local and CI), authentication strategy, data pipelines, and the Sheet synchronisation model so the content can be repurposed for diagrams, presentations, or social storytelling.

## High-Level Flow
1. **Trigger** - Either the GitHub Actions schedule fires daily at 04:00 UTC or a maintainer launches the workflow manually. Local runs are possible for development or recovery.
2. **Environment Setup** - The runner checks out the repository, provisions Python 3.11, and restores dependencies from `requirements.txt`.
3. **Secret Rehydration** - The workflow reconstructs `.env`, `client_secret.json`, `token.json`, and `service_account.json` from encrypted repository secrets/variables.
4. **Data Harvesting** - `fit_to_sheets.py` authenticates with Google Fit and requests 31 days of steps, resting heart rate statistics, and granular sleep data.
5. **Transform & Consolidate** - Timestamps convert into the configured local timezone, nightly sleep sessions merge with segment-level insights, and existing Sheet rows are merged with fresh data frames.
6. **Publish** - The Google Sheet receives the harmonised data in dedicated tabs (`Steps`, `HeartRate`, `Sleep`), including formatting adjustments for sleep quality metrics.

## Workflow Trigger & Scheduling
- **Primary cadence**: Cron expression `0 4 * * *` guarantees a nightly refresh aligned with early morning UTC (late evening US time zones).
- **Manual override**: `workflow_dispatch` allows on-demand reruns when secrets change, troubleshooting is needed, or historic data must be backfilled.
- **Local execution**: Developers can run `python fit_to_sheets.py` once credentials exist locally; the same environment variables and JSON files are reused.

## Credential Lifecycle
- **Google OAuth client (`client_secret.json`)** - Seeds an Installed App OAuth flow. When the script lacks a valid `token.json`, it launches a local web server for interactive consent.
- **User token (`token.json`)** - Stores refresh and access tokens for the Google Fit scopes. If the token expires, the script refreshes it transparently via `google.auth.transport.requests.Request`.
- **Service account (`service_account.json`)** - Enables server-side editing of the destination Google Sheet through `gspread` and must have write access to the sheet.
- **Environment file (`.env`)** - Contains `GOOGLE_SHEETS_SPREADSHEET_ID` and `TZ`. GitHub Actions persists it per run so the script inherits identical behaviour as local developers.
- **Secrets enforcement** - The workflow fails fast with explicit `Missing secret: ...` messaging if any required secret is absent, ensuring misconfiguration surfaces immediately in job logs.

## Data Windows & Timezone Normalisation
- **Lookback period**: The script computes a 31-day window (`today_local - 31` through `today_local`) to give Slack buffers for midnight boundaries and backfill any delayed Fit syncs.
- **Daily buckets**: Date ranges translate into UTC start/end (`day_bounds_local`) so Google Fit aggregate queries use midnight-to-midnight spans aligned with the chosen timezone.
- **Timezone fidelity**: All returned timestamps convert back to the local timezone (`TZ` from `.env`) before generating sheet rows, guaranteeing midnight-based reporting matches user expectations.

## Google Fit Pipelines
### Steps (`extract_steps`)
- Aggregates `com.google.step_count.delta` using the `dataset:aggregate` endpoint.
- Sums `intVal` across the bucket's dataset points, producing a simple daily step count.
- Rows include ISO-formatted `date` and integer `steps`, sorted ascending before upload.

### Heart Rate (`extract_heart_rate`)
- Requests `com.google.heart_rate.bpm` aggregates across the same daily buckets.
- Collates floating-point BPM values into a `pandas.Series` to compute daily minimum, average, and maximum heart rates (`hr_min`, `hr_avg`, `hr_max`).
- Handles days without data by inserting explicit nulls, ensuring the Sheet remains aligned even during device outages.

### Sleep (`extract_sleep`)
- **Session discovery**: Calls `/users/me/sessions` filtering by activity type 72 (Sleep) for the target window. Sessions group by "night" using a 12-hour backshift to handle late-evening bedtimes.
- **Segment enrichment**: Downloads granular stages from the merged sleep segment data source (`derived:com.google.sleep.segment:...`). Segments sort chronologically and filter to a session's first bedtime through final wake-up.
- **Sleep metrics**:
  - `sleep_total_min` - Sum of session durations (start vs. end time in milliseconds) rounded to the nearest minute.
  - `start_time` / `end_time` - Local clock times for first bedtime and final wake-up, formatted `HH:MM:SS`.
  - `time_awake_min` - Total minutes spent in awake segments (stage 1 or 3) during the night.
  - `wake_up_count` - Transitions from asleep to awake segments, using a `was_asleep` guard to avoid counting the initial pre-sleep period.
- **Data hygiene**: Skips nights with no sessions, yet leaves the structure intact so Sheets history remains consistent.

## Sheet Synchronisation Strategy (`update_tab`)
- Opens the spreadsheet via service account credentials and lazily creates missing worksheets.
- Downloads existing records into a DataFrame; dates normalise to strings to preserve consistent keys.
- **Merge policy**: Existing records update in place where dates match, and brand-new dates append, avoiding duplicate rows while retaining historic metrics.
- Re-sorts by date, fills empty cells with blanks for neatness, and clears the sheet before writing to avoid stale tail data.
- Post-write formatting ensures the `Sleep` tab's wake-up count and awake minutes columns display as plain numbers (`ws.format('E:F', ...)`), preventing spreadsheet auto-format quirks.

## Error Handling & Observability
- Helper `require()` logs fatal messages to stderr then exits with code 1, surfacing issues directly in the Actions build summary.
- HTTP requests call `raise_for_status()` so API failures break execution rather than silently skipping data.
- Standard output includes progress cues ("Fetching step data...", "Google Sheets updated successfully.") to make Action logs readable.

## Extensibility Notes
- **Adding metrics**: Introduce new extractors following the existing pattern: define aggregation parameters, convert to a minimal DataFrame keyed by `date`, and call `update_tab` with a new tab name.
- **Longer history**: Adjust the lookback window in `main()` and consider rate limits; Sheets merge logic already handles large inserts.
- **Alerts/Monitoring**: Hook Action failures into GitHub notifications or chat ops; logs already indicate missing secrets vs. API errors.
- **Testing**: Lightweight unit tests could mock Google Fit responses and validate DataFrame shape transformations before Sheets I/O.

## Visualisation & Storytelling Angles
- **Architecture diagram**: Depict GitHub Actions as the orchestrator, emphasising secret injection, Fit API calls, and Sheets publishing. Highlight the dual credential paths (OAuth token vs. service account).
- **Sequence timeline**: Show midnight-to-midnight aggregation, timezone conversions, and the order of extractor execution feeding into the merge/write cycle.
- **Metric spotlight**: Illustrate sleep analytics by charting how sessions and segments combine to produce meaningful wake-up counts and awake-time insights.
- **Ops narrative**: Frame the automation as a "daily wellness sync" that guarantees up-to-date dashboards without manual export/import steps.

## Local Developer Checklist
1. Copy `client_secret.json`, `token.json`, `service_account.json`, and `.env` into the project root (matching the GitHub secrets).
2. Run `pip install -r requirements.txt` inside an activated virtual environment.
3. Execute `python fit_to_sheets.py`; the script refreshes `token.json` if necessary and writes progress to stdout.
4. Confirm the target Google Sheet updates and that new tabs appear when missing.

## Operational Considerations
- **Secret hygiene**: Rotate OAuth client and service-account keys periodically; update repository secrets to match.
- **Sheet permissions**: If the service account loses access, the run fails at `gspread.service_account`; share the Sheet proactively when duplicating dashboards.
- **Rate limits**: Daily cadence stays well within Google Fit quotas, but repeated manual runs in short succession could approach per-minute limits.
- **Recovery**: Deleting `token.json` forces a fresh OAuth grant; useful when consent scopes change or tokens become invalid.

