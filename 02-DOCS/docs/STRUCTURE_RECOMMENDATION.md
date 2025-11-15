# Project Structure Recommendation
**Date**: 8 November 2025  
**Status**: Best-Practice Analysis for Health_Coach Repository

---

## Executive Summary

Your current file structure is **flat and scattered**, making it hard to:
- Understand project phases and their relationships
- Distinguish between "live" documentation vs. "workbench" task logs
- Navigate to the right reference quickly
- Onboard new team members

This document proposes a **hierarchical, intent-based structure** that separates:
1. **Live documentation** (README, architecture, API reference)
2. **Decision & context logs** (why things work the way they do)
3. **Workbench tasks** (Phase 1-4 checkpoints, refactor logs, debugging notes)
4. **Build artifacts** (generated docs, credentials, caches—keep out of repo)

---

## Current State Analysis

### 📊 File Count Breakdown

| Category | Count | Examples | Problem |
|----------|-------|----------|---------|
| **Live Docs** | 1 | `README.md` | Buried in root; needs more navigation |
| **Decision Logs** | 2 | `context.md`, `decisions.md` | Not discoverable; unclear relationship to code |
| **Workbench/Task Logs** | 15+ | `PHASE2_COMPLETE.md`, `QUICK_WINS.md`, `REFACTOR_DEBUGGING_SUMMARY.md`, etc. | Clutters root; historical artifacts; mixed with live docs |
| **Credentials & Config** | 5 | `.env`, `client_secret.json`, `service_account.json`, etc. | Should NOT be in Git (ignored, but visible) |
| **Build Artifacts** | 4+ | `__pycache__/`, `.pytest_cache/`, `.ruff_cache__/`, `.vscode/` | Noise; should be in `.gitignore` only |
| **Source Code** | 4 directories | `gas/`, `sync/`, `ui/`, `tests/` | Good separation; works well |

### 🔴 Key Problems

1. **15 markdown files in root directory** → Cognitive overload
   - Can't tell which are current vs. historical
   - No clear hierarchy or dependency
   - Onboarding nightmare

2. **Decision logs buried with task logs**
   - `context.md` and `decisions.md` are valuable but invisible
   - Mixed with Phase 2 refactor checkpoints
   - No clear link back to `README.md`

3. **No "getting started" path**
   - New developer doesn't know: "where do I read first?"
   - Options should be: README → docs/architecture → docs/decisions → code

4. **Workbench artifacts pollute the root**
   - `PHASE2_COMPLETE.md`, `QUICK_WINS.md`, `REFACTOR_PLAN_DETAILED.md`
   - These are useful **during** refactoring but not for ongoing maintenance
   - Should be archived or moved to historical folder

---

## Recommended Structure

```
Health_Coach/
├── README.md                          # 🎯 START HERE – Project overview, quick-start
├── CONTRIBUTING.md                    # (Optional) Contribution guidelines
│
├── docs/                              # 📚 LIVE DOCUMENTATION
│   ├── architecture.md                # System design, module relationships
│   ├── decisions.md                   # Engineering decisions & rationale
│   ├── api-reference.md               # GAS functions, Python modules, endpoints
│   ├── deployment.md                  # How to deploy, configure, run
│   ├── troubleshooting.md             # Common issues & solutions
│   └── decisions/                     # (Optional) Decision log archive
│       ├── 001-use-rendercontext-pattern.md
│       ├── 002-nullish-coalesce-standardization.md
│       └── ...
│
├── .workbench/                        # 🔨 WORKBENCH – Ephemeral task logs
│   ├── refactor-phase-2/              # Phase 2 refactor checkpoint (done)
│   │   ├── PHASE2_COMPLETE.md
│   │   ├── PHASE2_IMPROVEMENTS_COMPLETE.md
│   │   ├── CODE_QUALITY_REVIEW_PHASE2.md
│   │   ├── QUICK_WINS.md
│   │   └── ...
│   ├── refactor-phase-1/              # Phase 1 refactor checkpoint (done)
│   │   ├── REFACTOR_PHASE1_SUMMARY.md
│   │   ├── REFACTOR_PHASE1_COMPLETE.md
│   │   └── ...
│   └── debugging/                     # Debugging sessions, experimental notes
│       ├── REFACTOR_DEBUGGING_SUMMARY.md
│       └── ...
│
├── gas/                               # ✨ SOURCE CODE – Google Apps Script
│   ├── Main.js
│   ├── Constants.js
│   ├── Builders.js
│   ├── Reporters.js
│   ├── ... (8 modules total)
│   └── appsscript.json
│
├── sync/                              # 🔄 SOURCE CODE – Python sync utility
│   ├── __init__.py
│   ├── config.py
│   ├── sheets.py
│   └── ...
│
├── ui/                                # 🎨 SOURCE CODE – UI components
│   └── ...
│
├── tests/                             # ✅ Tests
│   └── ...
│
├── config/                            # ⚙️ Configuration (non-secret)
│   └── ui.js
│
└── .gitignore                         # Already ignores secrets, caches, etc.
```

