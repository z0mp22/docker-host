#!/usr/bin/env python3
"""Dump e-bike activities + surrounding recovery for coaching judgment."""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta
from typing import Any

from coaching_report.config import load_app_config
from coaching_report.garmin_auth import connect_with_tokens


EBIKE_HINTS = (
    "ebike",
    "e_bike",
    "e-bike",
    "electric",
    "cycling_e_bike",
    "road_biking_e_bike",
    "mountain_biking_e_bike",
)


def _type_blob(activity: dict) -> str:
    at = activity.get("activityType") or {}
    parts = [
        str(activity.get("activityName", "")),
        str(at if not isinstance(at, dict) else ""),
        str(at.get("typeKey", "") if isinstance(at, dict) else ""),
        str(at.get("typeId", "") if isinstance(at, dict) else ""),
    ]
    return " ".join(parts).lower()


def _is_ebike(activity: dict) -> bool:
    blob = _type_blob(activity)
    return any(h in blob for h in EBIKE_HINTS)


def _is_bikeish(activity: dict) -> bool:
    blob = _type_blob(activity)
    return any(
        x in blob
        for x in ("cycling", "biking", "bike", "ebike", "e_bike", "gravel", "mountain")
    )


def _num(v: Any) -> float | None:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _activity_row(a: dict) -> dict[str, Any]:
    at = a.get("activityType") or {}
    return {
        "id": a.get("activityId"),
        "name": a.get("activityName"),
        "typeKey": at.get("typeKey") if isinstance(at, dict) else at,
        "start_local": a.get("startTimeLocal") or a.get("startTimeGMT"),
        "duration_min": round((_num(a.get("duration")) or 0) / 60, 1),
        "distance_km": round((_num(a.get("distance")) or 0) / 1000, 2)
        if a.get("distance")
        else None,
        "elevation_gain_m": _num(a.get("elevationGain")),
        "avg_hr": _num(a.get("averageHR")),
        "max_hr": _num(a.get("maxHR")),
        "calories": _num(a.get("calories")),
        "training_effect_aerobic": _num(a.get("aerobicTrainingEffect")),
        "training_effect_anaerobic": _num(a.get("anaerobicTrainingEffect")),
        "avg_speed_kph": round((_num(a.get("averageSpeed")) or 0) * 3.6, 1)
        if a.get("averageSpeed")
        else None,
    }


def _sleep_summary(sleep: Any) -> dict[str, Any] | None:
    if not isinstance(sleep, dict):
        return None
    dto = sleep.get("dailySleepDTO") or sleep
    if not isinstance(dto, dict):
        return None
    scores = dto.get("sleepScores") or {}
    overall = scores.get("overall") if isinstance(scores, dict) else None
    return {
        "sleep_seconds": dto.get("sleepTimeSeconds"),
        "sleep_hours": round((_num(dto.get("sleepTimeSeconds")) or 0) / 3600, 2),
        "deep_seconds": dto.get("deepSleepSeconds"),
        "rem_seconds": dto.get("remSleepSeconds"),
        "awake_seconds": dto.get("awakeSleepSeconds"),
        "sleep_score": overall.get("value") if isinstance(overall, dict) else overall,
        "avg_spo2": dto.get("averageSpO2Value"),
        "avg_respiration": dto.get("averageRespirationValue"),
    }


def _hrv_summary(hrv: Any) -> dict[str, Any] | None:
    if not isinstance(hrv, dict):
        return None
    summary = hrv.get("hrvSummary") or hrv
    if not isinstance(summary, dict):
        return None
    return {
        "last_night_avg": summary.get("lastNightAvg"),
        "last_night_5min_high": summary.get("lastNight5MinHigh"),
        "status": summary.get("status"),
        "baseline": summary.get("baseline"),
    }


def _rhr_summary(rhr: Any) -> Any:
    if not isinstance(rhr, dict):
        return rhr
    return rhr.get("restingHeartRate") or rhr.get("value") or rhr


def _bb_peak(bb: Any) -> Any:
    if not isinstance(bb, list) or not bb:
        return None
    # body battery often list of day dicts with charged/drained arrays
    day = bb[0] if isinstance(bb[0], dict) else None
    if not day:
        return None
    charged = day.get("charged") or []
    drained = day.get("drained") or []
    vals = []
    for series in (charged, drained, day.get("bodyBatteryValuesArray") or []):
        if isinstance(series, list):
            for pt in series:
                if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                    vals.append(pt[1])
                elif isinstance(pt, dict) and "bodyBatteryLevel" in pt:
                    vals.append(pt["bodyBatteryLevel"])
    if not vals:
        return {
            "raw_keys": list(day.keys()),
            "endOfDayValue": day.get("endOfDayValue") or day.get("bodyBatteryValue"),
        }
    return {"min": min(vals), "max": max(vals), "last": vals[-1]}


