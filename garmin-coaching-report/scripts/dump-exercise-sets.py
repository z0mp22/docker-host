#!/usr/bin/env python3
"""Dump exercise sets for the most recent strength activity."""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta

from coaching_report.config import load_app_config
from coaching_report.garmin_auth import connect_with_tokens


STRENGTH_HINTS = (
    "strength",
    "training",
    "fitness_equipment",
    "indoor_cardio",
    "strength_training",
)


def _is_strength(activity: dict) -> bool:
    fields = [
        str(activity.get("activityType", {}) or ""),
        str((activity.get("activityType") or {}).get("typeKey", "")),
        str((activity.get("activityType") or {}).get("typeId", "")),
        str(activity.get("activityName", "")),
        str(activity.get("activityTypeId", "")),
    ]
    blob = " ".join(fields).lower()
    return any(h in blob for h in STRENGTH_HINTS) or "strength" in blob


def main() -> int:
    config = load_app_config()
    client = connect_with_tokens(config.garmin)

    end = date.today()
    start = end - timedelta(days=60)
    activities = (
        client.safe_call(
            "get_activities_by_date",
            start.isoformat(),
            end.isoformat(),
            "",
        )
        or []
    )

    strength = [a for a in activities if isinstance(a, dict) and _is_strength(a)]
    print(f"Found {len(activities)} activities, {len(strength)} strength-like", file=sys.stderr)
    if not strength:
        # Fallback: print recent activity types so we can see naming
        sample = []
        for a in activities[:15]:
            at = a.get("activityType") or {}
            sample.append(
                {
                    "id": a.get("activityId"),
                    "name": a.get("activityName"),
                    "typeKey": at.get("typeKey") if isinstance(at, dict) else at,
                    "start": a.get("startTimeLocal") or a.get("startTimeGMT"),
                }
            )
        print(json.dumps({"recent": sample}, indent=2))
        return 1

    # Most recent first (Garmin usually returns newest first; sort defensively)
    strength.sort(
        key=lambda a: a.get("startTimeGMT") or a.get("startTimeLocal") or "",
        reverse=True,
    )
    latest = strength[0]
    activity_id = int(latest["activityId"])
    at = latest.get("activityType") or {}
    meta = {
        "activityId": activity_id,
        "activityName": latest.get("activityName"),
        "typeKey": at.get("typeKey") if isinstance(at, dict) else at,
        "start": latest.get("startTimeLocal") or latest.get("startTimeGMT"),
        "duration_s": latest.get("duration") or latest.get("elapsedDuration"),
    }
    print(f"Latest strength activity: {meta}", file=sys.stderr)

    sets = client.safe_call("get_activity_exercise_sets", activity_id)
    summary = client.safe_call("get_activity", activity_id)

    out = {
        "meta": meta,
        "summary_keys": sorted(summary.keys()) if isinstance(summary, dict) else type(summary).__name__,
        "exercise_sets": sets,
    }
    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
