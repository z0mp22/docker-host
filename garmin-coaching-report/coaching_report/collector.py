"""Pull Garmin Connect data for coaching analysis."""

import json
from datetime import date, timedelta
from typing import Any

from garmin_connect_mcp.client import GarminClientWrapper

from .errors import DataCollectionError


def _date_str(d: date) -> str:
    return d.isoformat()


def _safe(client: GarminClientWrapper, method: str, *args, **kwargs) -> Any:
    try:
        return client.safe_call(method, *args, **kwargs)
    except Exception:
        return None


def _collect_day_health(client: GarminClientWrapper, day: date) -> dict[str, Any]:
    ds = _date_str(day)
    return {
        "date": ds,
        "stats": _safe(client, "get_stats", ds),
        "user_summary": _safe(client, "get_user_summary", ds),
        "training_readiness": _safe(client, "get_training_readiness", ds),
        "training_status": _safe(client, "get_training_status", ds),
        "body_battery": _safe(client, "get_body_battery", ds, ds),
        "body_battery_events": _safe(client, "get_body_battery_events", ds),
        "sleep": _safe(client, "get_sleep_data", ds),
        "hrv": _safe(client, "get_hrv_data", ds),
        "resting_hr": _safe(client, "get_rhr_day", ds),
        "heart_rates": _safe(client, "get_heart_rates", ds),
        "stress": _safe(client, "get_stress_data", ds),
        "steps": _safe(client, "get_steps_data", ds),
    }


def _collect_activity_full(client: GarminClientWrapper, activity_id: int) -> dict[str, Any]:
    return {
        "activity_id": activity_id,
        "summary": _safe(client, "get_activity", activity_id),
        "details": _safe(client, "get_activity_details", activity_id, maxchart=2000, maxpoly=4000),
        "splits": _safe(client, "get_activity_splits", activity_id),
        "weather": _safe(client, "get_activity_weather", activity_id),
        "hr_zones": _safe(client, "get_activity_hr_in_timezones", activity_id),
        "gear": _safe(client, "get_activity_gear", activity_id),
        "training_effect": _safe(client, "get_training_effect", activity_id),
    }


def collect_week_full(client: GarminClientWrapper, week_end: date) -> dict[str, Any]:
    """Last 7 calendar days ending on week_end (inclusive)."""
    week_start = week_end - timedelta(days=6)
    start_s = _date_str(week_start)
    end_s = _date_str(week_end)

    try:
        activities = client.safe_call("get_activities_by_date", start_s, end_s, "") or []
    except Exception as exc:
        raise DataCollectionError(f"Failed to fetch week activities: {exc}") from exc

    daily_health = [_collect_day_health(client, week_start + timedelta(days=i)) for i in range(7)]

    activity_details = []
    for act in activities:
        act_id = act.get("activityId")
        if act_id is not None:
            activity_details.append(_collect_activity_full(client, int(act_id)))

    return {
        "range": {"start": start_s, "end": end_s},
        "activities": activities,
        "activity_details": activity_details,
        "daily_health": daily_health,
    }


def collect_history_summaries(
    client: GarminClientWrapper, history_start: date, history_end: date
) -> list[dict[str, Any]]:
    """Six months of activity list summaries (no per-activity GPS/time-series)."""
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


def strip_large_fields(activity: dict[str, Any]) -> dict[str, Any]:
    """Remove nested blobs from activity summaries for token reduction."""
    cleaned = dict(activity)
    for key in ("metadataDTO", "eventType", "privacy", "ownerId"):
        cleaned.pop(key, None)
    return cleaned


def monthly_sport_aggregates(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compress history to monthly per-sport aggregates."""
    buckets: dict[tuple[str, str], dict[str, Any]] = {}

    for act in activities:
        start = act.get("startTimeLocal") or act.get("startTimeGMT") or ""
        month = start[:7] if len(start) >= 7 else "unknown"
        sport = (act.get("activityType") or {}).get("typeKey", "unknown")
        key = (month, sport)

        if key not in buckets:
            buckets[key] = {
                "month": month,
                "sport": sport,
                "count": 0,
                "total_distance_m": 0.0,
                "total_duration_s": 0.0,
                "total_elevation_m": 0.0,
                "avg_hr_sum": 0.0,
                "avg_hr_count": 0,
            }

        b = buckets[key]
        b["count"] += 1
        b["total_distance_m"] += float(act.get("distance") or 0)
        b["total_duration_s"] += float(act.get("duration") or 0)
        b["total_elevation_m"] += float(act.get("elevationGain") or 0)
        avg_hr = act.get("averageHR")
        if avg_hr:
            b["avg_hr_sum"] += float(avg_hr)
            b["avg_hr_count"] += 1

    result = []
    for b in buckets.values():
        if b["avg_hr_count"]:
            b["avg_hr"] = round(b["avg_hr_sum"] / b["avg_hr_count"], 1)
        else:
            b["avg_hr"] = None
        del b["avg_hr_sum"]
        del b["avg_hr_count"]
        result.append(b)

    return sorted(result, key=lambda x: (x["month"], x["sport"]))


def build_payload(
    client: GarminClientWrapper,
    report_date: date | None = None,
) -> dict[str, Any]:
    """Build full coaching input payload."""
    today = report_date or date.today()
    # Monday report covers prior Mon–Sun; week ends yesterday when run Monday AM
    week_end = today - timedelta(days=1)
    week_start = week_end - timedelta(days=6)
    history_end = week_start - timedelta(days=1)
    history_start = history_end - timedelta(days=180)

    week_full = collect_week_full(client, week_end)
    history = collect_history_summaries(client, history_start, history_end)

    return {
        "report_date": _date_str(today),
        "week_full": week_full,
        "history_summaries": history,
        "history_range": {
            "start": _date_str(history_start),
            "end": _date_str(history_end),
        },
    }


def payload_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, default=str, ensure_ascii=False)
