"""Assemble the payload for one lift-session generation.

Pulls from four sources: recent Garmin recovery + this week's already-logged
mountain-sports activity (reusing collector.py's existing, unmodified
functions), recent Hevy lifting history (joined back to what was prescribed)
+ body-weight trend, the persistent
athlete-feedback log (lift_feedback.py -- standing likes/dislikes/health
flags/notes over time, not just this call), and the session type + HA
shoulder flag passed in from lift_main.py.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from garmin_connect_mcp.client import GarminClientWrapper

from .collector import collect_history_summaries, collect_recent_health
from .compression import compress_week, strip_large_fields
from .config import AppConfig
from .emailer import PRESCRIPTIONS_LOG
from .lift_feedback import load_recent_feedback
from .timezone_util import athlete_tz_name
from .hevy_client import HevyClient, parse_ts, kg_to_lb, rpe_to_rir


def build_lift_payload(
    garmin_client: GarminClientWrapper,
    hevy_client: HevyClient,
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

    prescriptions = load_prescriptions(config.report_output_dir)
    recent_lift_sessions = [
        normalize_workout(w, prescriptions)
        for w in hevy_client.get_recent_workouts(config.lift_history_sessions)
    ]
    bodyweight_history = hevy_client.get_bodyweight_history(since=session_date - timedelta(weeks=8))
    recent_feedback = load_recent_feedback(config.report_output_dir)

    return {
        "session_date": session_date.isoformat(),
        "session_type": session_type,
        "athlete_context": athlete_context,
        "recent_recovery": recent_recovery,
        "recent_mountain_activity": recent_mountain_activity,
        "recent_lift_sessions": recent_lift_sessions,
        "bodyweight_history": bodyweight_history,
        "recent_feedback": recent_feedback,
        "exercise_catalog": catalog,
        "flags": {
            "shoulder_flag_active": shoulder_flag,
        },
    }


def load_prescriptions(report_dir: Path) -> list[dict[str, Any]]:
    """Every prescription save_lift_outputs() has appended, oldest first.
    A missing file just means nothing has been generated yet; an unreadable
    line is skipped rather than failing the whole generation."""
    path = report_dir / PRESCRIPTIONS_LOG
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def _prescription_for(
    workout: dict[str, Any], prescriptions: list[dict[str, Any]]
) -> dict[str, Any] | None:
    """The coach's prescription this workout was started from: the latest
    one written to the same (reused) routine before the workout began."""
    routine_id = workout.get("routine_id")
    started = parse_ts(workout.get("start_time"))
    if not routine_id or started is None:
        return None
    match = None
    for p in prescriptions:
        generated = datetime.fromisoformat(p["generated_at"])
        if p.get("routine_id") == routine_id and generated <= started:
            match = p
    return match


def normalize_workout(
    workout: dict[str, Any], prescriptions: list[dict[str, Any]]
) -> dict[str, Any]:
    """One logged Hevy workout, in the athlete's units (lb, RIR), with each
    exercise's prescribed target attached when it came from the coach."""
    prescription = _prescription_for(workout, prescriptions)
    targets = {
        ex["exercise_id"]: ex for ex in (prescription or {}).get("exercises", [])
    }
    exercises = []
    for ex in workout.get("exercises", []):
        target = targets.get(ex.get("exercise_template_id"))
        exercises.append(
            {
                "exercise_name": ex.get("title"),
                "exercise_id": ex.get("exercise_template_id"),
                "athlete_notes": ex.get("notes") or None,
                "prescribed": None
                if target is None
                else {
                    k: target.get(k)
                    for k in ("sets", "reps", "duration_seconds", "weight_lb", "rir_target")
                },
                "sets": [
                    {
                        "set_type": st.get("type"),
                        "weight_lb": kg_to_lb(st["weight_kg"]) if st.get("weight_kg") is not None else None,
                        "reps": st.get("reps"),
                        "duration_seconds": st.get("duration_seconds"),
                        "rpe": st.get("rpe"),
                        "rir": rpe_to_rir(st.get("rpe")),
                    }
                    for st in ex.get("sets", [])
                ],
            }
        )
    return {
        "date": (workout.get("start_time") or "")[:10],
        "title": workout.get("title"),
        "from_coach_prescription": prescription is not None,
        "prescribed_session_type": (prescription or {}).get("session_type"),
        "athlete_notes": workout.get("description") or None,
        "exercises": exercises,
    }