---

## What to Move Where

### ✅ Keep in Root

| File | Reason |
|------|--------|
| `README.md` | **FIRST** thing users/devs read |
| `CONTRIBUTING.md` | If you want contribution guidelines |
| `.gitignore` | Git needs it at root |
| `package.json`, `requirements.txt` | Dependency manifests; must be discoverable |

### 📚 Move to `docs/`

| Current File | Move To | Reason |
|--------------|---------|--------|
| `context.md` | `docs/architecture.md` (merge into it) | Explains system design & prior work |
| `decisions.md` | `docs/decisions.md` | Living record of engineering choices |
| — | `docs/deployment.md` (new) | Extract deployment info from README |
| — | `docs/api-reference.md` (new) | Extract API info from README |
| `NEW_HELPERS_REFERENCE.md` | `docs/api-reference.md` | Helper function documentation |
| `HS_project.md` | `docs/` (rename to `scope.md` or `project-scope.md`) | Project scope & requirements |

### 🔨 Move to `.workbench/`

| Current File | Move To | Reason |
|--------------|---------|--------|
| `PHASE2_COMPLETE.md` | `.workbench/refactor-phase-2/` | Phase 2 checkpoint (historical) |
| `PHASE2_IMPROVEMENTS_COMPLETE.md` | `.workbench/refactor-phase-2/` | Phase 2 checkpoint (historical) |
| `CODE_QUALITY_REVIEW_PHASE2.md` | `.workbench/refactor-phase-2/` | Phase 2 review (historical) |
| `QUICK_WINS.md` | `.workbench/refactor-phase-2/` | Phase 2 task log (historical) |
| `IMPROVEMENTS_APPLIED.md` | `.workbench/refactor-phase-2/` | Phase 2 task log (historical) |
| `CODE_REVIEW_APPLIED.md` | `.workbench/refactor-phase-2/` | Phase 2 task log (historical) |
| `CODE_REVIEW_PHASE2.md` | `.workbench/refactor-phase-2/` | Phase 2 task log (historical) |
| `SUGGESTED_IMPROVEMENTS.md` | `.workbench/refactor-phase-2/` | Phase 2 task log (historical) |
| `REFACTOR_PHASE1_SUMMARY.md` | `.workbench/refactor-phase-1/` | Phase 1 checkpoint (historical) |
| `REFACTOR_PHASE1_COMPLETE.md` | `.workbench/refactor-phase-1/` | Phase 1 checkpoint (historical) |
| `REFACTOR_PLAN_DETAILED.md` | `.workbench/refactor-phase-1/` | Phase 1 plan (historical) |
| `REFACTOR_PHASE2_PLAN.md` | `.workbench/refactor-phase-2/` | Phase 2 plan (historical) |
| `REFACTOR_DEBUGGING_SUMMARY.md` | `.workbench/debugging/` | Debugging session notes |
| `STATUS.md` | `.workbench/refactor-phase-2/STATUS_FINAL.md` | Final status (historical) |
| `COMPLETION_CHECKLIST.md` | `.workbench/refactor-phase-2/` | Phase 2 checklist (historical) |
| `FINAL_REFACTOR_STATUS.md` | `.workbench/refactor-phase-2/` | Final refactor status (historical) |
| `REVIEW_SUMMARY.txt` | `.workbench/refactor-phase-2/` | Review summary (historical) |

