#!/usr/bin/env python3
"""Backfill Garmin Move IQ (auto-detected) events as manual activities.

Move IQ events show grey in the Connect app and never become real activities,
so they are invisible to the training plan and the weekly coaching report
(which reads ``get_activities_by_date``). This script pulls the auto-detected
events for a day, drops the ones that are too short or already covered by a
real activity, and creates a plain manual activity for the rest.

A manual activity has no GPS/HR and does not add to daily step count or
training load -- it only makes the session show up in the activity log and
the coaching report.

Usage (inside the garmin-coaching-report image)::

    python backfill-moveiq.py                 # dry run, today
    python backfill-moveiq.py --commit        # actually create them
    python backfill-moveiq.py --date 2026-08-29 --commit
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any

from coaching_report.config import load_app_config
from coaching_report.garmin_auth import connect_with_tokens

# Move IQ activityType -> Garmin manual-activity typeKey + display label.
# Deliberately conservative: only movement we would want in the training log.
TYPE_MAP: dict[str, tuple[str, str]] = {
    "walking": ("walking", "Walk"),
    "running": ("running", "Run"),
    "cycling": ("cycling", "Ride"),
}

DEFAULT_MIN_MINUTES = 15

# Rough fallback speeds (km/h) if Garmin rejects a zero-distance activity.
FALLBACK_SPEED_KMH = {"walking": 4.8, "running": 9.0, "cycling": 18.0}


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    if text.endswith(".0"):
        text = text[:-2]
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _existing_windows(activities: list[dict[str, Any]]) -> list[tuple[datetime, datetime]]:
    """(start, end) UTC windows for activities already on the calendar."""
    windows: list[tuple[datetime, datetime]] = []
    for a in activities:
        if not isinstance(a, dict):
            continue
        start = _as_utc(_parse_iso(a.get("startTimeGMT")))
        if start is None and a.get("beginTimestamp"):
            try:
                start = datetime.fromtimestamp(int(a["beginTimestamp"]) / 1000, tz=timezone.utc)
            except (TypeError, ValueError):
                start = None
        if start is None:
            continue
        try:
            dur_s = float(a.get("duration") or a.get("elapsedDuration") or 0)
        except (TypeError, ValueError):
            dur_s = 0.0
        windows.append((start, start + timedelta(seconds=dur_s)))
    return windows


def _overlaps(a0: datetime, a1: datetime, b0: datetime, b1: datetime) -> bool:
    return a0 < b1 and b0 < a1


def _event_plan(event: dict[str, Any], min_minutes: int) -> dict[str, Any]:
    """Normalise one Move IQ event and decide if it is a candidate."""
    atype = str(event.get("activityType") or "").lower()
    start_gmt = _as_utc(_parse_iso(event.get("startTimestampGMT")))
    end_gmt = _as_utc(_parse_iso(event.get("endTimestampGMT")))
    start_local = _parse_iso(event.get("startTimestampLocal"))

    duration_min: float | None = None
    if start_gmt and end_gmt:
        duration_min = round((end_gmt - start_gmt).total_seconds() / 60)
    elif event.get("duration") is not None:
        try:
            duration_min = round(float(event["duration"]))
        except (TypeError, ValueError):
            duration_min = None

    plan: dict[str, Any] = {
        "activityType": atype,
        "start_local": start_local.strftime("%Y-%m-%dT%H:%M:%S.000") if start_local else None,
        "start_gmt": start_gmt,
        "end_gmt": end_gmt,
        "duration_min": duration_min,
        "moderate_min": event.get("moderateIntensityMinutes"),
        "vigorous_min": event.get("vigorousIntensityMinutes"),
        "skip_reason": None,
    }

    if atype not in TYPE_MAP:
        plan["skip_reason"] = f"activityType '{atype}' not in allowlist"
    elif duration_min is None:
        plan["skip_reason"] = "could not determine duration"
    elif duration_min < min_minutes:
        plan["skip_reason"] = f"{duration_min} min < {min_minutes} min threshold"
    elif not plan["start_local"]:
        plan["skip_reason"] = "missing local start timestamp"

    if atype in TYPE_MAP:
        plan["type_key"], plan["label"] = TYPE_MAP[atype]
    return plan


def _create(client: Any, plan: dict[str, Any], tz_name: str, name: str | None) -> dict[str, Any]:
    """Create the manual activity, retrying once with an estimated distance."""
    activity_name = name or f"{plan['label']} (Move IQ)"
    duration_min = int(plan["duration_min"])
    start_local = plan["start_local"]
    type_key = plan["type_key"]

    attempts = [0.0]
    speed = FALLBACK_SPEED_KMH.get(plan["activityType"])
    if speed:
        attempts.append(round(speed * duration_min / 60, 2))

    last_err: Exception | None = None
    for distance_km in attempts:
        try:
            res = client.safe_call(
                "create_manual_activity",
                start_local,
                tz_name,
                type_key,
                distance_km,
                duration_min,
                activity_name,
            )
            act_id = None
            if isinstance(res, dict):
                act_id = res.get("activityId") or (res.get("summaryDTO") or {}).get("activityId")
            return {
                "created": True,
                "activityId": act_id,
                "name": activity_name,
                "distance_km": distance_km,
                "url": f"https://connect.garmin.com/modern/activity/{act_id}" if act_id else None,
            }
        except Exception as exc:  # noqa: BLE001 - report and try fallback
            last_err = exc
    return {"created": False, "name": activity_name, "error": str(last_err)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default="today", help="YYYY-MM-DD, 'today', or 'yesterday'")
    parser.add_argument("--min-minutes", type=int, default=DEFAULT_MIN_MINUTES)
    parser.add_argument("--name", default=None, help="Override the created activity name")
    parser.add_argument("--commit", action="store_true", help="Actually create activities")
    args = parser.parse_args()

    if args.date == "today":
        target = date.today()
    elif args.date == "yesterday":
        target = date.today() - timedelta(days=1)
    else:
        target = date.fromisoformat(args.date)
    ds = target.isoformat()

    config = load_app_config()
    tz_name = config.athlete_timezone
    client = connect_with_tokens(config.garmin)

    events = client.safe_call("get_all_day_events", ds) or []
    existing = client.safe_call("get_activities_by_date", ds, ds, "") or []
    windows = _existing_windows([a for a in existing if isinstance(a, dict)])

    results: list[dict[str, Any]] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        plan = _event_plan(event, args.min_minutes)

        if plan["skip_reason"] is None and plan["start_gmt"] and plan["end_gmt"]:
            for w0, w1 in windows:
                if _overlaps(plan["start_gmt"], plan["end_gmt"], w0, w1):
                    plan["skip_reason"] = "already covered by an existing activity"
                    break

        row: dict[str, Any] = {
            "activityType": plan["activityType"],
            "start_local": plan["start_local"],
            "duration_min": plan["duration_min"],
            "moderate_min": plan["moderate_min"],
        }
        if plan["skip_reason"]:
            row["action"] = "skip"
            row["reason"] = plan["skip_reason"]
        elif not args.commit:
            row["action"] = "would-create"
            row["name"] = args.name or f"{plan['label']} (Move IQ)"
        else:
            row["action"] = "create"
            row.update(_create(client, plan, tz_name, args.name))
        results.append(row)

    summary = {
        "date": ds,
        "timezone": tz_name,
        "mode": "commit" if args.commit else "dry-run",
        "moveiq_events": len(events),
        "existing_activities": len(windows),
        "created": sum(1 for r in results if r.get("action") == "create" and r.get("created")),
        "would_create": sum(1 for r in results if r.get("action") == "would-create"),
        "skipped": sum(1 for r in results if r.get("action") == "skip"),
        "failed": sum(1 for r in results if r.get("action") == "create" and not r.get("created")),
        "results": results,
    }
    print(json.dumps(summary, indent=2, default=str))
    return 1 if summary["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
