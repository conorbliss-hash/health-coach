# Deployment & Operations

How to set up, configure, deploy, and troubleshoot the Health_Coach system.

---

## Quick Start (First-Time Setup)

### 1. Clone & Install

```bash
git clone https://github.com/conorbliss-hash/Health_Coach.git
cd Health_Coach

# Python dependencies
pip install -r requirements.txt

# Node dependencies (UI layer)
npm install --no-fund
```

### 2. Configure Credentials

Create JSON credential files (or set environment variables):

```bash
# From Google Cloud Console
cp client_secret.json.example client_secret.json     # OAuth credentials
cp service_account.json.example service_account.json # Service account
```

**Location**: Place in project root or set `GOOGLE_CLIENT_SECRET_JSON` env var.

### 3. Generate Initial Token

First interactive auth to get refresh token:

```bash
python fit_to_sheets.py
# Will open browser for OAuth login
# Saves refresh token to token.json
```

### 4. Test Local Sync

```bash
# Dry-run mode (no sheet writes)
python fit_to_sheets.py --dry-run --verbose

# If successful, run live
python fit_to_sheets.py
```

---

## Python Sync Deployment

### Local Setup

**Configuration** (`sync/config.py`):
```python
SPREADSHEET_ID = "your-sheet-id-here"
ACTIVITY_SHEET_NAME = "Activity"
SLEEP_SHEET_NAME = "Sleep"
TIMEZONE = "Europe/Stockholm"
```

**Run Modes**:
```bash
python fit_to_sheets.py                    # Standard run
python fit_to_sheets.py --dry-run          # Preview changes
python fit_to_sheets.py --verbose          # Debug output
python fit_to_sheets.py --include-now      # Include up-to-now data
python fit_to_sheets.py --test-spreadsheet-id <ID>  # Test sheet
```

### Local Cron Schedule

Add to crontab for daily 05:00 local time run:

```bash
crontab -e

# Add this line:
0 5 * * * cd /Users/conorbliss/Desktop/4.\ HT && /usr/bin/python3 fit_to_sheets.py >> logs/fit_to_sheets.log 2>&1
```

Verify:
```bash
crontab -l  # List scheduled jobs
```

Remove:
```bash
crontab -r  # Delete all cron jobs
```

### CI/CD: GitHub Actions

**File**: `.github/workflows/daily-sync.yml`

**Triggers**:
- Daily at 04:00 UTC (every day)
- Manual trigger (Actions tab → Run workflow)

**Setup Required**:

1. Add repository secrets (Settings → Secrets and variables → Actions → New repository secret):
   - `GOOGLE_SHEETS_SPREADSHEET_ID` – Sheet ID from URL
   - `GOOGLE_CLIENT_SECRET_JSON` – Full JSON from `client_secret.json`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` – Full JSON from `service_account.json`
   - `GOOGLE_FIT_TOKEN_JSON` – Full JSON from `token.json` (refresh token)
   - `TZ` – Timezone (optional; defaults to UTC)

2. Share Google Sheet with service account email (from `service_account.json`):
   ```
   "client_email": "your-service-account@project.iam.gserviceaccount.com"
   ```

3. Verify workflow:
   - Go to Actions tab
   - Check last run for success/failure
   - View logs if needed

---

## Google Apps Script Deployment

### Prerequisites

Install clasp (Google Apps Script CLI):

```bash
npm install -g @google/clasp
clasp login  # One-time OAuth login
```

### Setup GAS Project

1. Create Google Apps Script project:
   - Go to [script.google.com](https://script.google.com)
   - Create new project
   - Copy project ID from Settings

2. Link local directory to GAS project:
   ```bash
   cd gas
   echo '{"scriptId":"YOUR_PROJECT_ID"}' > .clasp.json
   ```

### Deploy Files

```bash
cd gas

# Pull latest from editor (if edited online)
clasp pull

# Push local changes to GAS
clasp push

# Force push (overwrite online)
clasp push --force

# View in editor
clasp open
```

### Weekly Job Setup

In GAS editor (or via `clasp open`):

1. **Set up time-based trigger**:
   - Click "⏰" (Triggers icon)
   - Create trigger:
     - Function: `weeklyReportJob`
     - Event type: Time-driven
     - Frequency: Weekly (Thursday 05:00 UTC)

2. **Configure email recipient**:
   - Edit `gas/Constants.js`:
     ```javascript
     const CONFIG = {
       COACH_EMAIL: "coach@example.com",
       SPREADSHEET_ID: "your-sheet-id",
       // ...
     };
     ```
   - Deploy: `clasp push`

3. **Test manually**:
   - Click "Run" next to `weeklyReportJob()` in editor
   - Check execution logs (Executions tab)
   - Verify email sent (check inbox)

### Execution Logs

View past executions:
1. Go to Apps Script editor
2. Click "Executions" tab
3. See list of runs with status, time, and errors

Monitor logs:
1. During execution: "Logs" panel shows real-time output
2. After execution: Executions tab shows result (success/error)

---

## Troubleshooting

### Python Sync Issues

#### Error: `google.auth.exceptions.RefreshError`

**Problem**: Token is invalid or expired.

**Solution**:
1. Delete `token.json`
2. Re-authenticate: `python fit_to_sheets.py` (browser login)
3. Commit new `token.json` to repo

#### Error: `gspread.exceptions.APIError: 403 Forbidden`

**Problem**: Service account doesn't have permission to sheet.

**Solution**:
1. Get service account email from `service_account.json` → `client_email`
2. Share Google Sheet with that email (Editor role)
3. Retry sync

#### Error: `No module named 'gspread'`

**Problem**: Dependencies not installed.

**Solution**:
```bash
pip install -r requirements.txt
```

#### Sync runs but no data appears

**Problem**: Possible dry-run mode or wrong sheet ID.

**Solution**:
```bash
# Check if dry-run
python fit_to_sheets.py --verbose  # Should show writes

