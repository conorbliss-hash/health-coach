# Refactor Plan: Weekly Report Job

This document breaks the architecture cleanup into three parallel patches. Each patch has a narrow goal, precise instructions, and validation steps so multiple agents can work concurrently without stepping on each other.

## General Guardrails

- Work inside `gas/` unless explicitly stated.
- Keep behavior identical; no functional enhancements in these patches.
- Do not reorder unrelated logic or rename exports unless the step explicitly says so.
- After code changes, run `npm test` (if available) and a manual Apps Script execution (`main()` dry run) once all patches are merged.

## Patch 1: Config Extraction

**Goal:** Move the large constant blocks (configuration + copy decks) into dedicated modules under a new `config/` directory.

### Instructions
1. Create `gas/config/` (if it does not exist).
2. For each top-level constant group in `Main.js` (e.g., `CONFIG`, `COACH`, `COACH_VOICE`, `OBS_LABELS`, `ACTION_LIBRARY`, `SECTION_CONFIG`, `SECTION_LABEL_SHORT`, `ACTION_WHERE_HOW`, `ACTION_DEDUP_FALLBACK`), move the exact object literal into a separate file. Example: `gas/config/thresholds.js` exports `CONFIG`.
3. Re-export helper maps that are referenced elsewhere (e.g., `SECTION_CONFIG`).
4. Update `Main.js` to import the new modules via `const { CONFIG } = ConfigThresholds;` etc. (honor Apps Script module style—likely `import` via clasp bundler or `const CONFIG = Config.CONFIG` depending on build setup; mirror existing patterns).
5. Remove the original constant definitions from `Main.js` once imports work.
6. Verify no other files need path updates (search for each constant name).

### Tests
- `rg 'const CONFIG'` should now only match within `config/`.
- Apps Script dry run: `clasp push`, run `main()`—confirm identical execution log output.

## Patch 2: Spreadsheet/Data Access Layer

**Goal:** Encapsulate all Spreadsheet interactions behind a repository layer so business logic no longer calls Apps Script services directly.

### Instructions
1. Create `gas/sheets/` with files such as:
   - `schema.js` → exports `validateDataSchema` (moved from `Main.js`).
   - `metrics.js` → exports `getWeeklyMetrics`, `getTrendMetrics`, etc. (lift the current helper bodies verbatim).
   - `logging.js` → exports `logReportRow`, `logEmailEntry` (move existing sheet-appending code).
2. Replace the corresponding inline code in `Main.js` with calls to these helpers. Example: instead of directly building `weekly = { … }`, call `const weekly = getWeeklyMetrics();`.
3. Ensure the helpers return the exact structures `weeklyReportJob` expects; avoid renaming fields.
4. Keep all SpreadsheetApp/Gmail/Drive references inside the new modules where possible, but do not modify email rendering yet (that comes in Patch 3).

### Tests
- Unit-level smoke: run `clasp push`, execute `main()`; the log sequence should match pre-refactor runs.
- Confirm `Main.js` no longer calls `SpreadsheetApp` directly (use `rg 'SpreadsheetApp' gas/Main.js`).

## Patch 3: Delivery Pipeline Split

**Goal:** Separate rendering, email delivery, and audit logging into a dedicated module so `weeklyReportJob` only orchestrates data.

### Instructions
1. Create `gas/delivery/reportDelivery.js` (or similar) exporting functions:
   - `renderReport(context)` → returns `{ html, pdfBlob, metadata }` (move existing HTML/CSS creation + blob logic here).
   - `sendReport({ pdfBlob, subject, body, recipient, emailLogMeta })` → wraps `GmailApp.sendEmail` and handles EmailLog entries.
   - `recordReport({ aiRaw, weekly, trend, scores, weekMeta })` → wraps `logReportToSheet`.
2. Lift the existing code from `Main.js` into these helpers without altering behavior. The `weeklyReportJob` flow should become:
   ```js
   const renderResult = renderReport(...);
   sendReport(renderResult, emailLogMeta);
   recordReport(...);
   ```
3. Keep `logWeeklyJob_` calls in `Main.js` but add any render/send-specific logging inside the delivery module as needed.
4. Ensure error handling mirrors the current try/catch semantics; propagate exceptions back up so the Ops email logic still works.

### Tests
- After merging this patch (and applying the earlier ones), run `clasp push` and trigger `main()`.
- Verify: Email arrives, `EmailLog` gains a new row, `Reports` gains a new entry, and execution logs show the same stage flow.

---

Following these steps keeps each patch surgical and low-risk while moving toward a modular architecture. Merge order can be 1 → 2 → 3, but engineers can implement them in parallel branches because their touchpoints are disjoint when scoped carefully.
