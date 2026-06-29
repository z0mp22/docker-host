"""Token-size reduction for Garmin payloads."""

from copy import deepcopy
from datetime import datetime
from typing import Any

from .timezone_util import (
    DEFAULT_ATHLETE_TIMEZONE,
    activity_time_fields,
    sleep_time_fields,
    slim_weather,
    unwrap_activity_summary,
)

HistoryCompression = str  # weekly_aggregates | stripped | monthly_aggregates
WeekCompression = str  # full | downsampled | structured | compact


def _athlete_context(week_full: dict[str, Any]) -> dict[str, Any]:
    ctx = week_full.get("athlete_context")
    return ctx if isinstance(ctx, dict) else {}


def _m_to_ft(meters: Any) -> int | None:
    """Convert meters to whole feet (elevation/altitude reported in feet)."""
    try:
        return round(float(meters) * 3.28084)
    except (TypeError, ValueError):
        return None


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


def _slim_sleep(sleep: Any) -> Any:
    if not isinstance(sleep, dict):
        return sleep
    slim = dict(sleep)
    for key in ("sleepMovement", "sleepMovements", "sleepLevels", "sleepLevelsMap"):
        slim.pop(key, None)
    dto = slim.get("dailySleepDTO")
    if isinstance(dto, dict):
        slim["dailySleepDTO"] = {
            k: v
            for k, v in dto.items()
            if k not in ("sleepMovement", "sleepLevels", "sleepLevelsMap")
        }
    return slim


def _extract_sleep_summary(sleep: Any, tz_name: str) -> dict[str, Any] | None:
    if not isinstance(sleep, dict):
        return None
    dto = sleep.get("dailySleepDTO") or sleep
    if not isinstance(dto, dict):
        return None
    scores = dto.get("sleepScores") or {}
    overall = scores.get("overall") or {}
    times = sleep_time_fields(sleep, tz_name)
    return {
        **times,
        "sleep_seconds": dto.get("sleepTimeSeconds"),
        "awake_count": dto.get("awakeCount"),
        "deep_seconds": dto.get("deepSleepSeconds"),
        "light_seconds": dto.get("lightSleepSeconds"),
        "rem_seconds": dto.get("remSleepSeconds"),
        "awake_seconds": dto.get("awakeSleepSeconds"),
        "sleep_score": overall.get("value") if isinstance(overall, dict) else overall,
        "qualifier": overall.get("qualifierKey") if isinstance(overall, dict) else None,
    }


def _extract_hrv_summary(hrv: Any) -> dict[str, Any] | None:
    if not isinstance(hrv, dict):
        return None
    summary = hrv.get("hrvSummary") or hrv
    if not isinstance(summary, dict):
        return {"status": hrv.get("status"), "weekly_avg": hrv.get("weeklyAvg")}
    return {
        k: summary.get(k)
        for k in (
            "status",
            "weeklyAvg",
            "lastNightAvg",
            "lastNight5MinHigh",
            "baselineLowUpper",
            "baselineHighLower",
        )
        if k in summary
    }


def _extract_readiness_summary(readiness: Any) -> dict[str, Any] | None:
    if not isinstance(readiness, dict):
        return None
    return {
        k: readiness.get(k)
        for k in (
            "score",
            "level",
            "feedbackShort",
            "sleepScore",
            "hrvScore",
            "recoveryTime",
            "recoveryTimeUnit",
        )
        if k in readiness
    }


def _extract_body_battery_summary(bb: Any) -> dict[str, Any] | None:
    if not isinstance(bb, list) or not bb:
        return None
    values = []
    for entry in bb[:1]:
        if isinstance(entry, dict) and isinstance(entry.get("bodyBatteryValuesArray"), list):
            arr = entry["bodyBatteryValuesArray"]
            if len(arr) >= 3:
                values = [arr[i] for i in range(2, len(arr), 3)]
    if not values:
        return None
    return {"high": max(values), "low": min(values), "end": values[-1]}


def _extract_resting_hr_summary(rhr: Any) -> Any:
    if isinstance(rhr, dict):
        return rhr.get("restingHeartRate") or rhr.get("value") or rhr
    return rhr


