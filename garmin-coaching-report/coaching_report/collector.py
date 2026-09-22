"""Pull Garmin Connect data for coaching analysis."""

import json
import sys
from datetime import date, timedelta
from typing import Any

from garmin_connect_mcp.client import GarminClientWrapper

from . import nutrition as nutrition_api
from .config import AppConfig
from .errors import DataCollectionError, EmptyWindowError
from .timezone_util import athlete_tz_name
from .wger_client import WgerClient


def _date_str(d: date) -> str:
    return d.isoformat()


def _safe(client: GarminClientWrapper, method: str, *args, **kwargs) -> Any:
    try:
        return client.safe_call(method, *args, **kwargs)
    except Exception:
        return None


def _collect_day_health(client: GarminClientWrapper, day: date, compact: bool = True) -> dict[str, Any]:
    ds = _date_str(day)
    entry: dict[str, Any] = {
        "date": ds,
        "stats": _safe(client, "get_stats", ds),
        "user_summary": _safe(client, "get_user_summary", ds),
        "training_readiness": _safe(client, "get_training_readiness", ds),
        "training_status": _safe(client, "get_training_status", ds),
        "sleep": _safe(client, "get_sleep_data", ds),
        "hrv": _safe(client, "get_hrv_data", ds),
        "resting_hr": _safe(client, "get_rhr_day", ds),
    }
    if not compact:
        entry.update(
            {
                "body_battery": _safe(client, "get_body_battery", ds, ds),
                "body_battery_events": _safe(client, "get_body_battery_events", ds),
                "heart_rates": _safe(client, "get_heart_rates", ds),
                "stress": _safe(client, "get_stress_data", ds),
                "steps": _safe(client, "get_steps_data", ds),
            }
        )
    else:
        entry["body_battery"] = _safe(client, "get_body_battery", ds, ds)
    return entry


def collect_recent_health(client: GarminClientWrapper, days: int = 2) -> list[dict[str, Any]]:
    """Last `days` calendar days of Garmin recovery data, most recent last.

    Public wrapper around the same per-day extraction build_payload() uses,
    for the lift-session pipeline's shorter, more recent-focused lookback --
    it doesn't need a full week/history payload, just yesterday and today.
    """
    end = date.today()
    return [
        _collect_day_health(client, end - timedelta(days=i), compact=True)
        for i in range(days - 1, -1, -1)
    ]


def _collect_activity(
    client: GarminClientWrapper,
    activity_id: int,
    maxchart: int,
    maxpoly: int,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "activity_id": activity_id,
        "summary": _safe(client, "get_activity", activity_id),
        "splits": _safe(client, "get_activity_splits", activity_id),
        "weather": _safe(client, "get_activity_weather", activity_id),
        "hr_zones": _safe(client, "get_activity_hr_in_timezones", activity_id),
        "gear": _safe(client, "get_activity_gear", activity_id),
        "training_effect": _safe(client, "get_training_effect", activity_id),
    }
    if maxchart > 0 or maxpoly > 0:
        entry["details"] = _safe(
            client, "get_activity_details", activity_id, maxchart=maxchart, maxpoly=maxpoly
        )
    return entry


def collect_week_full(
    client: GarminClientWrapper,
    start: date,
    end: date,
    maxchart: int,
    maxpoly: int,
) -> dict[str, Any]:
    """All calendar days in [start, end] inclusive."""
    if end < start:
        raise DataCollectionError(
            f"Inverted collection window: {_date_str(start)}..{_date_str(end)}"
        )
    day_count = (end - start).days + 1
    start_s = _date_str(start)
    end_s = _date_str(end)

    try:
        activities = client.safe_call("get_activities_by_date", start_s, end_s, "") or []
    except Exception as exc:
        raise DataCollectionError(f"Failed to fetch week activities: {exc}") from exc

    daily_health = [
        _collect_day_health(client, start + timedelta(days=i), compact=True)
        for i in range(day_count)
    ]

    activity_details = []
    for act in activities:
        act_id = act.get("activityId")
        if act_id is not None:
            activity_details.append(
                _collect_activity(client, int(act_id), maxchart, maxpoly)
            )

    return {
        "range": {"start": start_s, "end": end_s, "days": day_count},
        "activity_details": activity_details,
        "daily_health": daily_health,
    }


def collect_history_summaries(
    client: GarminClientWrapper, history_start: date, history_end: date
) -> list[dict[str, Any]]:
    """Activity list summaries for comparison context (no GPS/time-series)."""
    try:
        activities = client.safe_call(
            "get_activities_by_date",
            _date_str(history_start),
            _date_str(history_end),
            "",
        )
        return activities or []
    except Exception as exc:
        raise DataCollectionError(f"Failed to fetch history activities: {exc}") from exc


