# Troubleshooting Guide

Common issues and solutions for Health_Coach.

---

## Python Sync Issues

### ❌ "ModuleNotFoundError: No module named 'gspread'"

**Cause**: Dependencies not installed.

**Solution**:
```bash
pip install -r requirements.txt
```

---

### ❌ "google.auth.exceptions.RefreshError: ('invalid_grant', ...)"

**Cause**: OAuth token is invalid or expired.

**Solution**:
1. Delete `token.json`
2. Re-authenticate:
   ```bash
   python fit_to_sheets.py
   ```
   Browser will open for login
3. New token saved to `token.json`
4. Commit to repo so CI/CD can use it

---

### ❌ "gspread.exceptions.APIError: 403 Forbidden"

**Cause**: Service account doesn't have permission to the Google Sheet.

**Solution**:
1. Get service account email from `service_account.json`:
   ```bash
   grep "client_email" service_account.json
   # Example: my-service-account@project.iam.gserviceaccount.com
   ```
2. Open the Google Sheet in browser
3. Click "Share" → Add the service account email with **Editor** role
4. Retry sync:
   ```bash
   python fit_to_sheets.py
   ```

---

### ❌ "FileNotFoundError: [Errno 2] No such file or directory: 'client_secret.json'"

**Cause**: OAuth credentials missing.

**Solution**:
1. Download from Google Cloud Console (OAuth 2.0 Client ID)
2. Rename to `client_secret.json`
3. Place in project root
4. Retry:
   ```bash
   python fit_to_sheets.py
   ```

---

### ❌ Sync runs but no data appears in Google Sheet

**Cause**: Dry-run mode, or wrong sheet ID, or permissions issue.

**Solution**:
1. Check if dry-run is enabled:
   ```bash
   python fit_to_sheets.py --verbose
   # Should show "Writing X rows to Activity sheet"
   # NOT "DRY-RUN: Would write..."
   ```

2. Verify sheet ID:
   ```bash
   grep SPREADSHEET_ID sync/config.py
   # Should match URL: docs.google.com/spreadsheets/d/YOUR_ID/edit
   ```

3. Verify sheet exists and has Editor permission (service account):
   ```bash
   python fit_to_sheets.py --dry-run --verbose
   # Should show no errors in "Checking sheet structure"
   ```

---

### ❌ "OSError: [Errno 2] No such file or directory: 'logs'"

**Cause**: Logs directory doesn't exist (cron job issue).

**Solution**:
```bash
mkdir -p logs
# Cron will create logs/fit_to_sheets.log on first run
```

---

### ⚠️ Sync runs but produces incomplete data

**Cause**: Google Fit API returned partial data, or network timeout.

**Solution**:
1. Check network connectivity:
   ```bash
   ping www.google.com
   ```

2. Retry with verbose output:
   ```bash
   python fit_to_sheets.py --verbose
   # Look for "Fetched X activity sessions", "Fetched Y sleep sessions"
   ```

3. If specific dates are missing, retry with date range:
   ```bash
   # Modify sync/fit_to_sheets.py to include --start-date --end-date flags
   ```

---

## Google Apps Script Issues

### ❌ "ReferenceError: Constants is not defined"

**Cause**: `Constants.js` not deployed or not loaded.

**Solution**:
```bash
cd gas
clasp push --force  # Force overwrite all files

# Verify file exists in editor:
clasp open  # Should open browser with all 8 files listed
```

---

### ❌ Weekly job doesn't run (no email sent)

**Cause**: Trigger not set, or function error.

**Solution**:

1. **Check trigger exists**:
   - Go to Google Apps Script editor
   - Click "⏰" (Triggers icon)
   - Should see `weeklyReportJob` with "Weekly, Thursday 05:00"
   - If missing: Create trigger (see [`docs/deployment.md`](./deployment.md))

2. **Check last execution**:
   - Apps Script → "Executions" tab
   - Should see recent run with ✅ or ❌
   - If ❌: Click to see error details

