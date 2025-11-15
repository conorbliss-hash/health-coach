import os
from pathlib import Path

import pytz
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# .env is now in 05-SYSTEM at project root
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / "05-SYSTEM" / ".env")

_raw_tz = (os.getenv("TZ") or "").strip() or "UTC"
try:
    LOCAL_TZ = pytz.timezone(_raw_tz)
    TZ = _raw_tz
except pytz.UnknownTimeZoneError:
    print(f"[WARN] Unknown TZ '{_raw_tz}', defaulting to UTC")
    LOCAL_TZ = pytz.timezone("UTC")
    TZ = "UTC"