def main() -> int:
    config = load_app_config()
    client = connect_with_tokens(config.garmin)

    end = date.today()
    start = end - timedelta(days=56)
    activities = (
        client.safe_call(
            "get_activities_by_date",
            start.isoformat(),
            end.isoformat(),
            "",
        )
        or []
    )

    ebikes = [a for a in activities if isinstance(a, dict) and _is_ebike(a)]
    bikes = [a for a in activities if isinstance(a, dict) and _is_bikeish(a)]
    # sort newest first
    ebikes.sort(key=lambda a: a.get("startTimeGMT") or "", reverse=True)
    bikes.sort(key=lambda a: a.get("startTimeGMT") or "", reverse=True)

    # enrich last ~10 e-bikes with training effect if missing on list
    enriched = []
    for a in ebikes[:12]:
        row = _activity_row(a)
        aid = a.get("activityId")
        if aid and row.get("training_effect_aerobic") is None:
            detail = client.safe_call("get_activity", int(aid)) or {}
            summary = detail.get("summaryDTO") if isinstance(detail, dict) else {}
            if isinstance(summary, dict):
                row["avg_hr"] = row["avg_hr"] or _num(summary.get("averageHR"))
                row["max_hr"] = row["max_hr"] or _num(summary.get("maxHR"))
                row["training_effect_aerobic"] = _num(
                    summary.get("trainingEffect") or summary.get("aerobicTrainingEffect")
                )
                row["training_effect_anaerobic"] = _num(
                    summary.get("anaerobicTrainingEffect")
                )
                row["calories"] = row["calories"] or _num(summary.get("calories"))
                te = client.safe_call("get_training_effect", int(aid))
                if isinstance(te, dict):
                    row["training_effect_detail"] = {
                        k: te.get(k)
                        for k in (
                            "aerobicTrainingEffect",
                            "anaerobicTrainingEffect",
                            "trainingEffectLabel",
                            "activityTrainingLoad",
                        )
                        if k in te
                    }
        enriched.append(row)

    # Recovery around recent e-bike days (+ day before / after)
    focus_days: set[date] = set()
    for a in ebikes[:8]:
        raw = (a.get("startTimeLocal") or a.get("startTimeGMT") or "")[:10]
        try:
            d = date.fromisoformat(raw)
        except ValueError:
            continue
        focus_days.add(d - timedelta(days=1))
        focus_days.add(d)
        focus_days.add(d + timedelta(days=1))

    # Also last 14 days daily recovery for trend context
    for i in range(14):
        focus_days.add(end - timedelta(days=i))

    recovery = []
    for d in sorted(focus_days):
        ds = d.isoformat()
        sleep = client.safe_call("get_sleep_data", ds)
        hrv = client.safe_call("get_hrv_data", ds)
        rhr = client.safe_call("get_rhr_day", ds)
        bb = client.safe_call("get_body_battery", ds, ds)
        stats = client.safe_call("get_stats", ds)
        readiness = client.safe_call("get_training_readiness", ds)
        recovery.append(
            {
                "date": ds,
                "sleep": _sleep_summary(sleep),
                "hrv": _hrv_summary(hrv),
                "resting_hr": _rhr_summary(rhr),
                "body_battery": _bb_peak(bb),
                "stats_snippet": {
                    "intenseMin": (stats or {}).get("intenseMinutes")
                    if isinstance(stats, dict)
                    else None,
                    "highlyActiveSec": (stats or {}).get("highlyActiveSeconds")
                    if isinstance(stats, dict)
                    else None,
                    "activeSec": (stats or {}).get("activeSeconds")
                    if isinstance(stats, dict)
                    else None,
                    "totalKcal": (stats or {}).get("totalKilocalories")
                    if isinstance(stats, dict)
                    else None,
                }
                if stats
                else None,
                "training_readiness": readiness
                if not isinstance(readiness, dict)
                else {
                    k: readiness.get(k)
                    for k in (
                        "score",
                        "level",
                        "sleepScore",
                        "hrvScore",
                        "recoveryTime",
                        "acwrScore",
                        "acuteLoad",
                        "chronicLoad",
                    )
                    if k in readiness
                }
                or readiness,
            }
        )

    # Recent non-ebike hard-ish sports for context
    other = []
    for a in activities:
        if not isinstance(a, dict) or _is_ebike(a):
            continue
        at = a.get("activityType") or {}
        key = (at.get("typeKey") if isinstance(at, dict) else str(at) or "").lower()
        name = str(a.get("activityName") or "").lower()
        if any(
            x in key or x in name
            for x in (
                "strength",
                "climb",
                "bouldering",
                "rock_climbing",
                "mountaineering",
                "running",
                "trail",
                "hiking",
                "resort",
                "snowboarding",
                "skiing",
                "mountain_biking",
                "gravel",
                "cycling",
            )
        ):
            other.append(_activity_row(a))
    other = other[:25]

    out = {
        "as_of": end.isoformat(),
        "window_days": 56,
        "ebike_count": len(ebikes),
        "bikeish_count": len(bikes),
        "recent_ebikes": enriched,
        "recent_other_training": other,
        "recovery_days": recovery,
    }
    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
