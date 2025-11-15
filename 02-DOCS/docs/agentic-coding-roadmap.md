# Agentic Coding Rollout

## Phase 0 – Preconditions
- Language: Python
- Test command: `python -m pytest`
- Coverage command: `python -m pytest --maxfail=1 --disable-warnings --cov=. --cov-report=term-missing`
- Coverage threshold: 70%
- Missing guardrails: CI workflow, PR template, CODEOWNERS, decision log

## Phase 1 – Org Defaults
- (Requires org-level access) publish reusable CI, PR template, CODEOWNERS, labels, branch protection.

## Phase 2 – Repo Wiring
- Added PR template at `.github/pull_request_template.md`
- Added CI workflow `.github/workflows/ci.yml`
- Added decision log `docs/decision-log.md`
- Added CODEOWNERS `.github/CODEOWNERS`

## Phase 3 – Thinking Tools
- Prompts stored in `docs/codex-prompts.md`

## Phase 4 – Pilot Ticket
- Apply prompts (tests -> plan -> impl -> docs -> decision).
- Use decision log for trade-offs.

## Phase 5 – Ratchet & Scale
- Increase coverage gate 5% weekly until ≥85%.
- Enforce ≤400 LOC PRs or decision log justification.

## Phase 6 – Metrics
- Track PR size median, coverage trend, review lead time, decision-log rows/week.

## Label Suggestions
- plan:approved, decision:logged, needs:tests, size:xs-400loc.

## Branch Protection (manual)
- Require CI, block direct pushes to `main`, enforce PR reviews.