### ❌ Don't Commit (Already in `.gitignore`)

| File/Folder | Reason |
|-------------|--------|
| `.env`, `client_secret.json`, `service_account.json`, `token.json` | **Secrets** – never commit |
| `__pycache__/`, `.pytest_cache/`, `.ruff_cache__/` | **Build artifacts** – regenerated each run |
| `.vscode/` | **IDE config** – personal preference |
| `.DS_Store` | **macOS metadata** – OS-specific |

---

## Best-Practice Principles

### 1. **Intent-Based Hierarchy**
- **Docs/** = "What should I know?"
- **Source/** = "How does it work?" (gas/, sync/, ui/, tests/)
- **.workbench/** = "What happened during development?" (archived logs)

### 2. **Discoverability**
- New developer path: `README.md` → `docs/architecture.md` → `docs/decisions.md` → code
- Each doc links to the next

### 3. **Separation of Concerns**
- **Live documentation**: Updated when code changes
- **Workbench logs**: Timestamped, historical, never updated
- **Source code**: The single source of truth

### 4. **Scalability**
- As project grows, each folder stays manageable
- Easy to add new modules, new phases, new decisions
- No root-level clutter

### 5. **Maintenance Burden**
- **Live docs** should be thin (links to code/decision logs)
- **Workbench logs** are immutable archives (easier to manage)
- **Code** is the source of truth

---

## Implementation Plan

### Phase 1: Create Folder Structure (5 min)

```bash
cd /Users/conorbliss/Desktop/4.\ HT
mkdir -p docs/.workbench/refactor-phase-{1,2} .workbench/debugging
```

### Phase 2: Update `.gitignore` (2 min)

Add `.workbench/` to `.gitignore` so it's tracked locally but not committed:

```gitignore
# .gitignore additions
.workbench/          # Local development workbench; not committed
```

**OR** (if you want to keep historical logs in Git):

Remove `.workbench/` from `.gitignore` and commit phase logs as immutable records. Trade-off: repo history gets bigger, but you have a record of all decisions made.

### Phase 3: Move Files (10 min)

```bash
# Move workbench logs (phase 2)
mv PHASE2_*.md CODE_*.md QUICK_WINS.md IMPROVEMENTS_APPLIED.md .workbench/refactor-phase-2/
mv SUGGESTED_IMPROVEMENTS.md REVIEW_SUMMARY.txt .workbench/refactor-phase-2/
mv FINAL_REFACTOR_STATUS.md STATUS.md COMPLETION_CHECKLIST.md .workbench/refactor-phase-2/

# Move workbench logs (phase 1)
mv REFACTOR_PHASE1_*.md REFACTOR_PLAN_DETAILED.md .workbench/refactor-phase-1/
mv REFACTOR_PHASE2_PLAN.md .workbench/refactor-phase-2/

# Move debugging notes
mv REFACTOR_DEBUGGING_SUMMARY.md .workbench/debugging/

# Move live docs
mv context.md docs/architecture.md
mv decisions.md docs/decisions.md
mv HS_project.md docs/scope.md
mv NEW_HELPERS_REFERENCE.md docs/api-reference.md  # (merge into it later)
```

### Phase 4: Update Live Docs (20 min)

1. **`docs/architecture.md`**: Merge content from old `context.md` + add system diagram
2. **`docs/decisions.md`**: Keep as-is; add links to code modules
3. **`docs/api-reference.md`**: Extract API tables from README; add examples
4. **`docs/deployment.md`**: Extract deployment steps from README
5. **`README.md`**: Trim to 50 lines; link to docs/ for details

### Phase 5: Add `.workbench/README.md` (2 min)

```markdown
# Workbench

This folder contains development logs and checkpoints from past phases.

- `refactor-phase-1/`: Phase 1 modularization checkpoint
- `refactor-phase-2/`: Phase 2 improvements checkpoint  
- `debugging/`: Debugging session notes

These are immutable records—don't edit them. They're useful for understanding what was tried and why.
```

### Phase 6: Update Root `.gitignore` (1 min)

```bash
# Add to .gitignore if keeping workbench local-only
.workbench/

# (Optional) Commit .workbench/README.md if you want a reference
# But ignore the actual logs:
.workbench/**/*.md
!.workbench/README.md
```

---

## Result: Navigation Flows

### New Developer Onboarding
```
1. git clone → open README.md (50 lines)
   ↓
