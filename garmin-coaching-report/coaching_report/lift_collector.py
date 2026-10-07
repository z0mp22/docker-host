"""Assemble the payload for one lift-session (or fingerboard-session) generation.

Pulls from four sources: recent Garmin recovery + this week's already-logged
mountain-sports activity (reusing collector.py's existing, unmodified
functions), recent Hevy lifting history (joined back to what was prescribed)
+ body-weight trend, the persistent
athlete-feedback log (lift_feedback.py -- standing likes/dislikes/health
flags/notes over time, not just this call), the fingerboard ramp's phase
and hang history (lift_fingerboard.py), and the session type + HA shoulder
and finger flags passed in from lift_main.py.

Since 2026-10-07 the lift payload also carries what the coach needs to vary
sessions instead of repeating the last one: the home-gym inventory, the
exercises of the last lift session, working sets per muscle over 14 days,
and the exercises the athlete added to coach sessions on his own. The
fingerboard is a separate session with its own payload
(build_fingerboard_payload); the lift payload only gets a short summary.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Any

from garmin_connect_mcp.client import GarminClientWrapper

from .collector import collect_history_summaries, collect_recent_health
from .compression import compress_week, strip_large_fields
from .config import AppConfig
from .emailer import PRESCRIPTIONS_LOG
from .lift_equipment import HOME_GYM
from .lift_fingerboard import build_context as build_fingerboard_context
from .lift_feedback import load_recent_feedback
from .timezone_util import athlete_tz_name
from .hevy_client import HevyClient, parse_ts, kg_to_lb, rpe_to_rir

# Logged workouts the lift coach reads: everything in this window, or the
# last config.lift_history_sessions workouts if that's more.
HISTORY_DAYS = 21
COVERAGE_DAYS = 14
LIFT_SESSION_TYPES = ("heavy_1h", "light_30m")


def _athlete_context(config: AppConfig) -> dict[str, Any]:
    return {
        "timezone": athlete_tz_name(config.athlete_timezone),
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


def _recovery_and_activity(
    garmin_client: GarminClientWrapper, athlete_context: dict[str, Any], session_date: date
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
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
    week_start = session_date - timedelta(days=6)
    activity = [
        strip_large_fields(a) for a in collect_history_summaries(garmin_client, week_start, session_date)
    ]
    return compressed["daily_health"], activity


def _fingerboard_context(hevy_client, catalog, config, session_date, activity, finger_flag):
    return build_fingerboard_context(
        hevy_client,
        catalog,
        config.report_output_dir,
        session_date,
        activity,
        finger_flag,
        now=datetime.now(ZoneInfo(athlete_tz_name(config.athlete_timezone))).replace(tzinfo=None),
    )


def build_lift_payload(
    garmin_client: GarminClientWrapper,
    hevy_client: HevyClient,
    config: AppConfig,
    catalog: list[dict[str, Any]],
    session_type: str,
    shoulder_flag: bool,
    session_date: date | None = None,
    finger_flag: bool = False,
    full_catalog: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """`catalog` is what the coach may prescribe (home gym, no board work);
    `full_catalog` (defaults to it) resolves names and muscles in history and
    the fingerboard exercises."""
    session_date = session_date or date.today()
    full_catalog = full_catalog if full_catalog is not None else catalog
    athlete_context = _athlete_context(config)
    recent_recovery, recent_mountain_activity = _recovery_and_activity(
        garmin_client, athlete_context, session_date
    )

    prescriptions = load_prescriptions(config.report_output_dir)
    catalog_by_id = {ex["id"]: ex for ex in full_catalog}
    workouts = hevy_client.get_workouts_since(session_date - timedelta(days=HISTORY_DAYS))
    if len(workouts) < config.lift_history_sessions:
        workouts = hevy_client.get_recent_workouts(config.lift_history_sessions)
    recent_lift_sessions = [normalize_workout(w, prescriptions, catalog_by_id) for w in workouts]
    bodyweight_history = hevy_client.get_bodyweight_history(since=session_date - timedelta(weeks=8))
    recent_feedback = load_recent_feedback(config.report_output_dir)
    board = _fingerboard_context(
        hevy_client, full_catalog, config, session_date, recent_mountain_activity, finger_flag
    )
    last_lift = last_lift_session(recent_lift_sessions)

    return {
        "session_date": session_date.isoformat(),
        "session_weekday": session_date.strftime("%A"),
        "session_type": session_type,
        "athlete_context": athlete_context,
        "equipment": HOME_GYM,
        "recent_recovery": recent_recovery,
        "recent_mountain_activity": recent_mountain_activity,
        "recent_lift_sessions": recent_lift_sessions,
        "last_lift_session": None if last_lift is None else {
            "date": last_lift["date"],
            "exercises": [ex["exercise_name"] for ex in last_lift["exercises"]],
        },
        "muscle_sets_last_14d": muscle_sets(recent_lift_sessions, session_date - timedelta(days=COVERAGE_DAYS)),
        "athlete_added_exercises": athlete_added_exercises(recent_lift_sessions),
        "bodyweight_history": bodyweight_history,
        "recent_feedback": recent_feedback,
        "exercise_catalog": catalog,
        "fingerboard_summary": {
            "phase": board["phase"],
            "phase_name": board["phase_name"],
            "board_days_last_7d": board["board_days_last_7d"],
            "last_board_date": max((r["date"] for r in board["history"] if r["date"]), default=None),
            "hours_since_last_climb": board["hours_since_last_climb"],
        },
        "flags": {
            "shoulder_flag_active": shoulder_flag,
            "finger_flag_active": finger_flag,
        },
    }


def build_fingerboard_payload(
    garmin_client: GarminClientWrapper,
    hevy_client: HevyClient,
    config: AppConfig,
    catalog: list[dict[str, Any]],
    shoulder_flag: bool,
    finger_flag: bool,
    session_date: date | None = None,
) -> dict[str, Any]:
    """Everything a board-only session needs. `catalog` is the full Hevy
    catalog; the coach gets the plan exercises plus forearm work only."""
    from .lift_fingerboard import fingerboard_session_catalog

    session_date = session_date or date.today()
    athlete_context = _athlete_context(config)
    recent_recovery, recent_mountain_activity = _recovery_and_activity(
        garmin_client, athlete_context, session_date
    )
    board = _fingerboard_context(
        hevy_client, catalog, config, session_date, recent_mountain_activity, finger_flag
    )
    return {
        "session_date": session_date.isoformat(),
        "session_weekday": session_date.strftime("%A"),
        "session_type": "fingerboard",
        "athlete_context": athlete_context,
        "recent_recovery": recent_recovery,
        "recent_mountain_activity": recent_mountain_activity,
        "recent_feedback": load_recent_feedback(config.report_output_dir),
        "exercise_catalog": fingerboard_session_catalog(catalog),
        "fingerboard": board,
        "flags": {
            "shoulder_flag_active": shoulder_flag,
            "finger_flag_active": finger_flag,
        },
    }


def last_lift_session(sessions: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The most recent logged strength workout: one started from a heavy or
    light prescription, or one the athlete logged on his own that isn't
    board-only. PT and fingerboard sessions don't count."""
    for s in reversed(sessions):
        kind = s.get("prescribed_session_type")
        if kind in LIFT_SESSION_TYPES:
            return s
        if kind is None and any(not (ex["exercise_name"] or "").startswith("BM1000") for ex in s["exercises"]):
            return s
    return None


