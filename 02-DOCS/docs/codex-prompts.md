# CODEX Prompts Library

## Prompt A — Tests First
```
Create/extend unit+integration tests for <feature>. Cover success/failure/edges: <cases>. Target coverage ≥<min>. Run tests and print summary. Do not write impl code yet.
```

## Prompt B — Plan First
```
Draft a one-page plan for <feature>: steps, dependencies, risks, rough estimate. Update README/API examples + acceptance criteria.
```

## Prompt C — Decision Matrix
```
Produce a 1-page option matrix (2–3 options) scored on performance, complexity, security, cost, time-to-ship. Recommend one, justify trade-offs, mark reversibility. Append a single decision-log row.
```

## Prompt D — PR Discipline
```
Open a ≤400 LOC PR with summary, rationale, risks, tests, docs, and preview link. Resolve all comments; keep CI green. Block merge until labels: plan:approved (+ decision:logged if applicable).
```
