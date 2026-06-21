"""Token-size reduction for Garmin payloads."""

from copy import deepcopy
from datetime import datetime
from typing import Any

HistoryCompression = str  # weekly_aggregates | stripped | monthly_aggregates
WeekCompression = str  # full | downsampled | structured | compact


def _strip_time_series(obj: Any) -> Any:
    """Remove long intra-day series while keeping summary fields."""
    if isinstance(obj, dict):
        cleaned = {}
        for k, v in obj.items():
            if k in ("values", "samples", "data", "timeSeries", "stressValuesArray", "heartRateValues"):
                continue
            if isinstance(v, list) and len(v) > 30:
                continue
            cleaned[k] = _strip_time_series(v)
        return cleaned
    if isinstance(obj, list) and len(obj) > 30:
        return _downsample_list(obj, 30)
    return obj


def _compress_daily_health(entry: dict[str, Any], level: WeekCompression) -> dict[str, Any]:
    if level == "full":
        return entry
    slim = deepcopy(entry)
    for key in ("stress", "heart_rates", "steps", "body_battery", "body_battery_events"):
        if key in slim:
            slim[key] = _strip_time_series(slim.get(key))
    if level == "compact":
        keep = (
            "date",
            "stats",
            "user_summary",
            "training_readiness",
            "training_status",
            "sleep",
            "hrv",
            "resting_hr",
        )
        slim = {k: slim[k] for k in keep if k in slim}
    return slim


def strip_large_fields(activity: dict[str, Any]) -> dict[str, Any]:
    """Remove nested blobs from activity summaries for token reduction."""
    cleaned = dict(activity)
    for key in ("metadataDTO", "eventType", "privacy", "ownerId"):
        cleaned.pop(key, None)
    return cleaned


def _downsample_list(items: list[Any], max_points: int) -> list[Any]:
    if len(items) <= max_points:
        return items
    if max_points <= 2:
        return items[:max_points]
    step = max(1, (len(items) - 1) // (max_points - 1))
    indices = sorted({0, *(range(0, len(items), step)), len(items) - 1})
    return [items[i] for i in indices[:max_points]]


def _truncate_long_lists(obj: Any, max_len: int = 120, depth: int = 0) -> Any:
    if depth > 25:
        return obj
    if isinstance(obj, list):
        sampled = _downsample_list(obj, max_len) if len(obj) > max_len else obj
        return [_truncate_long_lists(x, max_len, depth + 1) for x in sampled]
    if isinstance(obj, dict):
        return {k: _truncate_long_lists(v, max_len, depth + 1) for k, v in obj.items()}
    return obj


def _strip_raw_series(details: dict[str, Any] | None) -> dict[str, Any] | None:
    """Keep summary metrics; drop bulky raw GPS/chart arrays from activity details."""
    if not details or not isinstance(details, dict):
        return details

    cleaned = deepcopy(details)
    for key in (
        "geoPolylineDTO",
        "polyline",
        "chartData",
        "chartDTO",
        "metricDTOs",
        "metrics",
        "samples",
    ):
        cleaned.pop(key, None)

    # Nested activity detail payloads often store series under activityDetailMetrics
    if "activityDetailMetrics" in cleaned and isinstance(cleaned["activityDetailMetrics"], list):
        metrics = []
        for m in cleaned["activityDetailMetrics"]:
            if not isinstance(m, dict):
                continue
            slim = {k: v for k, v in m.items() if k not in ("values", "chartData", "samples")}
            metrics.append(slim)
        cleaned["activityDetailMetrics"] = metrics

    return cleaned


def compress_week(week_full: dict[str, Any], level: WeekCompression) -> dict[str, Any]:
    if level == "full":
        return week_full

    compressed = deepcopy(week_full)
    details_out = []

    for entry in compressed.get("activity_details", []):
        if level == "downsampled":
            slim = deepcopy(entry)
            if slim.get("details"):
                slim["details"] = _truncate_long_lists(slim["details"], max_len=120)
            details_out.append(slim)
        elif level == "structured":
            slim = deepcopy(entry)
            slim["details"] = _strip_raw_series(slim.get("details"))
            details_out.append(slim)
        elif level == "compact":
            slim = {
                "activity_id": entry.get("activity_id"),
                "summary": entry.get("summary"),
                "splits": entry.get("splits"),
                "weather": entry.get("weather"),
                "hr_zones": entry.get("hr_zones"),
                "gear": entry.get("gear"),
                "training_effect": entry.get("training_effect"),
            }
            details_out.append(slim)
        else:
            details_out.append(entry)

    compressed["activity_details"] = details_out
    compressed["daily_health"] = [
        _compress_daily_health(d, level) for d in compressed.get("daily_health", [])
    ]
    if level in ("structured", "compact"):
        compressed.pop("activities", None)
    compressed["week_compression_applied"] = level
    return compressed


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


def _activity_iso_week(activity: dict[str, Any]) -> str:
    start = activity.get("startTimeLocal") or activity.get("startTimeGMT") or ""
    if len(start) < 10:
        return "unknown"
    dt = datetime.strptime(start[:10], "%Y-%m-%d")
    iso = dt.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def weekly_sport_aggregates(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compress history to ISO-week per-sport aggregates (ideal for 8-week lookback)."""
    buckets: dict[tuple[str, str], dict[str, Any]] = {}

    for act in activities:
        week = _activity_iso_week(act)
        sport = (act.get("activityType") or {}).get("typeKey", "unknown")
        key = (week, sport)

        if key not in buckets:
            buckets[key] = {
                "week": week,
                "sport": sport,
                "count": 0,
                "total_distance_m": 0.0,
                "total_duration_s": 0.0,
                "total_elevation_m": 0.0,
                "avg_hr_sum": 0.0,
                "avg_hr_count": 0,
                "max_hr": None,
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
        max_hr = act.get("maxHR")
        if max_hr:
            b["max_hr"] = max(b["max_hr"] or 0, int(max_hr))

    result = []
    for b in buckets.values():
        if b["avg_hr_count"]:
            b["avg_hr"] = round(b["avg_hr_sum"] / b["avg_hr_count"], 1)
        else:
            b["avg_hr"] = None
        del b["avg_hr_sum"]
        del b["avg_hr_count"]
        result.append(b)

    return sorted(result, key=lambda x: (x["week"], x["sport"]))