# Verify sheet ID
grep SPREADSHEET_ID sync/config.py
# Should match URL: https://docs.google.com/spreadsheets/d/YOUR_ID/edit
```

### Google Apps Script Issues

#### Job doesn't run on schedule

**Problem**: Trigger not set or function not found.

**Solution**:
1. Go to Executions tab; see if job ran
2. If not: Add trigger (see setup above)
3. Verify function exists: `grep -n "function weeklyReportJob" gas/*.js`
4. Check Apps Script logs for errors

#### Email not sending

**Problem**: Wrong email or permission issue.

**Solution**:
1. Verify email in `gas/Constants.js`: `COACH_EMAIL`
2. Test manual run: Click "Run" in editor
3. Check logs for errors (Executions tab)
4. Verify GAS project has Gmail permission (Scopes)

#### Wrong data in report

**Problem**: Sheets aren't synced or have stale data.

**Solution**:
1. Manually run Python sync: `python fit_to_sheets.py`
2. Verify data in Google Sheet (Activity, Sleep tabs)
3. Run GAS job manually: `clasp push && clasp run weeklyReportJob`
4. Check logs (Apps Script → Executions)

#### "Missing SomeFunction" error

**Problem**: Refactored code not deployed.

**Solution**:
```bash
cd gas
clasp push --force  # Force overwrite
```

---

## Monitoring & Health Checks

### Python Sync Health

Check last sync status:
```bash
# Local cron
tail -20 logs/fit_to_sheets.log

# GitHub Actions
Go to Actions tab → daily-sync workflow → View latest run
```

### GAS Job Health

1. Go to Apps Script editor
2. Click "Executions" tab
3. Sort by "Execution time" (descending)
4. Look for recent runs with ✅ or ❌

Monitor weekly:
- Thursday ~05:00 UTC: Job should run
- Check inbox for email ~05:15 UTC
- If missing: Check Executions tab for errors

### Email Verification

Test email sends:
```bash
# In Apps Script editor
function testEmail() {
  const renderContext = { /* minimal data */ };
  distributeReport(renderContext);  // Should send immediately
}

# Run it
Click "Run" → Check inbox
```

---

## Backups & Recovery

### Backup Google Sheets

Google Sheets auto-saves, but for disaster recovery:

```bash
# Export Activity sheet to CSV
python -c "
import gspread
gc = gspread.service_account(filename='service_account.json')
sh = gc.open_by_key('YOUR_SHEET_ID')
data = sh.worksheet('Activity').get_all_records()
# Save data to CSV...
"
```

### Rollback GAS Changes

If a deployment breaks the weekly job:

```bash
cd gas
git checkout HEAD~1 -- *.js  # Revert to previous commit
clasp push --force           # Deploy reverted code
```

---

## Performance & Optimization

### Sync Performance

Typical runtime: ~30 seconds

To optimize:
- `--include-now`: Adds 10-15 seconds (includes current day)
- `--dry-run`: Disables sheet writes (saves 5 seconds)

### GAS Performance

Typical runtime: ~15 seconds

To monitor:
- Apps Script → Executions → Check "Execution time" column
- If > 60s: Check for API rate limits or large sheet reads

---

## Security Best Practices

1. **Never commit secrets**:
   ```bash
   # Verify .gitignore has these:
   client_secret.json
   service_account.json
   token.json
   .env
   ```

2. **Use environment variables for CI/CD**:
   - Store JSON in GitHub Secrets (encrypted)
   - Reference via `${{ secrets.SECRET_NAME }}`

3. **Limit GAS scopes**:
   - Review scopes in `gas/appsscript.json`
   - Only request what's needed (gmail, sheets, fit)

4. **Rotate credentials periodically**:
   - Service account keys every ~1 year
   - OAuth tokens auto-refresh (handled by library)

---

## Support & Resources

**Documentation**:
- [`docs/architecture.md`](./architecture.md) – System design
- [`docs/decisions.md`](./decisions.md) – Engineering decisions
- [`docs/api-reference.md`](./api-reference.md) – Function reference
- [`docs/troubleshooting.md`](./troubleshooting.md) – FAQ

**External**:
- [Google Fit API docs](https://developers.google.com/fit)
- [Google Sheets API docs](https://developers.google.com/sheets/api)
- [Apps Script docs](https://developers.google.com/apps-script)
- [gspread docs](https://docs.gspread.org)

---

**Last Updated**: 8 November 2025  
**Maintained By**: Conor Bliss