2. "Understand architecture" → open docs/architecture.md
   ↓
3. "Why is it built this way?" → open docs/decisions.md
   ↓
4. "How do I deploy?" → open docs/deployment.md
   ↓
5. "Show me the code" → cd gas/ or sync/ or ui/
```

### Maintenance (Ongoing)
```
1. "Something is broken" → README.md → docs/troubleshooting.md
2. "How do I add a feature?" → docs/architecture.md → code
3. "Why was X decided?" → docs/decisions.md → code comments
```

### Historical Context
```
1. "What happened in Phase 2?" → .workbench/refactor-phase-2/PHASE2_COMPLETE.md
2. "Why did we fix bug Y?" → .workbench/debugging/REFACTOR_DEBUGGING_SUMMARY.md
```

---

## File Size & Complexity Summary

### Before (Root: 30 files, 15+ .md files)
```
Health_Coach/
├── README.md (100+ lines)
├── context.md (50 lines)
├── decisions.md (70 lines)
├── PHASE2_COMPLETE.md ❌
├── PHASE2_IMPROVEMENTS_COMPLETE.md ❌
├── CODE_QUALITY_REVIEW_PHASE2.md ❌
├── QUICK_WINS.md ❌
├── ... (10 more .md files) ❌
└── [source code folders]
```

### After (Root: ~10 files, hierarchy clear)
```
Health_Coach/
├── README.md (50 lines, links to docs/)
├── package.json
├── requirements.txt
├── .gitignore
├── docs/                          📚 LIVE DOCS (4-6 files)
│   ├── README.md (index)
│   ├── architecture.md
│   ├── decisions.md
│   ├── api-reference.md
│   ├── deployment.md
│   └── troubleshooting.md
├── .workbench/                    🔨 EPHEMERAL (archived logs, not committed)
│   ├── refactor-phase-1/
│   ├── refactor-phase-2/
│   └── debugging/
└── [source code folders]          ✨ CODE (gas/, sync/, ui/, tests/)
```

---

## Summary: Why This Structure?

| Aspect | Benefit |
|--------|---------|
| **Clarity** | Every file has a clear purpose; no ambiguity |
| **Scalability** | Can add 100 files to `.workbench/` without cluttering root |
| **Discoverability** | New dev knows: start with README, then docs/, then code |
| **Maintenance** | Live docs stay thin; workbench logs are immutable records |
| **Git History** | Either commit `.workbench/` as historical record OR ignore it locally |
| **Onboarding** | Clear "learning path" instead of 15 random .md files |

---

## Next Steps

Would you like me to:

1. **Execute the reorganization** → Move files to new structure
2. **Create the new live docs** → Write `docs/architecture.md`, `docs/deployment.md`, etc.
3. **Update README.md** → Trim it down and add navigation links
4. **Both** → Full restructure + new docs + updated README

**Recommendation**: Execute all three. Total time: ~30 minutes. Result: Professional, scalable, maintainable structure.

---

**Questions?** Let me know which aspects you'd like adjusted (e.g., should `.workbench/` be committed or local-only?).
