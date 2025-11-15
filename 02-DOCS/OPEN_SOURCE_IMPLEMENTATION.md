# Open Source Implementation Guide: Dual-Repo Strategy

**Author:** Conor Bliss  
**Date:** 9 November 2025  
**Objective:** Share Health_Coach publicly while maintaining a private development version for experiments, prompts, and iterations.

---

## 📋 Overview

This guide establishes a **dual-repository strategy** to achieve:
- ✅ Public, well-maintained shared version
- ✅ Private, experimental development version
- ✅ Minimal moderator overhead (you control everything)
- ✅ Clear separation of concerns

### Repository Structure

```
YOUR MACHINE (Private)
├── ~/projects/Health_Coach-local/          ← Your working repo
│   ├── gas/Prompts.js (experimental)
│   ├── gas/OpenAI.js (with live API keys)
│   ├── token.json, client_secret.json
│   ├── All test data
│   └── Messy git history (for you only)
│
└── (NOT on GitHub)

GITHUB (Public)
├── github.com/conorbliss-hash/Health_Coach/
│   ├── gas/Main.js (stable)
│   ├── sync/ (production-ready)
│   ├── docs/ (polished)
│   ├── client_secret.json.example (template only)
│   └── Clean commit history
│
└── Open to community (but you're not moderating)
```

---

## 🔧 Phase 1: Set Up Private Local Repo (One-Time)

### Step 1.1: Create Private Directory Structure

```bash
# Create local directory for private work
mkdir -p ~/projects/Health_Coach-local
cd ~/projects/Health_Coach-local

# Initialize git (local only, NOT pushing to GitHub)
git init
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Copy all current work here
cp -r /Users/conorbliss/Desktop/4.\ HT/01-CORE/* .
```

### Step 1.2: Create `.gitignore` for Private Repo

```bash
# Create .gitignore
cat > .gitignore << 'EOF'
# Python / environment
.venv/
__pycache__/
*.pyc
*.egg-info/

# Secrets & credentials (KEEP PRIVATE)
.env
.env.local
client_secret.json
service_account.json
token.json
*.pem
*.key

# Generated data exports
exports/
logs/
*.log

# Editor settings
.vscode/
.idea/
*.swp
*.swo

# Node
node_modules/
gas/node_modules/
gas/.clasp.json
gas/.clasp.json.backup
gas/.credentials.json
gas/dist/
gas/build/

# OS
.DS_Store
Thumbs.db

# Test artifacts
.pytest_cache/
.coverage
htmlcov/

# Experimental branches (don't track)
experimental/
drafts/
archive/
EOF

git add .gitignore
git commit -m "Initial commit: set up private local repo"
```

### Step 1.3: Organize Private Development

Create folders for your experimental work:

```bash
# Create structure for private experiments
mkdir -p experimental/{prompts,openai,test-data}
mkdir -p drafts
mkdir -p archive

# Create a .gitkeep to track these folders
touch experimental/.gitkeep
touch drafts/.gitkeep

git add experimental/ drafts/ archive/
git commit -m "Add experimental folders"
```

### Step 1.4: Move Sensitive Files

```bash
# Move actual credentials to private repo only
# (Already in .gitignore, so they won't be tracked)

# Create examples for public sharing
cat > client_secret.json.example << 'EOF'
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "project_id": "YOUR_PROJECT_ID",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost"]
  }
}
EOF

cat > service_account.json.example << 'EOF'
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "YOUR_PRIVATE_KEY",
  "client_email": "YOUR_SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
EOF

cat > .env.example << 'EOF'
# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=your-sheet-id-here

# Google Cloud
GOOGLE_CLIENT_SECRET_JSON=path/to/client_secret.json
GOOGLE_SERVICE_ACCOUNT_JSON=path/to/service_account.json

# App Config
COACH_EMAIL=coach@example.com
TIMEZONE=Europe/Stockholm

# OpenAI (optional)
OPENAI_API_KEY=your-api-key-here
EOF

git add *.example .env.example
git commit -m "Add credential examples for public sharing"
```

