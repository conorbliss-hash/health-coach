```markdown
# Decisions — recent engineering choices

## Google Sheets Sync

1. Restore Frankistein `sync/sheets.py` semantics

- Decision: Replaced the corrupted `sync/sheets.py` with the Frankistein implementation rather than creating a new, different merge algorithm.
- Rationale: Frankistein's implementation is the historically used, tested approach with clear, conservative rules for preserving manual edits and ordering Activity columns. Re-using it minimises behavioral drift and reduces review overhead.

2. Keep `write_dataframe` behaviour (clear + set_with_dataframe)

- Decision: The writer clears the target worksheet and re-writes consolidated rows using `set_with_dataframe`.
- Rationale: This keeps the sheet state deterministic and avoids row-by-row updates that are slower and more error-prone. The merge logic ensures manual edits are preserved where appropriate.

3. Use service account auth for automated runs

- Decision: The smoke run and typical automated syncs use `service_account.json` and `gspread.service_account`.
- Rationale: Service accounts allow non-interactive, reproducible runs (cron/CI) without user UI flows. Note: the service account email must be added as an Editor to the target spreadsheets.

4. Keep tests isolated from Google APIs

- Decision: Tests run without requiring gspread or Google credentials. The module-level writer can be a noop or replaced with minimal logic in tests to keep unit tests fast and hermetic.
- Rationale: This speeds up feedback loops and prevents accidental writes during test runs.

5. Future: add dry-run and preview modes

- Decision: (Proposed) Add a CLI flag to `fit_to_sheets.py` to support `--dry-run` and `--sheet-id` options.
- Rationale: This will allow safe verification runs and easier CI gating before writing to production spreadsheets.

## Google Apps Script Weekly Report

6. Use renderContext object pattern for parameter passing

- Decision: Instead of passing 15+ individual parameters to `distributeReport()`, collect all precomputed render variables into a single `renderContext` object.
- Rationale: Reduces parameter brittleness, makes code easier to extend (add new render values without changing function signature), and centralizes render-related state. Named parameters via destructuring improve readability.

7. Standardize null-coalescing to nullish coalesce (`??`) operator

- Decision: Replace mixed use of `||`, `!= null`, and `?` with consistent `??` operator throughout render prep.
- Rationale: The nullish coalesce operator correctly distinguishes between falsy values and missing values. `||` conflates empty strings, 0, false, and null; `??` only coalesces on null/undefined. This prevents subtle bugs where valid falsy values get overwritten.

8. Extract magic numbers to named constants

- Decision: Replace hardcoded threshold `1.5` (ACWR gating) with `ACWR_GATING_THRESHOLD` constant.
- Rationale: Makes intent explicit, facilitates future tuning/A/B testing, and enables centralised configuration.

9. Prefer functional array patterns over imperative loops where appropriate

- Decision: Replace multi-statement `if` loops with `.filter(Boolean)` and array literals for building diagnostic summary parts.
- Rationale: Reduces cognitive load, reduces intermediate mutable state, and aligns with modern JavaScript idioms.

10. Use if/else for complex conditional logic over nested ternaries

- Decision: Replace 3-level nested ternary in `leverText` selection with clear if/else blocks.
- Rationale: Nested ternaries beyond 1-2 levels become hard to parse and maintain. If/else is more readable and easier to debug.

11. Add guard clauses for builder function inputs

- Decision: Validate that critical data objects (weekly, trend, goals, derivedStats) exist before calling `buildSystemDriverCards_()` and `buildComponentRows_()`.
- Rationale: Prevents silent failures downstream; explicit error logging makes debugging faster.

12. Rename ambiguous variables to reduce cognitive friction

- Decision: Rename `reportDegradeReason` to `degradeReasonFromReport` where it conflicts with job-level `degradeReason` state variable.
- Rationale: Variable names should disambiguate their source/scope. Reduces mental overhead and prevents accidental cross-reference bugs.

Timestamp: 2025-11-08

```