3. **Run manually to test**:
   - Apps Script editor
   - Select `weeklyReportJob` from function dropdown (top)
   - Click "Run" (▶ button)
   - Check logs (should complete in ~15 seconds)
   - Check email inbox (email should arrive within 1 minute)

---

### ❌ Email sent but no content (blank email)

**Cause**: `renderContext` incomplete, or HTML rendering error.

**Solution**:
1. Check Apps Script logs:
   - Apps Script → "Executions" tab → Click latest run
   - Should see `Logger.log()` output
   - Look for "ERROR:" lines

2. Verify Google Sheet has data:
   - Open Google Sheet (from `Constants.js` → `SPREADSHEET_ID`)
   - Check Activity, Sleep, HeartRate tabs have data for this week
   - If empty: Run Python sync first

3. Test with sample data:
   ```javascript
   // In Apps Script editor, paste:
   function testEmail() {
     const renderContext = {
       sleepSri: 78,
       acwrValue: 1.2,
       rhrDelta: -2,
       capacityGrade: 'success',
       // Add more sample values...
     };
     distributeReport(renderContext);
   }
   // Then Run → Check inbox
   ```

---

### ❌ "TypeError: Cannot read property 'forEach' of undefined"

**Cause**: Null/undefined data passed to iteration.

**Solution**:
1. Check input validation:
   - Look at error stack trace in Executions tab
   - File and line number should show where error occurred

2. Add guard clause:
   ```javascript
   if (!data || !Array.isArray(data)) {
     Logger.log('ERROR: data is null or not array');
     return;
   }
   data.forEach(item => { ... });
   ```

3. Redeploy and test:
   ```bash
   cd gas
   clasp push
   # Then test manually
   ```

---

### ❌ "Error: Service invoked too many times for one day"

**Cause**: Google Apps Script quota exceeded (typically 20k calls/day).

**Solution**:
1. Check what's making repeated calls:
   - Executions tab → Sort by "Number of API calls"
   - If one job is very high, there's likely a loop bug

