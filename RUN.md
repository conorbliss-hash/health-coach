# How to Run fit_to_sheets.py

## Standard Run

From the project root:
```bash
cd "<PROJECT_PATH>/01-CORE"
"<PROJECT_PATH>/.venv/bin/python" fit_to_sheets.py
```

Or if you're already in the root directory:
```bash
cd 01-CORE && ../.venv/bin/python fit_to_sheets.py
```

## Options

### Dry Run (preview without writing)
```bash
cd 01-CORE && ../.venv/bin/python fit_to_sheets.py --dry-run
```

### Verbose Dry Run (show more data)
```bash
cd 01-CORE && ../.venv/bin/python fit_to_sheets.py --dry-run --verbose
```

### Include current time (for debugging recent nights)
```bash
cd 01-CORE && ../.venv/bin/python fit_to_sheets.py --include-now
```

## Important Notes

1. **Must run from 01-CORE directory** - the `sync` module is located there
2. **Credentials are symlinked** from 05-SYSTEM directory
3. The script updates:
   - Activity tab (steps)
   - HeartRate tab (RHR)
   - Sleep tab (sleep duration, timing, quality)
   - WeeklyRollups tab (calculated readiness & output scores)

## Recent Calibration Changes

- **Sleep SD target**: Increased from 30 to 45 minutes (more forgiving)
- **RHR baseline**: Should be set in Goals sheet to your 4-week average (~67.7 bpm)
- These changes make scores more personalized and realistic