def _compress_daily_health(
    entry: dict[str, Any], level: WeekCompression, tz_name: str
) -> dict[str, Any]:
    if level == "full":
        return entry
    if level == "compact":
        return {
            "date": entry.get("date"),
            "sleep": _extract_sleep_summary(entry.get("sleep"), tz_name),
            "hrv": _extract_hrv_summary(entry.get("hrv")),
            "resting_hr": _extract_resting_hr_summary(entry.get("resting_hr")),
            "body_battery": _extract_body_battery_summary(entry.get("body_battery")),
            "training_readiness": _extract_readiness_summary(entry.get("training_readiness")),
            "training_status": _extract_readiness_summary(entry.get("training_status"))
            if isinstance(entry.get("training_status"), dict)
            else entry.get("training_status"),
            "stats": _slim_stats(entry.get("stats")),
        }

    slim = deepcopy(entry)
    if slim.get("sleep"):
        slim["sleep"] = _slim_sleep(slim["sleep"])
    if slim.get("body_battery"):
        slim["body_battery"] = _strip_time_series(slim.get("body_battery"))
    for key in ("stress", "heart_rates", "steps", "body_battery_events"):
        if key in slim:
            slim[key] = _strip_time_series(slim.get(key))
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


def _slim_summary(summary: Any, tz_name: str) -> Any:
    flat = unwrap_activity_summary(summary)
    if not flat:
        return summary if not isinstance(summary, dict) else None

    keep = (
        "activityId",
        "activityName",
        "activityType",
        "distance",
        "duration",
        "elapsedDuration",
        "averageHR",
        "maxHR",
        "calories",
        "averageSpeed",
        "maxSpeed",
        "averagePower",
        "maxPower",
        "normalizedPower",
        "averageRunCadence",
        "maxRunCadence",
        "aerobicTrainingEffect",
        "anaerobicTrainingEffect",
        "trainingEffectLabel",
        "vO2MaxValue",
        "locationName",
    )
    slim = {k: flat[k] for k in keep if k in flat}
    slim.update(activity_time_fields(summary, tz_name))

    for src, dst in (("elevationGain", "elevation_gain_ft"), ("maxElevation", "max_elevation_ft")):
        if flat.get(src) is not None:
            ft = _m_to_ft(flat[src])
            if ft is not None:
                slim[dst] = ft

    for temp_key in ("minTemperature", "maxTemperature"):
        if temp_key in flat and flat[temp_key] is not None:
            slim[f"{temp_key}_c"] = flat[temp_key]

    return slim


def _slim_splits(splits: Any) -> Any:
    if not isinstance(splits, dict):
        return splits
    laps = splits.get("lapDTOs") or splits.get("laps") or []
    slim_laps = []
    for lap in laps[:50]:
        if not isinstance(lap, dict):
            continue
        slim_lap = {
            k: lap[k]
            for k in (
                "startTimeGMT",
                "distance",
                "duration",
                "averageHR",
                "maxHR",
                "averageSpeed",
                "averagePower",
            )
            if k in lap
        }
        if lap.get("elevationGain") is not None:
            ft = _m_to_ft(lap["elevationGain"])
            if ft is not None:
                slim_lap["elevation_gain_ft"] = ft
        slim_laps.append(slim_lap)
    return {"lap_count": len(laps), "laps": slim_laps}


def _slim_hrv(hrv: Any) -> Any:
    if not isinstance(hrv, dict):
        return hrv
    return {k: v for k, v in hrv.items() if k not in ("hrvValues", "values", "samples")}


def _slim_stats(stats: Any) -> Any:
    if not isinstance(stats, dict):
        return stats
    drop = ("calendarDate",)
    return {k: v for k, v in stats.items() if k not in drop and not isinstance(v, list)}


def _slim_activity_compact(
    entry: dict[str, Any], tz_name: str, unit_system: str
) -> dict[str, Any]:
    return {
        "activity_id": entry.get("activity_id"),
        "summary": _slim_summary(entry.get("summary"), tz_name),
        "splits": _slim_splits(entry.get("splits")),
        "hr_zones": entry.get("hr_zones"),
        "weather": slim_weather(entry.get("weather"), unit_system),
        "training_effect": _strip_time_series(entry.get("training_effect")),
    }


