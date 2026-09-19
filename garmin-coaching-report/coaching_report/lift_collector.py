"""Assemble the payload for one lift-session generation.

Pulls from three sources: recent Garmin recovery + this week's already-logged
mountain-sports activity (reusing collector.py's existing, unmodified
functions), recent wger lifting history + body-weight trend, and the
HA-set shoulder flag/note passed in from lift_main.py.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from garmin_connect_mcp.client import GarminClientWrapper

from .collector import collect_history_summaries, collect_recent_health
from .config import AppConfig
from .timezone_util import athlete_tz_name
from .wger_client import WgerClient


def build_lift_payload(
    garmin_client: GarminClientWrapper,
    wger_client: WgerClient,
    config: AppConfig,
    catalog: list[dict[str, Any]],
    shoulder_flag: bool,
    note: str,
    session_date: date | None = None,
) -> dict[str, Any]:
    session_date = session_date or date.today()

    recent_recovery = collect_recent_health(garmin_client, days=2)

    week_end = session_date
    week_start = week_end - timedelta(days=6)
    recent_mountain_activity = collect_history_summaries(garmin_client, week_start, week_end)

    wger_sessions = wger_client.get_recent_sessions(config.wger_history_sessions)
    bodyweight_history = wger_client.get_bodyweight_history(since=session_date - timedelta(weeks=8))

    tz = athlete_tz_name(config.athlete_timezone)
    return {
        "session_date": session_date.isoformat(),
        "athlete_context": {
            "timezone": tz,
            "timezone_label": "Mountain Time (MT)",
            "location": config.athlete_location,
            "time_format": "All *_mt timestamp fields are local wall-clock times in MT",
            "unit_system": config.unit_system,
        },
        "recent_recovery": recent_recovery,
        "recent_mountain_activity": recent_mountain_activity,
        "wger_recent_sessions": wger_sessions,
        "wger_bodyweight_history": bodyweight_history,
        "exercise_catalog": catalog,
        "flags": {
            "shoulder_flag_active": shoulder_flag,
            "note": note or None,
        },
    }
