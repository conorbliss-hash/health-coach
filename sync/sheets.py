"""Sheet writer utilities for Google Fit sync.

This module implements a conservative, well-tested merge strategy for the
Activity and Sleep tabs. It intentionally keeps behaviour small and explicit
so it can be used in the main sync code path.
"""

from __future__ import annotations

import pandas as pd


def prepare_dataframe(existing_df: pd.DataFrame, new_df: pd.DataFrame) -> pd.DataFrame:
    """Merge new rows into the existing tab data, preserving columns."""
    ACTIVITY_COLUMNS = [
        "date",
        "steps",
        "Working hours",
        "workout",
        "primary_focus",
        "secondary_focus",
        "volume_kg",
        "prs",
    ]

    def _is_blank(val) -> bool:
        # Blank means None, NaN or empty string (after trimming).
        if val is None:
            return True
        if pd.isna(val):
            return True
        if isinstance(val, str):
            return val.strip() == ""
        return False

    def _should_preserve_existing(x) -> bool:
        """
        Return True if the existing cell x should be preserved when merging.

        Rules:
        - Blank (None/NaN/empty string): do NOT preserve (False)
        - Boolean: preserve (True)
        - Numeric (or numeric-string): preserve only if value != 0
        - Non-numeric strings/objects: preserve (True)
        """
        if _is_blank(x):
            return False
        if isinstance(x, bool):
            return True
        try:
            num = float(x)
            return num != 0
        except Exception:
            return True

    working_new = new_df.copy()
    working_existing = existing_df.copy()
    existing_lookup = existing_df.copy()
    if not existing_lookup.empty and "date" in existing_lookup.columns:
        existing_lookup["date"] = pd.to_datetime(existing_lookup["date"], errors="coerce").dt.strftime("%Y-%m-%d")
        existing_lookup.dropna(subset=["date"], inplace=True)
        existing_lookup.set_index("date", inplace=True)

    all_columns = set(working_existing.columns) | set(working_new.columns)

    for df in (working_existing, working_new):
        if not df.empty and "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")

    if working_existing.empty:
        combined = working_new
    else:
        working_existing.set_index("date", inplace=True)
        working_new.set_index("date", inplace=True)
        combined = pd.concat([working_existing, working_new], sort=False)
        combined.sort_index(kind="mergesort", inplace=True)
        combined = combined[~combined.index.duplicated(keep="last")]
        combined.reset_index(inplace=True)

    for column in all_columns:
        if column not in combined.columns:
            combined[column] = None

    combined["date"] = pd.to_datetime(combined["date"], errors="coerce")
    combined.dropna(subset=["date"], inplace=True)
    combined.sort_values(by="date", inplace=True)
    combined["date"] = combined["date"].dt.strftime("%Y-%m-%d")

    # Preserve existing non-blank, non-zero values from the sheet for overlapping
    # date rows. This protects manual edits (e.g. steps, hr fields) from being
    # overwritten by incoming NaNs. We run this only when the existing lookup
    # was indexed by `date` (avoids touching weekly rollups).
    if not existing_lookup.empty and not combined.empty and "date" in existing_lookup.index.names:
        # Remove duplicate dates in existing_lookup (keep first occurrence)
        existing_lookup = existing_lookup[~existing_lookup.index.duplicated(keep="first")]
        combined_indexed = combined.set_index("date")
        overlapping_cols = set(combined_indexed.columns) & set(existing_lookup.columns)
        for col in overlapping_cols:
            try:
                aligned = existing_lookup[col].reindex(combined_indexed.index)
                mask = aligned.apply(_should_preserve_existing)
                if mask.any():
                    combined_indexed.loc[mask, col] = aligned[mask]
            except Exception:
                # If reindex fails, skip this column
                pass
        combined = combined_indexed.reset_index()

    sleep_columns = [
        "date",
        "sleep_total_min",
        "start_time",
        "end_time",
        "wake_up_count",
        "time_awake_min",
        "Sleep_consistency",
    ]

    if set(combined.columns) == set(sleep_columns):
        combined = combined.reindex(columns=sleep_columns)
        numeric_cols = {"sleep_total_min", "time_awake_min", "wake_up_count", "Sleep_consistency"}
        for col in numeric_cols:
            combined[col] = pd.to_numeric(combined[col], errors="coerce")
    elif set(ACTIVITY_COLUMNS).issubset(combined.columns):
        ordered = [col for col in ACTIVITY_COLUMNS if col in combined.columns]
        remainder = [col for col in combined.columns if col not in ACTIVITY_COLUMNS]
        combined = combined[ordered + remainder]
        for col in ["steps", "Working hours", "volume_kg", "prs"]:
            if col in combined.columns:
                combined[col] = pd.to_numeric(combined[col], errors="coerce")
    else:
        column_order = ["date"] + sorted(col for col in combined.columns if col != "date")
        combined = combined[column_order]

    return combined.reset_index(drop=True)


def write_dataframe(
    ws, final_df: pd.DataFrame, tab_name: str, *, format_sleep: bool = False
) -> None:
    from gspread_dataframe import set_with_dataframe

    ws.clear()
    values = final_df.where(pd.notna(final_df), None)
    
    # Force date column to be stored as text with leading apostrophe
    # This prevents Google Sheets from auto-parsing dates and causing timezone issues
    if "date" in values.columns:
        mask = values["date"].notna()
        values.loc[mask, "date"] = "'" + values.loc[mask, "date"].astype(str)
    
    set_with_dataframe(
        ws,
        values,
        include_index=False,
        include_column_header=True,
        resize=True,
    )

    if format_sleep:
        try:
            ws.format("B:B", {"numberFormat": {"type": "NUMBER", "pattern": "0"}})
            ws.format("C:D", {"numberFormat": {"type": "TIME", "pattern": "hh:mm:ss"}})
            ws.format("E:F", {"numberFormat": {"type": "NUMBER", "pattern": "0"}})
            ws.format("G:G", {"numberFormat": {"type": "NUMBER", "pattern": "0.0"}})
        except Exception as e:
            print(f"Warning: Could not apply sleep formatting: {e}")
    elif tab_name == "Activity":
        try:
            ws.format("B:B", {"numberFormat": {"type": "NUMBER", "pattern": "0"}})
            ws.format("C:C", {"numberFormat": {"type": "NUMBER", "pattern": "0.0"}})
            ws.format("G:G", {"numberFormat": {"type": "NUMBER", "pattern": "0.0"}})
            ws.format("H:H", {"numberFormat": {"type": "NUMBER", "pattern": "0"}})
        except Exception as e:
            print(f"Warning: Could not apply activity formatting: {e}")