2. Optimize the code:
   - Cache sheet reads (don't re-read same range 100x)
   - Batch API calls where possible

3. Reduce frequency if needed:
   - If running multiple times per day, reduce to once per day

---

### ❌ Email format broken in Outlook/Gmail

**Cause**: CSS or HTML not compatible with email client.

**Solution**:
1. Use inline styles (email-safe):
   - Edit `gas/Reporters.js` → `EMAIL_REPORT_CSS`
   - Avoid CSS classes (not supported in all email clients)

2. Test in browser first:
   - In `Reporters.js`, add: `return buildEmailHTML(...)` to preview HTML
   - Copy HTML to browser, check layout

3. Use email testing tool:
   - Send to [Mailtrap](https://mailtrap.io) or similar
   - Preview in multiple clients

---

## GitHub Actions Issues

### ❌ Workflow fails with "Error: 401 Unauthorized"

**Cause**: Missing or invalid secrets.

**Solution**:
1. Check secrets are set:
   - Go to GitHub → Settings → Secrets and variables → Actions
   - Verify these exist:
     - `GOOGLE_SHEETS_SPREADSHEET_ID`
     - `GOOGLE_CLIENT_SECRET_JSON`
     - `GOOGLE_SERVICE_ACCOUNT_JSON`
     - `GOOGLE_FIT_TOKEN_JSON`

2. Verify secrets are valid:
   - Download from Google Cloud Console
   - Paste full JSON (not just keys)
   - No extra spaces or quotes

3. Redeploy workflow:
   - Go to Actions tab
   - Click "daily-sync" workflow
   - Click "Run workflow" → "Run workflow"

---

### ❌ Workflow runs but sheet is empty

**Cause**: Wrong sheet ID in secret.

**Solution**:
1. Get correct sheet ID:
   ```bash
   # From browser URL:
   # docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
   grep SPREADSHEET_ID sync/config.py
   ```

2. Update secret:
   - GitHub → Settings → Secrets → Edit `GOOGLE_SHEETS_SPREADSHEET_ID`
   - Set to correct ID (just the ID, not full URL)

3. Rerun workflow

---

### ❌ "Error: ENOENT: no such file or directory, open 'token.json'"

**Cause**: Refresh token not in secrets.

**Solution**:
1. Generate token locally:
   ```bash
   python fit_to_sheets.py  # One-time interactive auth
   cat token.json           # Copy entire contents
   ```

2. Add to GitHub secrets:
   - Settings → Secrets → New repository secret
   - Name: `GOOGLE_FIT_TOKEN_JSON`
   - Value: Paste entire JSON from `token.json`

3. Rerun workflow

---

## Clasp / Google Apps Script CLI Issues

### ❌ "Error: Permission denied" when running `clasp login`

**Cause**: No browser or permission issue.

**Solution**:
```bash
# Force reauth
clasp logout
clasp login --no-localhost  # For headless environments
# Then follow browser link manually
```

---

### ❌ "Error: Incorrect project ID" or files won't push

**Cause**: `.clasp.json` corrupted or missing.

**Solution**:
1. Verify `.clasp.json`:
   ```bash
   cd gas
   cat .clasp.json
   # Should show: {"scriptId": "YOUR_PROJECT_ID"}
   ```

2. Regenerate if needed:
   - Get project ID from Apps Script editor (Settings → Project ID)
   - Recreate `.clasp.json`:
     ```bash
     rm .clasp.json
     echo '{"scriptId":"YOUR_PROJECT_ID"}' > .clasp.json
     ```

3. Retry push:
   ```bash
   clasp push --force
   ```

---

## General Debugging

### Enable Verbose Output

**Python**:
```bash
python fit_to_sheets.py --verbose --dry-run
# Shows:
# - Raw data fetched
# - Merge decisions
# - What would be written (without actually writing)
```

**Google Apps Script**:
```javascript
// Add logging
Logger.log('Variable name: ' + JSON.stringify(variable));
// View in Apps Script → Logs panel during execution
```

### Check Logs

**Python (cron)**:
```bash
tail -50 logs/fit_to_sheets.log  # Last 50 lines
tail -f logs/fit_to_sheets.log   # Follow in real-time
```

**Google Apps Script**:
- Apps Script editor → "Executions" tab → Click run
- Or: "Logs" panel (appears during/after execution)

**GitHub Actions**:
- GitHub → Actions tab → Workflow run → Click job → View logs

---

### Isolate the Problem

1. **Is it Python sync?**
   ```bash
   python fit_to_sheets.py --dry-run --verbose
   # If error: Problem is in sync layer
   ```

2. **Is it GAS?**
   ```bash
   cd gas && clasp push && clasp open
   # Manually run weeklyReportJob() in editor
   # Check logs and execution result
   ```

3. **Is it permissions/credentials?**
   ```bash
   # Verify service account has sheet access:
   grep client_email service_account.json
   # Add that email to Google Sheet as Editor
   ```

---

## Getting Help

If you're stuck:

1. **Check the logs**:
   - Python: `tail logs/fit_to_sheets.log`
   - GAS: Executions tab
   - CI/CD: Actions tab

2. **Consult the docs**:
   - [`docs/architecture.md`](./architecture.md) – System design
   - [`docs/deployment.md`](./deployment.md) – Setup & operations
   - [`docs/api-reference.md`](./api-reference.md) – Function reference

3. **Search for similar issues**:
   - GitHub Issues (this repo)
   - Stack Overflow (tag: `google-apps-script`, `gspread`, etc.)

4. **Create minimal reproduction**:
   - Isolate the exact step that fails
   - Provide logs and error messages
   - Share `.gitignore`-d credentials only with maintainer

---

**Last Updated**: 8 November 2025
