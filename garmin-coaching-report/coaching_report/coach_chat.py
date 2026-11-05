"""Mid-week with the weekly coach: replies, answers, day check-offs.

Run by scripts/run-coach.sh (from the `Coach` GitHub workflow that Home
Assistant dispatches, or from cron for the nightly check). One run, one job,
chosen by COACH_MODE:

- message: you wrote to the coach (COACH_TEXT; COACH_REF is a plan date when
  it's about one day, e.g. "Changed: did a road ride instead").
- answer: you answered a question from the debrief (COACH_REF is its id).
- day: you marked a plan day done or skipped (COACH_REF date, COACH_VALUE).
  No Claude call.
- check: the nightly pass that marks past plan days from Garmin and Hevy.
  No Claude call.

message and answer save what you said first, then ask Claude for a reply and
any plan changes, then save those. COACH_CID is the panel's id for the
message, so a retry never adds it twice. Everything outside the state file
(Garmin, Hevy, forecast) is optional: without it the coach still replies.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import anthropic

from .collector import _collect_lift_history, collect_history_summaries, collect_recent_health
from .compression import compress_week
from .config import load_app_config
from .debrief import (
    CoachReplySchema,
    append_feedback_note,
    apply_plan_changes,
    check_days,
    load_state,
    locked_state,
    now_iso,
)
from .garmin_auth import connect_with_tokens
from .prompts import load_chat_prompt
from .report_context import athlete_notes, forecast
from .timezone_util import athlete_tz_name

MODES = ("message", "answer", "day", "check")
DAY_VALUES = ("done", "skipped")
MAX_TEXT = 600
REPLY_MAX_TOKENS = 1500


def _log(msg: str) -> None:
    print(f"[coach] {msg}", file=sys.stderr)


def _activity_brief(a: dict[str, Any]) -> dict[str, Any]:
    meters = float(a.get("distance") or 0)
    gain = float(a.get("elevationGain") or 0)
    return {
        "name": a.get("activityName"),
        "type": ((a.get("activityType") or {}).get("typeKey")),
        "start_mt": a.get("startTimeLocal"),
        "minutes": round(float(a.get("duration") or 0) / 60),
        "distance_mi": round(meters / 1609.34, 1) if meters else None,
        "elevation_gain_ft": round(gain * 3.28084) if gain else None,
        "avg_hr": a.get("averageHR"),
        "aerobic_te": a.get("aerobicTrainingEffect"),
    }


def _logs_since(config, start: date, end: date, garmin_client) -> tuple[list[dict], list[dict], list[dict]]:
    """(Garmin activity summaries, Hevy sessions, compact recovery), each
    empty when its source is unavailable."""
    activities: list[dict] = []
    recovery: list[dict] = []
    if garmin_client is not None:
        try:
            activities = collect_history_summaries(garmin_client, start, end)
        except Exception as exc:
            _log(f"Garmin activities unavailable: {exc}")
        try:
            raw = collect_recent_health(garmin_client, days=2)
            recovery = compress_week(
                {"athlete_context": {"timezone": athlete_tz_name(config.athlete_timezone)},
                 "activity_details": [], "daily_health": raw},
                "compact",
            )["daily_health"]
        except Exception as exc:
            _log(f"Garmin recovery unavailable: {exc}")
    try:
        lifts = _collect_lift_history(config, start, end) or []
    except Exception as exc:
        _log(f"Hevy unavailable: {exc}")
        lifts = []
    return activities, lifts, recovery


def _garmin(config):
    try:
        return connect_with_tokens(config.garmin)
    except Exception as exc:
        _log(f"Garmin login failed, continuing without it: {exc}")
        return None


def _record_message(reports_dir, mode: str, text: str, ref: str, cid: str) -> dict[str, Any] | None:
    """Save what he said; returns the athlete message (existing one on a retry)."""
    with locked_state(reports_dir) as state:
        if state is None:
            return None
        thread = state.setdefault("thread", [])
        existing = next((m for m in thread if cid and m.get("cid") == cid and m["role"] == "athlete"), None)
        if existing:
            return existing
        msg: dict[str, Any] = {"id": f"m{len(thread) + 1}", "role": "athlete", "text": text, "at": now_iso(), "cid": cid or None}
        if mode == "answer":
            q = next((q for q in state["debrief"].get("questions", []) if q["id"] == ref), None)
            if q:
                msg["answers"] = ref
                state.setdefault("answers", {})[ref] = {"text": text, "at": msg["at"]}
        elif ref:
            row = next((r for r in state["plan"] if r["date"] == ref), None)
            if row:
                msg["about_day"] = ref
                row.update({"status": "changed", "status_source": "athlete", "status_note": text})
        thread.append(msg)
        state["updated_at"] = now_iso()
    append_feedback_note(reports_dir, text)
    return msg


def _reply(config, state: dict[str, Any], msg: dict[str, Any], now: datetime) -> tuple[CoachReplySchema, dict]:
    tz = athlete_tz_name(config.athlete_timezone)
    window_end = date.fromisoformat((state.get("window") or {}).get("end") or state["report_date"])
    today = now.date()
    client = _garmin(config)
    activities, lifts, recovery = _logs_since(config, window_end + timedelta(days=1), today, client)
    remaining = [{"date": r["date"], "weekday": r["weekday"], "label": r["label"]} for r in state["plan"] if r["date"] >= today.isoformat()]
    q = next((q for q in state["debrief"].get("questions", []) if q["id"] == msg.get("answers")), None)
    payload = {
        "today": today.isoformat(),
        "today_weekday": today.strftime("%A"),
        "now_mt": now.strftime("%Y-%m-%d %H:%M"),
        "week": {
            "week_label": state.get("week_label"),
            "debrief": state["debrief"],
            "plan": state["plan"],
            "answers": state.get("answers", {}),
        },
        "thread": [{k: m.get(k) for k in ("role", "text", "at")} for m in state.get("thread", []) if m is not msg and m.get("id") != msg.get("id")][-30:],
        "message": {
            "text": msg["text"],
            "answers": {"id": q["id"], "question": q["text"]} if q else None,
            "about_day": next(({"date": r["date"], "label": r["label"], "title": r["title"]} for r in state["plan"] if r["date"] == msg.get("about_day")), None),
        },
        "since_report": {
            "activities": [_activity_brief(a) for a in activities],
            "lifts": lifts,
            "recovery": recovery,
            "notes": athlete_notes(config.report_output_dir, window_end + timedelta(days=1), today, tz),
        },
        "forecast": forecast(config.forecast_lat, config.forecast_lon, remaining, tz) if remaining else None,
    }
    api = anthropic.Anthropic(api_key=config.anthropic_api_key)
    response = api.messages.parse(
        model=config.anthropic_model,
        max_tokens=REPLY_MAX_TOKENS,
        system=load_chat_prompt(),
        messages=[{"role": "user", "content": json.dumps(payload, default=str, ensure_ascii=False)}],
        output_format=CoachReplySchema,
    )
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise RuntimeError(f"coach reply incomplete (stop_reason={response.stop_reason})")
    usage = response.usage
    return response.parsed_output, {"model": config.anthropic_model, "input_tokens": usage.input_tokens, "output_tokens": usage.output_tokens}


def main() -> int:
    mode = os.environ.get("COACH_MODE", "").strip()
    text = " ".join(os.environ.get("COACH_TEXT", "").split())[:MAX_TEXT]
    ref = os.environ.get("COACH_REF", "").strip()
    value = os.environ.get("COACH_VALUE", "").strip()
    cid = os.environ.get("COACH_CID", "").strip()[:40]
    if mode not in MODES:
        _log(f"COACH_MODE must be one of {MODES}, got {mode!r}")
        return 1
    try:
        config = load_app_config()
    except ValueError as exc:
        _log(f"Configuration error: {exc}")
        return 1
    reports_dir = config.report_output_dir
    now = datetime.now(ZoneInfo(athlete_tz_name(config.athlete_timezone))).replace(tzinfo=None)

    if load_state(reports_dir) is None:
        _log("No weekly debrief yet; nothing to update")
        return 0 if mode == "check" else 1

    if mode == "day":
        if value not in DAY_VALUES:
            _log(f"COACH_VALUE must be one of {DAY_VALUES}")
            return 1
        with locked_state(reports_dir) as state:
            row = next((r for r in state["plan"] if r["date"] == ref), None)
            if row is None:
                _log(f"No plan day {ref!r}")
                return 1
            row.update({"status": value, "status_source": "athlete"})
            state["updated_at"] = now_iso()
        _log(f"{row['label']} marked {value}")
        return 0

    if mode == "check":
        state = load_state(reports_dir)
        start = date.fromisoformat(state["plan"][0]["date"])
        if start >= now.date():
            return 0
        activities, lifts, _ = _logs_since(config, start, now.date() - timedelta(days=1), _garmin(config))
        with locked_state(reports_dir) as state:
            changed = check_days(state, activities, lifts, now.date())
            if changed:
                state["updated_at"] = now_iso()
        _log(f"day check: {', '.join(changed) or 'no changes'}")
        return 0

    if not text:
        _log("COACH_TEXT is empty")
        return 1
    msg = _record_message(reports_dir, mode, text, ref, cid)
    if msg is None:
        return 1
    if any(m.get("re") == msg["id"] for m in load_state(reports_dir)["thread"]):
        _log("already replied to this message (a retry); nothing to do")
        return 0
    try:
        reply, meta = _reply(config, load_state(reports_dir), msg, now)
    except Exception as exc:
        _log(f"reply failed: {exc}")
        traceback.print_exc(file=sys.stderr)
        with locked_state(reports_dir) as state:
            for m in state["thread"]:
                if m.get("id") == msg["id"]:
                    m["reply_failed"] = True
            state["updated_at"] = now_iso()
        return 1

    with locked_state(reports_dir) as state:
        moved = apply_plan_changes(state, reply.plan_changes, now.date())
        for m in state["thread"]:
            if m.get("id") == msg["id"]:
                m.pop("reply_failed", None)
        at = now_iso()
        state["thread"].append({
            "id": f"m{len(state['thread']) + 1}", "role": "coach", "text": reply.reply.strip(), "at": at,
            "re": msg["id"], "plan_changes": moved, **meta,
        })
        state["last_coach_at"] = at
        state["updated_at"] = at
    _log(f"replied ({meta['input_tokens']} in / {meta['output_tokens']} out); plan changes: {', '.join(moved) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
