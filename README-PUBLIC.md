# Health Coach: Weekly Performance Report System

An AI-powered Google Sheets integration that generates personalized weekly health and performance reports using data from fitness trackers, sleep monitors, and training logs.

## Features

- **Automated Weekly Reports** - Generated every Sunday with personalized insights
- **AI-Powered Analysis** - GPT-4 analysis of performance trends, constraints, and actionable recommendations
- **Multi-Source Data Integration** - Consolidates data from Google Sheets, Mi Fit API, and manual input
- **Dual-Length Summaries** - Punchy 2-sentence header + detailed context for deep dives
- **Constraint-Based Logic** - Data-driven decision system based on readiness, output, and balance metrics
- **Australian Coaching Voice** - Direct, no-nonsense guidance tailored to elite performance standards

## Architecture

```
Google Sheets (Data Hub)
    ↓
Apps Script (Main Job Pipeline)
    ├→ Data Sync (Python)
    ├→ Score Calculation (Readiness, Output, Balance)
    ├→ Driver Analysis (strengths, limiters, trends)
    ├→ AI Prompt Generation (GPT-4)
    └→ Report Rendering & Email Send
```

## Components

### `01-CORE/gas/` - Google Apps Script (JavaScript)
- **Main.js** - Core job pipeline and report generation
- **Data.js** - Data loading and transformation
- **Builders.js** - Report section builders (summary, activity, recovery, etc.)
- **Scoring.js** - Score calculations (readiness, output, balance)
- **OpenAI.js** - GPT-4 integration
- **Formatters.js** - HTML/text formatting utilities

### `01-CORE/sync/` - Python Data Sync
- **fit_to_sheets.py** - Weekly sync of fitness data to Google Sheets
- **sheets.py** - Google Sheets API client
- **config.py** - Configuration management

### `01-CORE/ui/` - Frontend Components
- Adapters for metric visualization
- Narrative text rendering
- Validation utilities

### `02-DOCS/` - Documentation
- Architecture overview
- API reference
- Deployment guide
- Decision log

### `03-TESTS/` - Test Suite
- Unit tests for sync logic
- Integration tests for report generation

## Setup

### Prerequisites
- Google Cloud Project with Sheets API enabled
- Google Apps Script enabled
- Python 3.8+
- OpenAI API key

### Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/conorbliss-hash/health-coach.git
   cd health-coach
   ```

2. **Set up credentials**
   - Download your Google Sheets API credentials → `client_secret.json`
   - Get service account key → `service_account.json`
   - Place in root directory (in `.gitignore` for safety)

3. **Install Python dependencies**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Set up Apps Script**
   ```bash
   cd gas
   npm install
   npx @google/clasp login
   npx @google/clasp create --type sheets --title "Health Coach"
   npx @google/clasp push
   ```

5. **Configure environment**
   - Create `.env` file with your OpenAI API key
   - Update spreadsheet ID in config

6. **Deploy**
   - Run `weeklyReportJob()` from Apps Script editor
   - Or set up Cloud Scheduler for automatic weekly runs

See [RUN.md](RUN.md) for detailed deployment steps.

## How It Works

### Weekly Report Pipeline

1. **Data Sync** - Pull latest metrics from Google Sheets
2. **Score Calculation** - Compute readiness, output, and balance scores
3. **Driver Analysis** - Identify score drivers (strengths, limiters, trends)
4. **Constraint Logic** - Determine action constraints based on thresholds
5. **AI Generation** - Generate 2-sentence header + detailed analysis with GPT-4
6. **Report Rendering** - Build multi-section HTML report
7. **Email Send** - Deliver via Gmail

### Scoring System

- **Output (40%)** - Training load fulfillment + steps + work hours
- **Readiness (40%)** - Sleep volume + consistency + HRV (RHR proxy) + ACWR
- **Balance** - Readiness − Output (negative = output outpacing recovery)

### Constraint Thresholds

- **Critical** (<65% readiness) - Urgent recovery priority
- **Warning** (65-75% readiness) - Be cautious, reduce/maintain only
- **Solid** (75-85% readiness) - Safe to maintain or slightly increase
- **Strong** (≥85% readiness) - Full capacity available

## Example Output

**Header (2 sentences):**
> Output strong, readiness solid↑ on good sleep. Maintain load and lock sleep ±30min.

**Detailed Analysis (3 sentences):**
> Your output's sitting high this week driven by strong gym work. Readiness is solid and improving on good sleep volume, but you're bleeding points to sleep inconsistency—body can't recover quite as fast as you're outputting. Maintain this load while locking bedtime ±30min; that's the recovery lever.

## Contributing

Contributions welcome! Areas for enhancement:
- Additional data source integrations (Garmin, Whoop, Oura)
- Advanced forecasting (7-day readiness projection)
- Mobile app integration
- Multi-athlete support
- Export to other platforms

## Documentation

- [Architecture](02-DOCS/architecture.md) - System design and data flow
- [API Reference](02-DOCS/api-reference.md) - Apps Script and Python API docs
- [Deployment Guide](02-DOCS/deployment.md) - Detailed setup instructions
- [Troubleshooting](02-DOCS/troubleshooting.md) - Common issues and fixes

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Conor Bliss - Performance Coach & Software Engineer

---

**Questions or Issues?** Check [Troubleshooting](02-DOCS/troubleshooting.md) or open an issue on GitHub.
