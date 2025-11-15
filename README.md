# Health_Coach

**AI-powered Health Coach**: Syncs health data from Google Fit to Google Sheets, generates weekly coaching reports via email.

---

## 🚀 Quick Start

### First Time?

1. **Read the docs** (5 min):
   - [`docs/architecture.md`](./docs/architecture.md) – System overview
   - [`docs/deployment.md`](./docs/deployment.md) – Setup & deploy

2. **Run a sync** (2 min):
   ```bash
   pip install -r requirements.txt
   python fit_to_sheets.py --dry-run --verbose
   ```

3. **Deploy to production**:
   - Python: Set up cron job or GitHub Actions
   - Google Apps Script: `cd gas && clasp push`

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [`docs/architecture.md`](./docs/architecture.md) | System design, data flow, module responsibilities |
| [`docs/decisions.md`](./docs/decisions.md) | Engineering decisions & rationale |
| [`docs/deployment.md`](./docs/deployment.md) | Setup, configuration, operations |
| [`docs/api-reference.md`](./docs/api-reference.md) | Function reference & schemas |
| [`docs/troubleshooting.md`](./docs/troubleshooting.md) | Common issues & solutions |

---

## 🔍 What It Does

```
Google Fit Data
    ↓
[Python Sync] → Google Sheets (Activity, Sleep, Heart Rate tabs)
    ↓
[Weekly Job] → Compute insights (ACWR, SRI, HR delta, fulfillment %)
    ↓
[Report Generator] → Build HTML email with coaching guidance
    ↓
Coach's Inbox → Read weekly coaching email
```

---

## 📋 Commands

**Python Sync**:
```bash
python fit_to_sheets.py              # Standard run
python fit_to_sheets.py --dry-run    # Preview (no writes)
python fit_to_sheets.py --verbose    # Debug output
```

**Google Apps Script**:
```bash
cd gas
clasp push                           # Deploy code
clasp open                           # View in editor
```

**Testing**:
```bash
pytest                               # Python tests
npm test                             # UI tests
```

---

## 🛠️ Troubleshooting

- **Sync fails?** → Check [`docs/troubleshooting.md`](./docs/troubleshooting.md)
- **Email not sending?** → See deployment guide (GAS triggers)
- **Permission errors?** → Verify service account access to Google Sheet

---

## 📂 Project Structure

```
Health_Coach/
├── README.md                 ← You are here
├── docs/                     ← 📚 Live documentation
│   ├── architecture.md       ← Start here
│   ├── decisions.md
│   ├── deployment.md
│   ├── api-reference.md
│   └── troubleshooting.md
├── .workbench/               ← 🔨 Historical phase logs (archived)
├── gas/                      ← ✨ Google Apps Script (8 modules)
├── sync/                     ← 🔄 Python sync layer
├── ui/                       ← 🎨 UI components
└── tests/                    ← ✅ Tests
```

---

## ⚡ One-Minute Deployment

**Local cron sync** (daily 05:00):
```bash
crontab -e
# Add: 0 5 * * * cd /path/to/Health_Coach && python fit_to_sheets.py >> logs/fit_to_sheets.log 2>&1
```

**GitHub Actions** (daily 04:00 UTC):
- Add repository secrets (see [`docs/deployment.md`](./docs/deployment.md))
- Workflow at `.github/workflows/daily-sync.yml` runs automatically

**Weekly report job** (GAS):
- Deploy: `cd gas && clasp push`
- Set trigger: Apps Script → Triggers → `weeklyReportJob` at "Thursday 05:00"

---

## 📖 Next Steps

- **Understand the system?** → [`docs/architecture.md`](./docs/architecture.md)
- **Need to deploy?** → [`docs/deployment.md`](./docs/deployment.md)
- **Debugging an issue?** → [`docs/troubleshooting.md`](./docs/troubleshooting.md)
- **Want function reference?** → [`docs/api-reference.md`](./docs/api-reference.md)

---

**Status**: ✅ Production  
**Last Updated**: 8 November 2025
