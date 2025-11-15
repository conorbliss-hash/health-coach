import datetime as dt
from unittest.mock import MagicMock, patch

import pandas as pd
import pytz

import fit_to_sheets


class DummyResponse:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        return None


def test_get_fit_credentials_uses_env(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setenv("GOOGLE_REFRESH_TOKEN", "rtok")

    dummy_creds = MagicMock()
    with patch.object(fit_to_sheets, "Credentials", return_value=dummy_creds):
        creds = fit_to_sheets.get_fit_credentials()

    dummy_creds.refresh.assert_called_once()
    assert creds is dummy_creds


def test_day_bounds_local_handles_timezone(monkeypatch):
    monkeypatch.setattr(fit_to_sheets, "LOCAL_TZ", pytz.timezone("US/Eastern"))
    start, end = fit_to_sheets.day_bounds_local(dt.date(2025, 10, 17))
    assert start.tzinfo == pytz.UTC and end.tzinfo == pytz.UTC
    assert start.hour == 4
    assert end.hour == 3 and end.minute == 59


def test_extract_steps_and_hr(monkeypatch):
    base_time = dt.datetime(2025, 10, 15, tzinfo=pytz.UTC)
    aggregate_response = {
        "bucket": [
            {
                "startTimeMillis": str(int(base_time.timestamp() * 1000)),
                "dataset": [{"point": [{"value": [{"intVal": 2500}]}]}],
            }
        ]
    }
    monkeypatch.setattr(
        fit_to_sheets,
        "fit_aggregate",
        lambda *args, **kwargs: aggregate_response,
    )

    creds = MagicMock(token="tok")
    start = base_time
    end = base_time + dt.timedelta(days=1)

    steps_df = fit_to_sheets.extract_steps(creds, start, end)
    assert steps_df.iloc[0]["steps"] == 2500

    hr_response = {
        "bucket": [
            {
                "startTimeMillis": str(int(base_time.timestamp() * 1000)),
                "dataset": [{"point": [{"value": [{"fpVal": 60.0}]}]}],
            }
        ]
    }
    monkeypatch.setattr(
        fit_to_sheets,
        "fit_aggregate",
        lambda *args, **kwargs: hr_response,
    )
    hr_df = fit_to_sheets.extract_heart_rate(creds, start, end)
    assert hr_df.iloc[0]["hr_avg"] == 60.0


def test_extract_sleep_handles_wake_segments(monkeypatch):
    tz = pytz.timezone("UTC")
    monkeypatch.setattr(fit_to_sheets, "LOCAL_TZ", tz)

    sessions_payload = {
        "session": [
            {
                "startTimeMillis": str(
                    int(dt.datetime(2025, 10, 15, 22, tzinfo=tz).timestamp() * 1000)
                ),
                "endTimeMillis": str(
                    int(dt.datetime(2025, 10, 16, 6, tzinfo=tz).timestamp() * 1000)
                ),
            }
        ]
    }

    segments_payload = {
        "point": [
            {
                "startTimeNanos": str(
                    int(dt.datetime(2025, 10, 15, 21, 55, tzinfo=tz).timestamp() * 1e9)
                ),
                "endTimeNanos": str(
                    int(dt.datetime(2025, 10, 15, 22, 5, tzinfo=tz).timestamp() * 1e9)
                ),
                "value": [{"intVal": fit_to_sheets.SLEEP_STAGE_AWAKE}],
            },
            {
                "startTimeNanos": str(
                    int(dt.datetime(2025, 10, 15, 22, 5, tzinfo=tz).timestamp() * 1e9)
                ),
                "endTimeNanos": str(
                    int(dt.datetime(2025, 10, 16, 1, tzinfo=tz).timestamp() * 1e9)
                ),
                "value": [{"intVal": 5}],
            },
            {
                "startTimeNanos": str(
                    int(dt.datetime(2025, 10, 16, 1, tzinfo=tz).timestamp() * 1e9)
                ),
                "endTimeNanos": str(
                    int(dt.datetime(2025, 10, 16, 6, tzinfo=tz).timestamp() * 1e9)
                ),
                "value": [{"intVal": fit_to_sheets.SLEEP_STAGE_AWAKE}],
            },
            {
                "startTimeNanos": str(
                    int(dt.datetime(2025, 10, 16, 6, tzinfo=tz).timestamp() * 1e9)
                ),
                "endTimeNanos": str(
                    int(dt.datetime(2025, 10, 16, 6, 10, tzinfo=tz).timestamp() * 1e9)
                ),
                "value": [{"intVal": fit_to_sheets.SLEEP_STAGE_AWAKE}],
            },
        ]
    }

    responses = [DummyResponse(sessions_payload), DummyResponse(segments_payload)]
    monkeypatch.setattr(
        "fit_to_sheets.requests.get", lambda *args, **kwargs: responses.pop(0)
    )

    creds = MagicMock(token="tok")
    start = dt.datetime(2025, 10, 15, tzinfo=tz)
    end = dt.datetime(2025, 10, 17, tzinfo=tz)
    df_sleep = fit_to_sheets.extract_sleep(creds, start, end)
    assert not df_sleep.empty
    row = df_sleep.iloc[0]
    assert row["start_time"] == "21:55:00"
    assert row["end_time"] == "06:10:00"
    assert row["Sleep_consistency"] <= 100


def test_update_tab_merges_new_rows(monkeypatch):
    monkeypatch.setattr(fit_to_sheets, "SPREADSHEET_ID", "test-sheet")

    class FakeWorksheet:
        def __init__(self):
            self._data = [
                {"date": "2025-10-15", "sleep_total_min": 400, "Sleep_consistency": ""}
            ]
            self.cleared = False
            self.formatted = False

        def get_all_records(self):
            return self._data

        def clear(self):
            self.cleared = True

        def format(self, *_args, **_kwargs):
            self.formatted = True

    class FakeSpreadsheet:
        def __init__(self):
            self.ws = FakeWorksheet()

        def worksheet(self, _name):
            return self.ws

    class FakeGC:
        def __init__(self):
            self.sheet = FakeSpreadsheet()

        def open_by_key(self, _key):
            return self.sheet

    stored = {}

    def fake_write_dataframe(ws, df, tab_name, format_sleep):
        stored["df"] = df.copy()
        stored["format_sleep"] = format_sleep
        stored["tab_name"] = tab_name

    monkeypatch.setattr(fit_to_sheets, "write_dataframe", fake_write_dataframe)

    gc = FakeGC()
    df = pd.DataFrame(
        [
            {
                "date": "2025-10-15",
                "sleep_total_min": 420,
                "end_time": "06:30:00",
                "start_time": "22:00:00",
                "wake_up_count": 1,
                "time_awake_min": 15,
                "Sleep_consistency": 88.5,
            }
        ]
    )

    fit_to_sheets.update_tab(gc, df, "Sleep")
    written = stored["df"]
    assert "Sleep_consistency" in written.columns
    value = written.loc[written["date"] == "2025-10-15", "Sleep_consistency"].iloc[0]
    assert float(value) == 88.5
    assert stored["format_sleep"] is True
    assert stored["tab_name"] == "Sleep"
