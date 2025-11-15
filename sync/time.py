import datetime as dt
from typing import Optional

import pytz

from .config import LOCAL_TZ


def day_bounds_local(date_obj: dt.date, tz: Optional[pytz.BaseTzInfo] = None):
    tz_info = tz or LOCAL_TZ
    start = tz_info.localize(dt.datetime.combine(date_obj, dt.time.min)).astimezone(
        pytz.UTC
    )
    end = tz_info.localize(dt.datetime.combine(date_obj, dt.time.max)).astimezone(
        pytz.UTC
    )
    return start, end
