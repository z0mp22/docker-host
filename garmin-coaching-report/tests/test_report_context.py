"""Tests for report_context.py: what the weekly report carries over from
last week, the athlete's own notes, and the forecast. Every part must fail
soft: a missing or broken input leaves the report running without it."""

import json
from datetime import date

from coaching_report import report_context as rc
from coaching_report.coach import _prepare_user_content, _split_user_content

OLD_FORMAT = """# Weekly Coaching Report — Monday, Nov 2, 2026

---

## Executive Summary — Top Priorities for Tue Nov 3 – Mon Nov 9

- **Keep Tuesday's gym climb**
- Protect Sunday

---

## Recovery & Readiness

Lots of numbers.

## By Sport

### Indoor Climbing
Per-activity recap.

## Action Plan — Tue Nov 3 through Mon Nov 9

| Day | Session |
|---|---|
| **Sun Nov 8** | **Protect this day** |

### Coach's Note for the Week

Lock-offs are the bottleneck.
---

## Run metadata

| Metric | Value |
|--------|-------|
| Model | claude-sonnet-4-6 |
"""

NEW_FORMAT = """# Week of Tue Nov 10

## The one thing
Sleep is the limiter.

## What the week showed
Stuff.

## This week
| Day | Session |

## Questions for you
Did the shoulder bother you on Friday?
"""


def test_previous_report_keeps_the_plan_and_drops_the_recap(tmp_path):
    (tmp_path / "mountain-sports-coaching-2026-11-02.md").write_text(OLD_FORMAT)
    prev = rc.previous_report(tmp_path, date(2026, 11, 9))
    assert prev["report_date"] == "2026-11-02" and prev["weekday"] == "Monday"
    text = prev["excerpt"]
    assert "Keep Tuesday's gym climb" in text and "Protect this day" in text
    assert "Lock-offs are the bottleneck" in text  # the coach's note lives under the plan heading
    assert "Per-activity recap" not in text and "Lots of numbers" not in text
    assert "claude-sonnet" not in text


def test_previous_report_reads_the_new_format_and_picks_the_latest_earlier_one(tmp_path):
    (tmp_path / "mountain-sports-coaching-2026-11-02.md").write_text(OLD_FORMAT)
    (tmp_path / "mountain-sports-coaching-2026-11-09.md").write_text(NEW_FORMAT)
    (tmp_path / "mountain-sports-coaching-2026-11-16.md").write_text(NEW_FORMAT)  # today's, rerun
    prev = rc.previous_report(tmp_path, date(2026, 11, 16))
    assert prev["report_date"] == "2026-11-09"
    assert "Sleep is the limiter" in prev["excerpt"] and "shoulder bother you" in prev["excerpt"]
    assert "Stuff." not in prev["excerpt"]


def test_no_previous_report(tmp_path):
    assert rc.previous_report(tmp_path, date(2026, 11, 9)) is None
    assert rc.previous_report(tmp_path / "missing", date(2026, 11, 9)) is None


def test_athlete_notes_use_local_dates_and_the_window(tmp_path):
    lines = [
        {"date": "2026-10-20T12:00:00+00:00", "note": "too old"},
        {"date": "2026-10-24T13:00:00-06:00", "note": "answer to last week's question"},
        {"date": "2026-10-28T02:30:00+00:00", "note": "Felt easy."},  # Oct 27 evening in MT
        {"date": "2026-10-30T11:54:09+00:00", "note": "  "},
        {"date": "2026-11-03T15:00:00+00:00", "note": "after the report"},
    ]
    text = "\n".join(json.dumps(x) for x in lines) + "\nnot json\n{\"note\": \"no date\"}\n"
    (tmp_path / rc.FEEDBACK_LOG).write_text(text)
    notes = rc.athlete_notes(tmp_path, date(2026, 10, 26), date(2026, 11, 2), "America/Denver")
    assert [n["note"] for n in notes] == ["answer to last week's question", "Felt easy."]
    assert notes[1]["date"] == "2026-10-27" and notes[1]["weekday"] == "Tuesday" and notes[1]["time_mt"] == "20:30"


def test_athlete_notes_missing_log_is_empty(tmp_path):
    assert rc.athlete_notes(tmp_path, date(2026, 10, 26), date(2026, 11, 2), "America/Denver") == []


PLAN_DAYS = [{"date": "2026-11-03", "label": "Tue Nov 3"}, {"date": "2026-11-04", "label": "Wed Nov 4"}]


def test_forecast_maps_plan_days_with_worst_aqi(monkeypatch):
    def fake(url, params):
        if url == rc.FORECAST_URL:
            return {"daily": {
                "time": ["2026-11-02", "2026-11-03", "2026-11-04"],
                "weather_code": [0, 71, 3], "temperature_2m_max": [60, 38.5, 55],
                "temperature_2m_min": [30, 25, 28], "precipitation_probability_max": [0, 70, 5],
                "precipitation_sum": [0, 0.2, 0], "snowfall_sum": [0, 1.4, 0],
                "wind_speed_10m_max": [5, 12, 6], "wind_gusts_10m_max": [9, 25, 10],
                "sunset": ["2026-11-02T16:55", "2026-11-03T16:54", "2026-11-04T16:53"],
            }}
        return {"hourly": {"time": ["2026-11-03T01:00", "2026-11-03T15:00", "2026-11-04T09:00"], "us_aqi": [20, 61, None]}}

    monkeypatch.setattr(rc, "_get_json", fake)
    out = rc.forecast(40.6, -105.1, PLAN_DAYS, "America/Denver")
    assert [d["date"] for d in out] == ["2026-11-03", "2026-11-04"]
    assert out[0] == {**out[0], "label": "Tue Nov 3", "conditions": "light snow", "high_f": 38.5, "snow_in": 1.4,
                      "sunset_mt": "16:54", "max_us_aqi": 61}
    assert out[1]["max_us_aqi"] is None


def test_forecast_failure_is_none_and_aqi_failure_keeps_weather(monkeypatch):
    def boom(url, params):
        raise OSError("no network")

    monkeypatch.setattr(rc, "_get_json", boom)
    assert rc.forecast(40.6, -105.1, PLAN_DAYS, "America/Denver") is None

    def weather_only(url, params):
        if url == rc.AQI_URL:
            raise OSError("aqi down")
        return {"daily": {"time": ["2026-11-03"], "weather_code": [0], "temperature_2m_max": [60]}}

    monkeypatch.setattr(rc, "_get_json", weather_only)
    out = rc.forecast(40.6, -105.1, PLAN_DAYS, "America/Denver")
    assert out[0]["conditions"] == "clear" and out[0]["max_us_aqi"] is None and out[0]["low_f"] is None


def test_new_context_reaches_claude_outside_the_cached_block():
    payload = {
        "report_date": "2026-11-09", "week_full": {"range": {}, "activity_details": [], "daily_health": []},
        "history_summaries": [], "history_range": {},
        "previous_report": {"report_date": "2026-11-02", "excerpt": "x"},
        "athlete_notes": [{"note": "Felt easy."}], "forecast": [{"date": "2026-11-10"}],
    }
    content = _prepare_user_content(payload, "weekly_aggregates", "compact")
    cached, dynamic = _split_user_content(content)
    for key in ("previous_report", "athlete_notes", "forecast"):
        assert dynamic[key] == payload[key]
        assert key not in cached