def muscle_sets(sessions: list[dict[str, Any]], since: date) -> dict[str, int]:
    """Working (non-warm-up) sets per primary muscle since `since`."""
    out: dict[str, int] = {}
    for s in sessions:
        if not s["date"] or date.fromisoformat(s["date"]) < since:
            continue
        for ex in s["exercises"]:
            muscle = ex.get("muscle") or "unknown"
            n = sum(1 for st in ex["sets"] if st["set_type"] != "warmup")
            if n:
                out[muscle] = out.get(muscle, 0) + n
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def athlete_added_exercises(sessions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Exercises the athlete added to a coach session himself: his own
    picks, oldest first by first appearance, with the last time and top set."""
    seen: dict[str, dict[str, Any]] = {}
    for s in sessions:
        for ex in s["exercises"]:
            if not ex.get("added_by_athlete"):
                continue
            working = [st for st in ex["sets"] if st["set_type"] != "warmup"]
            top = max(working, key=lambda st: (st["weight_lb"] or 0, st["reps"] or 0), default=None)
            entry = seen.setdefault(ex["exercise_id"], {"exercise_name": ex["exercise_name"], "times_added": 0})
            entry["times_added"] += 1
            entry["last_date"] = s["date"]
            entry["last_top_set"] = None if top is None else {
                "weight_lb": top["weight_lb"], "reps": top["reps"], "rpe": top["rpe"],
            }
    return list(seen.values())


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
    workout: dict[str, Any],
    prescriptions: list[dict[str, Any]],
    catalog_by_id: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """One logged Hevy workout, in the athlete's units (lb, RIR), with each
    exercise's prescribed target attached when it came from the coach, and
    added_by_athlete set when he put it into a coach session himself."""
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
                "muscle": (catalog_by_id or {}).get(ex.get("exercise_template_id"), {}).get("muscle"),
                "added_by_athlete": prescription is not None and target is None,
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