---

## 🚀 Phase 2: Create Public GitHub Repository

### Step 2.1: Create GitHub Repo

1. Go to **GitHub.com**
2. Click **+** → **New repository**
3. Name: `Health_Coach`
4. Description: `AI-powered health coaching system: syncs Google Fit data to Sheets, generates weekly coaching reports`
5. Visibility: **Public**
6. Initialize: **No** (we'll push existing code)
7. Click **Create repository**

**Note:** Copy the HTTPS URL: `https://github.com/conorbliss-hash/Health_Coach.git`

### Step 2.2: Create Public Directory (Clean Version)

```bash
# Create separate directory for public sharing
mkdir -p ~/projects/Health_Coach-public
cd ~/projects/Health_Coach-public

# Initialize fresh git repo
git init
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Add GitHub remote
git remote add origin https://github.com/conorbliss-hash/Health_Coach.git
```

### Step 2.3: Prepare Clean Code for Public

Copy only production-ready code, excluding sensitive data:

```bash
# Copy core modules (no sensitive data)
cp -r ~/projects/Health_Coach-local/gas .
cp -r ~/projects/Health_Coach-local/sync .
cp -r ~/projects/Health_Coach-local/ui .
cp -r ~/projects/Health_Coach-local/tests .

# Copy documentation
cp -r ~/projects/Health_Coach-local/docs .

# Copy config files
cp ~/projects/Health_Coach-local/requirements.txt .
cp ~/projects/Health_Coach-local/package.json .
cp ~/projects/Health_Coach-local/package-lock.json .
cp ~/projects/Health_Coach-local/README.md .

# Copy examples (NOT real credentials)
cp ~/projects/Health_Coach-local/client_secret.json.example .
cp ~/projects/Health_Coach-local/service_account.json.example .
cp ~/projects/Health_Coach-local/.env.example .

# DO NOT copy: token.json, client_secret.json, service_account.json
```

### Step 2.4: Create Public `.gitignore`

```bash
cat > .gitignore << 'EOF'
# Python / environment
.venv/
__pycache__/
*.pyc
*.egg-info/

# Secrets & credentials
.env
.env.local
client_secret.json
service_account.json
token.json
*.pem
*.key

# Generated data
exports/
logs/
*.log

# Editor settings
.vscode/
.idea/
*.swp
*.swo

# Node
node_modules/
gas/.clasp.json
gas/.clasp.json.backup
gas/.credentials.json

# OS
.DS_Store
Thumbs.db

# Test artifacts
.pytest_cache/
.coverage
htmlcov/
EOF

git add .gitignore
git commit -m "Initial commit: clean public version of Health_Coach"
```

---

## 📄 Phase 3: Create Essential Public Documentation

### Step 3.1: Create `LICENSE`

```bash
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 Conor Bliss

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

git add LICENSE
git commit -m "Add MIT license"
```

### Step 3.2: Create `CODE_OF_CONDUCT.md`

```bash
cat > CODE_OF_CONDUCT.md << 'EOF'
# Code of Conduct

## Our Pledge

We are committed to providing a welcoming and inspiring community for all. We pledge that everyone participating in this project will treat others with respect and consideration.

## Our Standards

Examples of behavior that contributes to creating a positive environment include:

* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior include:

* Harassment or discrimination of any kind
* Trolling, insulting/derogatory comments
* Public or private attacks
* Publishing others' private information without permission

## Enforcement

Instances of unacceptable behavior should be reported to the project maintainer. The maintainer will review and decide appropriate actions.

---

**Note:** This is a small hobby project. If issues arise, we'll address them respectfully.

EOF

git add CODE_OF_CONDUCT.md
git commit -m "Add code of conduct"
```

### Step 3.3: Create `SECURITY.md`

```bash
cat > SECURITY.md << 'EOF'
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email **conor@example.com** instead of using the issue tracker.

Please provide:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We take security seriously and will respond promptly.

## Security Best Practices for Users

When using Health_Coach:

1. **Keep credentials secure:**
   - Never commit `client_secret.json`, `service_account.json`, or `token.json`
   - Use `.env` files for local development only
   - Use GitHub Secrets for CI/CD deployments

2. **Rotate credentials periodically:**
   - Service account keys: annually
   - OAuth tokens: auto-managed by the library

3. **Use least privilege:**
   - Grant service account only necessary sheet permissions
   - Use read-only access where possible

4. **Monitor execution:**
   - Review Apps Script execution logs regularly
   - Check GitHub Actions logs for sync errors

---

**Maintainer:** Conor Bliss

EOF

git add SECURITY.md
git commit -m "Add security policy"
```

### Step 3.4: Create `CONTRIBUTING.md`

```bash
cat > CONTRIBUTING.md << 'EOF'
# Contributing to Health_Coach

Thanks for your interest! This is a hobby project maintained part-time.

## Philosophy

- **Scope:** This project focuses on Google Fit → Sheets → Email coaching reports
- **Stability:** New features are evaluated carefully before merging
- **Maintenance:** Contributions are welcome, but the project is not actively seeking new maintainers

## Before You Start

**This project is NOT actively seeking contributions.** It's open source to share the work, not to build a community project.

That said, if you have ideas:

1. **Check existing issues** – your idea might already be discussed
2. **Open an issue first** – describe what you'd like to do
3. **Wait for feedback** – I'll let you know if it fits the project scope
4. **Start small** – bug fixes > new features

## How to Contribute

### Reporting Bugs

1. Use the issue template
2. Include:
   - What you expected
   - What actually happened
   - Steps to reproduce
   - Your environment (OS, Python version, etc.)

### Suggesting Features

1. Open an issue with `[FEATURE REQUEST]` in the title
2. Describe the use case
3. Note: New features may not be accepted if outside project scope

### Submitting Code

1. Fork the repository
2. Create a branch: `git checkout -b fix/your-fix`
3. Make changes with clear commit messages
4. Run tests: `pytest`
5. Submit a pull request
6. Wait for review (may take time, this is a hobby project)

## Development Setup

See `docs/deployment.md` for local setup.

## Code Style

- **Python:** PEP 8 (use `black` for formatting)
- **JavaScript (GAS):** 4-space indent, clear variable names
- **Comments:** Prefer self-documenting code; add comments for "why", not "what"

## Testing

```bash
# Python tests
pytest tests/ -v

# UI tests
npm test
```

All tests must pass before submitting a PR.

## License

By contributing, you agree your code is licensed under the MIT License.

---

**Note:** I reserve the right to close issues/PRs that don't align with the project vision. This is not personal—just project scoping.

EOF

git add CONTRIBUTING.md
git commit -m "Add contributing guidelines"
```

### Step 3.5: Create `SUPPORT.md`

```bash
cat > SUPPORT.md << 'EOF'
# Support

## Getting Help

### Documentation

Start with:
- [`README.md`](README.md) – Quick start
- [`docs/deployment.md`](docs/deployment.md) – Setup instructions
- [`docs/troubleshooting.md`](docs/troubleshooting.md) – Common issues
- [`docs/architecture.md`](docs/architecture.md) – How it works

### Issues

For bugs, open a GitHub issue with:
- Description
- Steps to reproduce
- Error messages
- Your environment (Python version, OS, etc.)

### Discussions

Use GitHub Discussions for:
- General questions
- Design feedback
- Share how you're using Health_Coach

### Response Time

**Expectation:** This is a hobby project. Responses may take weeks or longer. No guarantees.

---

## Troubleshooting

See [`docs/troubleshooting.md`](docs/troubleshooting.md) for solutions to common problems.

EOF

git add SUPPORT.md
git commit -m "Add support guide"
```

---

## 📊 Phase 4: Prepare Public Documentation Updates

### Step 4.1: Update `README.md`

Replace the current README with a public-friendly version. Remove personal info and add badges:

```bash
cat > README.md << 'EOF'
# Health_Coach

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

**AI-powered Health Coach**: Syncs health data from Google Fit to Google Sheets, generates weekly coaching reports via email.

---

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 14+
- Google account (Fit, Sheets, Gmail)
- Google Cloud project

### Installation

```bash
git clone https://github.com/conorbliss-hash/Health_Coach.git
cd Health_Coach

# Install Python dependencies
pip install -r requirements.txt

# Install Node dependencies
npm install --no-fund
```

### Setup

See [`docs/deployment.md`](docs/deployment.md) for detailed setup instructions.

**Quick overview:**
1. Create Google Cloud credentials (OAuth & service account)
2. Create Google Sheet with Activity, Sleep, HeartRate tabs
3. Configure `sync/config.py`
4. Test sync: `python fit_to_sheets.py --dry-run`
5. Deploy weekly job to Google Apps Script

### Usage

```bash
# Sync Google Fit data to Sheets (daily)
python fit_to_sheets.py

# Dry-run (preview without writing)
python fit_to_sheets.py --dry-run --verbose
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [`docs/architecture.md`](docs/architecture.md) | System design and data flow |
| [`docs/deployment.md`](docs/deployment.md) | Setup and configuration |
| [`docs/api-reference.md`](docs/api-reference.md) | Function reference |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Common issues and solutions |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute |
| [`SUPPORT.md`](SUPPORT.md) | Getting help |

---

## 🔍 What It Does

```
Google Fit Data → Python Sync → Google Sheets
                                     ↓
                            Weekly Job (GAS)
                            Compute insights
                            Build HTML email
                                     ↓
                            Coach receives report
                            (Activity, sleep, HR, guidance)
```

---

## 🛠️ Technology Stack

- **Backend:** Python (sync layer)
- **Orchestration:** Google Apps Script (weekly jobs)
- **Data:** Google Sheets (central hub)
- **APIs:** Google Fit, Google Sheets, Gmail
- **Frontend:** Google Sheets UI + HTML emails

---

## 📋 Features

✅ Automatic health data sync (daily)  
✅ Weekly coaching reports (email)  
✅ Derived metrics (ACWR, SRI, HR trends)  
✅ Manual data entry support (Sheets)  
✅ Customizable thresholds  
✅ Time-zone aware  

---

## 📖 Next Steps

1. **Understand the architecture:** [`docs/architecture.md`](docs/architecture.md)
2. **Set up locally:** [`docs/deployment.md`](docs/deployment.md)
3. **Hit an issue?** [`docs/troubleshooting.md`](docs/troubleshooting.md)
4. **Want to contribute?** [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## ⚠️ Important Notes

- This is a **personal project** maintained part-time
- No guarantees on response time for issues/PRs
- See [`SUPPORT.md`](SUPPORT.md) for expectations

---

## 📄 License

MIT License – See [`LICENSE`](LICENSE) for details.

**Copyright © 2025 Conor Bliss**

---

**Questions?** See [`SUPPORT.md`](SUPPORT.md) or open an issue.

EOF

git add README.md
git commit -m "Update README for public release"
```

### Step 4.2: Update `docs/deployment.md`

Remove personal spreadsheet IDs and email addresses. Replace with placeholders.

---

## 🔄 Phase 5: Push to GitHub

### Step 5.1: Initial Push

```bash
cd ~/projects/Health_Coach-public

# Add all files
git add -A
git commit -m "Initial public release"

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 5.2: Create Initial Release Tag

```bash
git tag v1.0.0 -m "Initial public release"
git push origin v1.0.0
```

Go to GitHub → Releases → Add release notes.

---

## 🔁 Phase 6: Ongoing Sync Strategy

### 6.1: Directory Layout on Your Machine

```
~/projects/
├── Health_Coach-local/          ← Private, experimental
│   ├── .git/ (local only, no GitHub)
│   ├── gas/Prompts.js (experimental)
│   ├── gas/OpenAI.js (with API keys)
│   ├── experimental/
│   └── token.json (never shared)
│
└── Health_Coach-public/         ← Public, shared on GitHub
    ├── .git/ (pushed to GitHub)
    ├── gas/Main.js (stable)
    ├── sync/ (production-ready)
    └── docs/ (public)
```

### 6.2: Regular Sync Workflow

When you have a **stable feature** to share:

```bash
# 1. Work in private repo
cd ~/projects/Health_Coach-local
# ... make changes, test, iterate ...
git add .
git commit -m "Add experimental feature"

# 2. When ready to share, prepare clean version
cd ~/projects/Health_Coach-public
# ... manually copy cleaned-up code ...
cp ~/projects/Health_Coach-local/gas/Main.js ./gas/
cp ~/projects/Health_Coach-local/sync/*.py ./sync/

# 3. Commit and push to GitHub
git add .
git commit -m "Update: add feature X"
git push origin main

# 4. (Optional) Tag a release
git tag v1.1.0
git push origin v1.1.0
```

### 6.3: Frequency

Suggested sync frequency:
- **Weekly:** Small bug fixes, patches → push immediately
- **Monthly:** Accumulate features → tag release
- **As-needed:** Breaking changes → communicate in release notes

**No pressure.** This is a hobby project. Sync whenever it feels right.

---

## 🎯 Phase 7: Handle GitHub Activity (Low-Effort)

### Issue/PR Strategy

**When someone opens an issue:**

1. **Quick read:** Is it a real bug or a question?
   - Bug? Label `bug` and review when you have time
   - Question? Link to docs or close with "see SUPPORT.md"

2. **Your options:**
   - **Fix it** (if you agree it's a bug)
   - **Ignore it** (if it's outside scope)
   - **Close with explanation** (if it's not a fit)

3. **No obligation to be fast.** Weeks are fine.

### PR Strategy

**When someone submits a pull request:**

1. **Review the code** – does it align with your vision?
2. **Merge or politely decline** – "Thanks, but we're not accepting feature X"
3. **No guilt about rejecting PRs** – it's your project

### Labels to Use

- `bug` – Real bug
- `wontfix` – Not fixing (out of scope)
- `documentation` – Doc improvements
- `good first issue` – Easy for newcomers

---

## ✅ Final Checklist

- [ ] Private repo set up locally (`Health_Coach-local/`)
- [ ] Public repo created on GitHub (`Health_Coach-public/`)
- [ ] All sensitive files in `.gitignore` (both repos)
- [ ] Example credential files created (`.example` versions)
- [ ] LICENSE added to public repo
- [ ] CODE_OF_CONDUCT.md created
- [ ] SECURITY.md created
- [ ] CONTRIBUTING.md created
- [ ] SUPPORT.md created
- [ ] README.md updated (no personal info)
- [ ] docs/deployment.md cleaned (no personal IDs)
- [ ] First commit pushed to GitHub
- [ ] v1.0.0 tag created
- [ ] GitHub releases page has v1.0.0
- [ ] Test: Clone public repo, follow setup – does it work?

---

## 🚀 You're Done!

You now have:
- ✅ **Private local version** – for experiments, prompts, API keys
- ✅ **Public GitHub version** – stable, documented, shareable
- ✅ **Clear sync workflow** – cherry-pick stable features
- ✅ **Low moderator burden** – you're in control, no guilt

Enjoy sharing your work! 🎉

---

## 📞 Quick Reference

```bash
# Work on private experiments
cd ~/projects/Health_Coach-local
# ... iterate freely ...

# Prepare for public release
cd ~/projects/Health_Coach-public
cp ~/projects/Health_Coach-local/gas/Main.js ./gas/
# ... remove any sensitive data ...

# Push to GitHub
git add .
git commit -m "Feature: ..."
git push origin main

# Tag release (optional)
git tag v1.1.0
git push origin v1.1.0
```

---

**Questions?** Refer back to the phase that covers your use case.
