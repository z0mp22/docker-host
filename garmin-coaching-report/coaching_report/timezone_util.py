"""Normalize Garmin timestamps to the athlete's timezone (Mountain Time)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

DEFAULT_ATHLETE_TIMEZONE = "America/Denver"


def athlete_tz_name(config_tz: str | None = None) -> str:
    return (config_tz or DEFAULT_ATHLETE_TIMEZONE).strip() or DEFAULT_ATHLETE_TIMEZONE


def format_datetime(dt: datetime, tz_name: str) -> str:
    localized = dt.astimezone(ZoneInfo(tz_name))
    return localized.strftime("%Y-%m-%d %a %H:%M %Z")


def _parse_iso(value: str) -> datetime | None:
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    if text.endswith(".0"):
        text = text[:-2]
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def format_iso_to_tz(
    value: Any,
    tz_name: str,
    *,
    assume_local: bool = False,
) -> str | None:
    """Format a Garmin ISO timestamp in the athlete timezone."""
    if value is None:
        return None
    if isinstance(value, dict):
        for key in ("iso", "formatted", "date"):
            if key in value:
                return format_iso_to_tz(value[key], tz_name, assume_local=assume_local)
        return None
    if not isinstance(value, str):
        return None

    dt = _parse_iso(value)
    if dt is None:
        return None

    if assume_local:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo(tz_name))
        else:
            dt = dt.astimezone(ZoneInfo(tz_name))
    else:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("UTC"))
        dt = dt.astimezone(ZoneInfo(tz_name))

    return format_datetime(dt, tz_name)


def format_epoch_ms_to_tz(value: Any, tz_name: str) -> str | None:
    """Format Garmin epoch-millisecond timestamps (UTC-based) in athlete TZ."""
    if value is None:
        return None
    try:
        ms = int(value)
    except (TypeError, ValueError):
        return None
    dt = datetime.fromtimestamp(ms / 1000, tz=ZoneInfo("UTC"))
    return format_datetime(dt, tz_name)


def unwrap_activity_summary(summary: Any) -> dict[str, Any]:
    """Flatten nested Garmin activity payloads (summaryDTO, activityTypeDTO)."""
    if not isinstance(summary, dict):
        return {}

    flat = dict(summary)
    dto = summary.get("summaryDTO")
    if isinstance(dto, dict):
        for key, value in dto.items():
            if key not in flat or flat[key] is None:
                flat[key] = value

    type_dto = summary.get("activityTypeDTO") or summary.get("activityType")
    if isinstance(type_dto, dict):
        flat.setdefault("activityType", type_dto)

    return flat


def activity_time_fields(summary: Any, tz_name: str) -> dict[str, str | None]:
    """Explicit MT start/end labels for coaching (never pass raw GMT alone)."""
    flat = unwrap_activity_summary(summary)
    start_local = flat.get("startTimeLocal")
    start_gmt = flat.get("startTimeGMT")
    duration_s = flat.get("duration") or flat.get("elapsedDuration")

    start_mt = format_iso_to_tz(start_local, tz_name, assume_local=True)
    if start_mt is None and start_gmt:
        start_mt = format_iso_to_tz(start_gmt, tz_name, assume_local=False)

    end_mt = format_iso_to_tz(flat.get("endTimeLocal"), tz_name, assume_local=True)
    if end_mt is None and start_mt and duration_s:
        start_dt = _parse_iso(str(start_local or start_gmt or ""))
        if start_dt:
            if start_local and start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=ZoneInfo(tz_name))
            elif start_gmt and start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(
                    ZoneInfo(tz_name)
                )
            from datetime import timedelta

            end_mt = format_datetime(start_dt + timedelta(seconds=float(duration_s)), tz_name)

    return {"start_at_mt": start_mt, "end_at_mt": end_mt}


def sleep_time_fields(sleep: Any, tz_name: str) -> dict[str, str | None]:
    """Bed/wake times in MT from Garmin sleep DTO epoch fields."""
    if not isinstance(sleep, dict):
        return {"bedtime_mt": None, "wake_time_mt": None}

    dto = sleep.get("dailySleepDTO") or sleep
    if not isinstance(dto, dict):
        return {"bedtime_mt": None, "wake_time_mt": None}

    return {
        "bedtime_mt": format_epoch_ms_to_tz(dto.get("sleepStartTimestampGMT"), tz_name),
        "wake_time_mt": format_epoch_ms_to_tz(dto.get("sleepEndTimestampGMT"), tz_name),
    }


def slim_weather(weather: Any, unit_system: str = "metric") -> Any:
    """Keep activity weather with explicit units (Garmin stores °C)."""
    if not isinstance(weather, dict):
        return weather

    temp_c = weather.get("temp") or weather.get("temperature")
    if temp_c is None:
        for key in ("tempMax", "tempMin", "temperatureMax", "temperatureMin"):
            if weather.get(key) is not None:
                temp_c = weather.get(key)
                break

    slim: dict[str, Any] = {}
    if temp_c is not None:
        try:
            c = float(temp_c)
            slim["temp_c"] = round(c, 1)
            if unit_system == "imperial":
                slim["temp_f"] = round(c * 9 / 5 + 32, 1)
        except (TypeError, ValueError):
            pass

    for key in ("condition", "weatherType", "windSpeed", "humidity"):
        if weather.get(key) is not None:
            slim[key] = weather.get(key)

    if slim:
        slim["note"] = "Activity-time conditions only (not bedroom/evening ambient)"
    return slim or None
