"""Assemble the payload for one lift-session generation.

Pulls from four sources: recent Garmin recovery + this week's already-logged
mountain-sports activity (reusing collector.py's existing, unmodified
functions), recent wger lifting history + body-weight trend, the persistent
athlete-feedback log (lift_feedback.py -- standing likes/dislikes/health
flags/notes over time, not just this call), and the session type + HA
shoulder flag passed in from lift_main.py.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from garmin_connect_mcp.client import GarminClientWrapper

from .collector import collect_history_summaries, collect_recent_health
from .compression import compress_week, strip_large_fields
from .config import AppConfig
from .lift_feedback import load_recent_feedback
from .timezone_util import athlete_tz_name
from .wger_client import WgerClient


def build_lift_payload(
    garmin_client: GarminClientWrapper,
    wger_client: WgerClient,
    config: AppConfig,
    catalog: list[dict[str, Any]],
    session_type: str,
    shoulder_flag: bool,
    session_date: date | None = None,
) -> dict[str, Any]:
    session_date = session_date or date.today()

    tz = athlete_tz_name(config.athlete_timezone)
    athlete_context = {
        "timezone": tz,
        "timezone_label": "Mountain Time (MT)",
        "location": config.athlete_location,
        "time_format": "All *_mt timestamp fields are local wall-clock times in MT",
        # Deliberately not config.unit_system -- that toggle drives the mountain
        # report's weather formatting (C/km/h vs F/mph) and defaults to metric.
        # This athlete thinks in pounds regardless (see lift_system.md's athlete
        # profile), so the lift prompt always gets "imperial" for its own,
        # unrelated use: converting kg figures to lb in rationale/summary_text.
        "unit_system": "imperial",
    }

    # Same "compact" summarization the mountain report always applies to its
    # daily_health -- raw Garmin day-health entries carry full body-battery
    # time series and are enormous uncompressed (measured live: ~122k tokens
    # for just 2 days). Route through compress_week() rather than sending
    # collect_recent_health()'s raw output directly, which was a real bug
    # caught while verifying this feature end-to-end, not a hypothetical.
    raw_recovery = collect_recent_health(garmin_client, days=2)
    compressed = compress_week(
        {"athlete_context": athlete_context, "activity_details": [], "daily_health": raw_recovery},
        "compact",
    )
    recent_recovery = compressed["daily_health"]

    week_end = session_date
    week_start = week_end - timedelta(days=6)
    recent_mountain_activity = [
        strip_large_fields(a) for a in collect_history_summaries(garmin_client, week_start, week_end)
    ]

    wger_sessions = wger_client.get_recent_sessions(config.wger_history_sessions)
    bodyweight_history = wger_client.get_bodyweight_history(since=session_date - timedelta(weeks=8))
    recent_feedback = load_recent_feedback(config.report_output_dir)

    return {
        "session_date": session_date.isoformat(),
        "session_type": session_type,
        "athlete_context": athlete_context,
        "recent_recovery": recent_recovery,
        "recent_mountain_activity": recent_mountain_activity,
        "wger_recent_sessions": wger_sessions,
        "wger_bodyweight_history": bodyweight_history,
        "recent_feedback": recent_feedback,
        "exercise_catalog": catalog,
        "flags": {
            "shoulder_flag_active": shoulder_flag,
        },
    }