def compress_week(week_full: dict[str, Any], level: WeekCompression) -> dict[str, Any]:
    if level == "full":
        return week_full

    ctx = _athlete_context(week_full)
    tz_name = ctx.get("timezone") or DEFAULT_ATHLETE_TIMEZONE
    unit_system = ctx.get("unit_system") or "metric"

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
            details_out.append(_slim_activity_compact(entry, tz_name, unit_system))
        else:
            details_out.append(entry)

    compressed["activity_details"] = details_out
    compressed["daily_health"] = [
        _compress_daily_health(d, level, tz_name)
        for d in compressed.get("daily_health", [])
    ]
    if level in ("structured", "compact"):
        compressed.pop("activities", None)
    compressed.pop("athlete_context", None)
    compressed["week_compression_applied"] = level
    return compressed


def monthly_sport_aggregates(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compress history to monthly per-sport aggregates."""
    buckets: dict[tuple[str, str], dict[str, Any]] = {}

    for act in activities:
        start = _activity_start_date(act)
        month = start[:7] if len(start) >= 7 else "unknown"
        sport = (unwrap_activity_summary(act).get("activityType") or {}).get(
            "typeKey", "unknown"
        )
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
        flat = unwrap_activity_summary(act)
        b["total_distance_m"] += float(flat.get("distance") or act.get("distance") or 0)
        b["total_duration_s"] += float(flat.get("duration") or act.get("duration") or 0)
        b["total_elevation_m"] += float(
            flat.get("elevationGain") or act.get("elevationGain") or 0
        )
        avg_hr = flat.get("averageHR") or act.get("averageHR")
        if avg_hr:
            b["avg_hr_sum"] += float(avg_hr)
            b["avg_hr_count"] += 1

    result = []
    for b in buckets.values():
        if b["avg_hr_count"]:
            b["avg_hr"] = round(b["avg_hr_sum"] / b["avg_hr_count"], 1)
        else:
            b["avg_hr"] = None
        b["total_elevation_ft"] = _m_to_ft(b["total_elevation_m"]) or 0
        del b["total_elevation_m"]
        del b["avg_hr_sum"]
        del b["avg_hr_count"]
        result.append(b)

    return sorted(result, key=lambda x: (x["month"], x["sport"]))


def _activity_start_date(activity: dict[str, Any]) -> str:
    flat = unwrap_activity_summary(activity)
    start = flat.get("startTimeLocal") or flat.get("startTimeGMT") or ""
    return start[:10] if len(start) >= 10 else ""


def _activity_iso_week(activity: dict[str, Any]) -> str:
    start = _activity_start_date(activity)
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
        flat = unwrap_activity_summary(act)
        sport = (flat.get("activityType") or act.get("activityType") or {}).get(
            "typeKey", "unknown"
        )
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
        b["total_distance_m"] += float(flat.get("distance") or act.get("distance") or 0)
        b["total_duration_s"] += float(flat.get("duration") or act.get("duration") or 0)
        b["total_elevation_m"] += float(
            flat.get("elevationGain") or act.get("elevationGain") or 0
        )
        avg_hr = flat.get("averageHR") or act.get("averageHR")
        if avg_hr:
            b["avg_hr_sum"] += float(avg_hr)
            b["avg_hr_count"] += 1
        max_hr = flat.get("maxHR") or act.get("maxHR")
        if max_hr:
            b["max_hr"] = max(b["max_hr"] or 0, int(max_hr))

    result = []
    for b in buckets.values():
        if b["avg_hr_count"]:
            b["avg_hr"] = round(b["avg_hr_sum"] / b["avg_hr_count"], 1)
        else:
            b["avg_hr"] = None
        b["total_elevation_ft"] = _m_to_ft(b["total_elevation_m"]) or 0
        del b["total_elevation_m"]
        del b["avg_hr_sum"]
        del b["avg_hr_count"]
        result.append(b)

    return sorted(result, key=lambda x: (x["week"], x["sport"]))