def build_payload(
    client: GarminClientWrapper,
    config: AppConfig,
    report_date: date | None = None,
    since: date | None = None,
    through: date | None = None,
) -> dict[str, Any]:
    """Build coaching input payload.

    Default (since=through=None): the 7 calendar days ending the day before
    report_date -- identical to the historical behavior. ``since`` / ``through``
    override the lookback window start / end for on-demand runs.
    """
    today = report_date or date.today()
    week_end = through or (today - timedelta(days=1))
    week_start = since or (week_end - timedelta(days=6))

    if week_end < week_start:
        raise EmptyWindowError(
            f"Nothing to report: window {_date_str(week_start)}.."
            f"{_date_str(week_end)} contains no days "
            f"(the last report already covered through {_date_str(week_end)})"
        )
    window_days = (week_end - week_start).days + 1
    if window_days > config.max_window_days:
        raise DataCollectionError(
            f"Report window {_date_str(week_start)}..{_date_str(week_end)} spans "
            f"{window_days} days (max {config.max_window_days}); raise "
            f"MAX_WINDOW_DAYS to override."
        )

    history_end = week_start - timedelta(days=1)
    history_start = week_start - timedelta(weeks=config.history_weeks)

    week_full = collect_week_full(
        client,
        week_start,
        week_end,
        maxchart=config.garmin_maxchart,
        maxpoly=config.garmin_maxpoly,
    )
    history = collect_history_summaries(client, history_start, history_end)

    nutrition_history = _attach_nutrition(
        config, week_full, week_start, week_end, history_start, history_end
    )
    strength_training_log = _collect_lift_history(config, week_start, week_end)

    tz = athlete_tz_name(config.athlete_timezone)
    return {
        "report_date": _date_str(today),
        "athlete_context": {
            "timezone": tz,
            "timezone_label": "Mountain Time (MT)",
            "location": config.athlete_location,
            "time_format": "All *_mt fields are local wall-clock times in MT",
            "unit_system": config.unit_system,
            "nutrition_source": (
                "FatSecret food diary" if nutrition_history is not None else None
            ),
            "strength_training_source": (
                "wger (athlete-logged sets)" if strength_training_log is not None else None
            ),
        },
        "week_full": week_full,
        "history_summaries": history,
        "history_range": {
            "start": _date_str(history_start),
            "end": _date_str(history_end),
            "weeks": config.history_weeks,
        },
        "nutrition_history": nutrition_history or [],
        "strength_training_log": strength_training_log or [],
    }


def _attach_nutrition(
    config: AppConfig,
    week_full: dict[str, Any],
    week_start: date,
    week_end: date,
    history_start: date,
    history_end: date,
) -> list[dict[str, Any]] | None:
    """Merge per-day nutrition into the week and return weekly history averages.

    Returns None when FatSecret is not configured/authorized so the report runs
    unchanged without fueling data.
    """
    client = nutrition_api.connect(config)
    if client is None:
        return None

    day_count = (week_end - week_start).days + 1
    week_days = [week_start + timedelta(days=i) for i in range(day_count)]
    by_date = nutrition_api.collect_week_nutrition(client, week_days)
    for entry in week_full.get("daily_health", []):
        entry["nutrition"] = by_date.get(entry.get("date"))

    try:
        return nutrition_api.weekly_aggregates(client, history_start, history_end)
    except Exception:
        return []


def _session_date(session: dict[str, Any]) -> date:
    return date.fromisoformat(session["datetime_start"][:10])


def _collect_lift_history(
    config: AppConfig, week_start: date, week_end: date
) -> list[dict[str, Any]] | None:
    """Athlete-logged wger sets (real weight/reps/RIR) in [week_start, week_end].

    Returns None when wger isn't configured or the instance can't be reached,
    so the report runs unchanged without strength data -- same optional-source
    pattern as _attach_nutrition() above. Never lets a wger problem fail the
    mountain report; a WgerError outage here is caught, not propagated.
    """
    if not config.wger_url or not config.wger_api_token:
        return None

    try:
        wger_client = WgerClient(config.wger_url, config.wger_api_token)
        catalog_by_id = {ex["id"]: ex["name"] for ex in wger_client.get_exercise_catalog()}
        weight_units, _rep_units = wger_client.get_unit_labels()
        sessions = wger_client.get_workout_history(since=week_start)
    except Exception as exc:
        # Broad on purpose: WgerError covers bad responses, but a plain
        # requests connection/timeout error (instance down) isn't a
        # WgerError and must not fail the mountain report either -- this
        # source is best-effort, exactly like FatSecret nutrition above.
        print(f"[mountain-report] wger lift history unavailable: {exc}", file=sys.stderr)
        return None

    out = []
    for sess in sessions:
        sess_date = _session_date(sess)
        if sess_date > week_end:
            continue
        logs = [
            {
                "exercise_name": catalog_by_id.get(log["exercise"], f"exercise #{log['exercise']}"),
                "reps": float(log["repetitions"]) if log.get("repetitions") is not None else None,
                "weight": float(log["weight"]) if log.get("weight") is not None else None,
                "weight_unit": weight_units.get(log.get("weight_unit")),
                "rir": float(log["rir"]) if log.get("rir") is not None else None,
            }
            for log in sess.get("logs", [])
        ]
        out.append(
            {
                "date": sess_date.isoformat(),
                "notes": sess.get("notes") or None,
                "impression": sess.get("impression"),
                "logs": logs,
            }
        )
    return out


def payload_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, default=str, ensure_ascii=False)
