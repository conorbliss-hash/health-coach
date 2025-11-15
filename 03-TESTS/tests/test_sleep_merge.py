import os
import sys
import pandas as pd

# Ensure repo root is on sys.path so `import sync` works when tests are run directly
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from sync.sheets import prepare_dataframe


def test_preserve_new_sleep_row():
    """New recent sleep rows should appear in the merged DataFrame."""
    existing = pd.DataFrame(
        [
            {
                "date": "2025-10-05",
                "sleep_total_min": 480,
                "start_time": "22:00:00",
                "end_time": "06:00:00",
                "wake_up_count": 1,
                "time_awake_min": 12,
                "Sleep_consistency": 0.8,
            }
        ]
    )

    new = pd.DataFrame(
        [
            {
                "date": "2025-11-07",
                "sleep_total_min": 450,
                "start_time": "23:00:00",
                "end_time": "06:30:00",
                "wake_up_count": 2,
                "time_awake_min": 20,
                "Sleep_consistency": 0.7,
            }
        ]
    )

    merged = prepare_dataframe(existing, new)

    # Expect both dates to be present after merge
    dates = set(merged["date"].astype(str).tolist())
    assert "2025-11-07" in dates
    assert "2025-10-05" in dates


def test_inprogress_session_preserved():
    """Sessions with a missing end_time (in-progress) should be preserved, not dropped."""
    existing = pd.DataFrame([])

    new = pd.DataFrame(
        [
            {
                "date": "2025-11-08",
                "sleep_total_min": None,
                "start_time": "23:30:00",
                "end_time": None,
                "wake_up_count": None,
                "time_awake_min": None,
                "Sleep_consistency": None,
            }
        ]
    )

    merged = prepare_dataframe(existing, new)

    # The row with date 2025-11-08 should be present even though end_time is None
    dates = set(merged["date"].astype(str).tolist())
    assert "2025-11-08" in dates
