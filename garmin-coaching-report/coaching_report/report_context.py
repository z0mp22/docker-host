"""What a coach knows besides the watch: last week's report, the athlete's
own words, and the week's weather.

- previous_report: the parts of the last report that set expectations (the
  headline, the plan, the questions asked), so this week can say how that
  plan went instead of starting cold.
- athlete_notes: the feedback log the athlete writes from the Coach panel
  (lift_feedback_log.jsonl). It holds outdoor climbs with grades, yard work,
  how sessions felt, and answers to the report's questions. Read-only here,
  and read defensively: a bad log never fails the report.
- forecast: Open-Meteo daily forecast plus US AQI for the plan days, so the
  plan uses real weather instead of a seasonal guess. Open-Meteo needs no
  key; on any failure the report falls back to the seasonal heuristic.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from .debrief import load_state, previous_week

FEEDBACK_LOG = "lift_feedback_log.jsonl"
REPORT_GLOB = "mountain-sports-coaching-*.md"
# Sections of a past report worth carrying forward, by heading.
CARRY_HEADINGS = re.compile(r"one thing|executive summary|this week|action plan|questions|coach'?s note", re.I)
MAX_CARRY_CHARS = 6000
# Notes from a little before the window too: an answer to last week's
# questions is often written the day the report arrives.
NOTES_LEAD_DAYS = 3

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
HTTP_TIMEOUT_S = 15

# WMO weather codes, as Open-Meteo returns them.
WEATHER_CODES = {
    0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "freezing fog",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
    71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
    80: "rain showers", 81: "rain showers", 82: "heavy rain showers", 85: "snow showers", 86: "heavy snow showers",
    95: "thunderstorms", 96: "thunderstorms with hail", 99: "thunderstorms with hail",
}


def _warn(msg: str) -> None:
    print(f"[coaching-report] {msg}", file=sys.stderr)


# --- Last report -----------------------------------------------------------------


def _report_date(path: Path) -> date | None:
    m = re.search(r"(\d{4}-\d{2}-\d{2})\.md$", path.name)
    try:
        return date.fromisoformat(m.group(1)) if m else None
    except ValueError:
        return None


def _sections(markdown: str) -> list[tuple[str, str]]:
    """[(heading, body)] for every ## heading, in order."""
    out = []
    parts = re.split(r"^##\s+(.+)$", markdown, flags=re.M)
    for i in range(1, len(parts) - 1, 2):
        out.append((parts[i].strip(), parts[i + 1].strip().strip("-").strip()))
    return out


def previous_report(reports_dir: Path, report_date: date) -> dict[str, Any] | None:
    """Last week as the coach left it: the plan with what actually happened
    each day, the questions with your answers, and the conversation
    (weekly_coach.json). Before that file existed, the last markdown report
    cut to what it asked of the athlete. None when there is no earlier week."""
    state = load_state(reports_dir)
    if state and str(state.get("report_date") or "") < report_date.isoformat():
        return previous_week(state)
    try:
        reports = [(d, p) for p in reports_dir.glob(REPORT_GLOB) if (d := _report_date(p)) and d < report_date]
        if not reports:
            return None
        when, path = max(reports)
        text = path.read_text(encoding="utf-8").split("\n## Run metadata")[0]
    except OSError as exc:
        _warn(f"previous report unreadable, skipping: {exc}")
        return None
    kept = [f"## {h}\n{b}" for h, b in _sections(text) if CARRY_HEADINGS.search(h)]
    body = "\n\n".join(kept)[:MAX_CARRY_CHARS]
    return {"report_date": when.isoformat(), "weekday": when.strftime("%A"), "excerpt": body} if body else None


# --- The athlete's own words ------------------------------------------------------------


def athlete_notes(reports_dir: Path, since: date, through: date, tz_name: str) -> list[dict[str, Any]]:
    """Feedback-log entries written from NOTES_LEAD_DAYS before `since`
    through `through`, oldest first, each with its local date and weekday."""
    tz = ZoneInfo(tz_name)
    path = reports_dir / FEEDBACK_LOG
    try:
        lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    except OSError as exc:
        _warn(f"feedback log unreadable, skipping: {exc}")
        return []
    out = []
    for line in lines:
        try:
            entry = json.loads(line)
            stamp = datetime.fromisoformat(str(entry["date"]))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            continue
        local = stamp.astimezone(tz) if stamp.tzinfo else stamp
        if (since - local.date()).days > NOTES_LEAD_DAYS or local.date() > through:
            continue
        note = str(entry.get("note") or "").strip()
        # Messages to the weekly coach are in previous_report's conversation already.
        if note and entry.get("source") != "coach_chat":
            out.append({"date": local.date().isoformat(), "weekday": local.strftime("%A"),
                        "time_mt": local.strftime("%H:%M"), "note": note})
    return out


# --- Forecast -------------------------------------------------------------------------


def _get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    with urllib.request.urlopen(f"{url}?{urllib.parse.urlencode(params)}", timeout=HTTP_TIMEOUT_S) as resp:
        return json.load(resp)


def forecast(lat: float, lon: float, plan_days: list[dict[str, str]], tz_name: str) -> list[dict[str, Any]] | None:
    """One entry per plan day that the forecast covers, in °F / mph / inches,
    with the day's worst US AQI when the air-quality forecast reaches it."""
    wanted = {d["date"]: d for d in plan_days}
    try:
        daily = _get_json(FORECAST_URL, {
            "latitude": lat, "longitude": lon, "timezone": tz_name, "forecast_days": 9,
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
                     "precipitation_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,sunset",
            "temperature_unit": "fahrenheit", "wind_speed_unit": "mph", "precipitation_unit": "inch",
        })["daily"]
    except Exception as exc:  # network, HTTP or shape: fall back to the seasonal heuristic
        _warn(f"forecast unavailable, using seasonal heuristic: {exc}")
        return None
    aqi: dict[str, int] = {}
    try:
        hourly = _get_json(AQI_URL, {"latitude": lat, "longitude": lon, "timezone": tz_name,
                                     "forecast_days": 5, "hourly": "us_aqi"})["hourly"]
        for t, v in zip(hourly["time"], hourly["us_aqi"]):
            if v is not None:
                aqi[t[:10]] = max(aqi.get(t[:10], 0), int(v))
    except Exception as exc:
        _warn(f"AQI forecast unavailable: {exc}")

    out = []
    for i, day in enumerate(daily.get("time", [])):
        if day not in wanted:
            continue

        def val(key):
            vals = daily.get(key) or []
            return vals[i] if i < len(vals) else None

        out.append({
            "date": day,
            "label": wanted[day]["label"],
            "conditions": WEATHER_CODES.get(val("weather_code"), "unknown"),
            "high_f": val("temperature_2m_max"),
            "low_f": val("temperature_2m_min"),
            "precip_chance_pct": val("precipitation_probability_max"),
            "precip_in": val("precipitation_sum"),
            "snow_in": val("snowfall_sum"),
            "wind_mph": val("wind_speed_10m_max"),
            "gusts_mph": val("wind_gusts_10m_max"),
            "sunset_mt": (val("sunset") or "")[11:16] or None,
            "max_us_aqi": aqi.get(day),
        })
    return out or None
