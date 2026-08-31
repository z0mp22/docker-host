#!/usr/bin/env python3
"""Backfill Move IQ events as *uploaded FIT activities* (not summary-only).

`enrich-moveiq.py` creates a manual activity and sets summary fields directly,
but Garmin refuses to store HR time-in-zone, steps, cadence and intensity
minutes on a manual activity -- those are only computed from a recorded stream.

This script instead synthesises a FIT file from the all-day HR stream (2-min
samples interpolated to 10 s records) plus, for walks, a step-derived distance
track, and uploads it with `upload_activity()`. Garmin ingests it like a real
recording and computes HR zones, time-in-zone, Training Effect, training load
and intensity minutes server-side.

Still absent: GPS track, real per-second HR, cycling distance/speed/power.

Usage (inside the garmin-coaching-report image, which now bundles fit-tool):
    python backfill-moveiq-fit.py --date yesterday
    python backfill-moveiq-fit.py --date yesterday --commit
    python backfill-moveiq-fit.py --date 2026-08-30 --replace-id 24178376302 --commit
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

from coaching_report.config import load_app_config
from coaching_report.garmin_auth import connect_with_tokens

from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.activity_message import ActivityMessage
from fit_tool.profile.messages.device_info_message import DeviceInfoMessage
from fit_tool.profile.messages.event_message import EventMessage
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.lap_message import LapMessage
from fit_tool.profile.messages.record_message import RecordMessage
from fit_tool.profile.messages.session_message import SessionMessage
from fit_tool.profile.profile_type import (
    Event, EventType, FileType, Manufacturer, Sport, SubSport,
)

RECORD_STEP_S = 10
HR_SAMPLE_S = 120
MIN_MINUTES = 15
ALLOWED = {"walking", "running", "cycling"}

SPORT = {
    "walking": (Sport.WALKING, SubSport.GENERIC),
    "running": (Sport.RUNNING, SubSport.GENERIC),
    "cycling": (Sport.CYCLING, SubSport.E_BIKE_FITNESS),
}
BIKE_SUBSPORT = {
    "e_bike_fitness": SubSport.E_BIKE_FITNESS,
    "e_bike_mountain": SubSport.E_BIKE_MOUNTAIN,
    "cycling": SubSport.GENERIC,
    "road_biking": SubSport.ROAD,
    "gravel_cycling": SubSport.GENERIC,
}
NAME = {"walking": "Walk", "running": "Run", "cycling": "E-Bike"}


def _parse_iso(v: str | None) -> datetime | None:
    if not v:
        return None
    t = v.strip().replace(" ", "T")
    if t.endswith("Z"):
        t = t[:-1] + "+00:00"
    if t.endswith(".0"):
        t = t[:-2]
    try:
        return datetime.fromisoformat(t)
    except ValueError:
        return None


def _utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _ms(dt: datetime) -> int:
    return int(_utc(dt).timestamp() * 1000)


def _win(arr: Any, w0: int, w1: int) -> list[tuple[int, float]]:
    out = []
    for row in arr or []:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        t, v = row[0], row[1]
        if isinstance(t, str):
            d = _parse_iso(t)
            t = _ms(d) if d else None
        if t is None or v is None or t < 1e12:
            continue
        if w0 <= t <= w1:
            out.append((int(t), float(v)))
    return out


def _interp(series: list[tuple[int, float]], t_ms: int) -> float:
    if not series:
        return 0.0
    if t_ms <= series[0][0]:
        return series[0][1]
    if t_ms >= series[-1][0]:
        return series[-1][1]
    for (t0, v0), (t1, v1) in zip(series, series[1:]):
        if t0 <= t_ms <= t1:
            return v0 + (v1 - v0) * (t_ms - t0) / max(t1 - t0, 1)
    return series[-1][1]


def _recent_stride(client: Any) -> float:
    acts = client.safe_call("get_activities", 0, 40) or []
    s = [a["distance"] / a["steps"] for a in acts
         if (a.get("activityType") or {}).get("typeKey") == "walking"
         and a.get("distance") and a.get("steps")]
    return round(statistics.median(s), 3) if s else 0.78


def _hr_rest(client: Any) -> int:
    z = (client.safe_call("get_heart_rate_zones") or [{}])[0]
    return z.get("restingHeartRateUsed") or 60


def _kcal_coef(client: Any, parent: str, hr_rest: int) -> float:
    """kcal per (sec * bpm over resting) from the athlete's recorded activities."""
    acts = client.safe_call("get_activities", 0, 60) or []
    pts = []
    for a in acts:
        key = (a.get("activityType") or {}).get("typeKey") or ""
        ok = (("cycl" in key or "bik" in key) if parent == "cycling"
              else key in ("walking", "hiking", "casual_walking", "running"))
        hr, dur, kcal = a.get("averageHR"), a.get("duration"), a.get("calories")
        if ok and hr and dur and kcal and hr > hr_rest:
            pts.append(kcal / (dur * (hr - hr_rest)))
    return round(statistics.median(pts), 8) if pts else 0.0


def _win_avg(client: Any, method: str, day: str, key: str, w0: int, w1: int) -> float | None:
    data = client.safe_call(method, day) or {}
    vals = [v for _, v in _win(data.get(key), w0, w1) if v and v > 0]
    return round(statistics.mean(vals), 1) if vals else None


def build_fit(path: str, sport: Sport, sub: SubSport, start: datetime, dur_s: int,
              hr_series: list[tuple[int, float]], dist_series: list[tuple[int, float]] | None,
              calories: int | None = None, altitude_m: float | None = None,
              ascent_m: float | None = None) -> dict[str, Any]:
    start_ms = _ms(start)
    b = FitFileBuilder(auto_define=True, min_string_size=50)

    fid = FileIdMessage()
    fid.type = FileType.ACTIVITY
    fid.manufacturer = Manufacturer.DEVELOPMENT.value
    fid.product = 0
    fid.time_created = start_ms
    fid.serial_number = 0x4D4F5651  # "MOVQ"
    b.add(fid)

    di = DeviceInfoMessage()
    di.timestamp = start_ms
    di.manufacturer = Manufacturer.DEVELOPMENT.value
    di.product = 0
    di.software_version = 1.0
    b.add(di)

    ev = EventMessage()
    ev.event = Event.TIMER
    ev.event_type = EventType.START
    ev.timestamp = start_ms
    b.add(ev)

    hrs: list[float] = []
    recs = []
    last_d = 0.0
    for t in range(0, dur_s + 1, RECORD_STEP_S):
        tm = start_ms + t * 1000
        r = RecordMessage()
        r.timestamp = tm
        hr = _interp(hr_series, tm)
        if hr:
            r.heart_rate = round(hr)
            hrs.append(hr)
        if dist_series is not None:
            d = _interp(dist_series, tm)
            r.distance = round(d, 2)
            r.speed = round(max(d - last_d, 0.0) / RECORD_STEP_S, 3)
            last_d = d
        if altitude_m is not None:
            r.altitude = altitude_m
        recs.append(r)
    b.add_all(recs)

    ev2 = EventMessage()
    ev2.event = Event.TIMER
    ev2.event_type = EventType.STOP_ALL
    ev2.timestamp = start_ms + dur_s * 1000
    b.add(ev2)

    total_dist = round(last_d, 2) if dist_series is not None else 0.0
    avg_hr = round(statistics.mean(hrs)) if hrs else 0
    max_hr = round(max(hrs)) if hrs else 0

    lap = LapMessage()
    lap.timestamp = start_ms + dur_s * 1000
    lap.start_time = start_ms
    lap.total_elapsed_time = dur_s
    lap.total_timer_time = dur_s
    lap.total_distance = total_dist
    lap.avg_heart_rate = avg_hr or None
    lap.max_heart_rate = max_hr or None
    if calories:
        lap.total_calories = calories
    if ascent_m:
        lap.total_ascent = round(ascent_m)
    b.add(lap)

    ses = SessionMessage()
    ses.timestamp = start_ms + dur_s * 1000
    ses.start_time = start_ms
    ses.total_elapsed_time = dur_s
    ses.total_timer_time = dur_s
    ses.total_distance = total_dist
    ses.sport = sport
    ses.sub_sport = sub
    ses.first_lap_index = 0
    ses.num_laps = 1
    ses.avg_heart_rate = avg_hr or None
    ses.max_heart_rate = max_hr or None
    if calories:
        ses.total_calories = calories
    if ascent_m:
        ses.total_ascent = round(ascent_m)
    if total_dist and dur_s:
        ses.avg_speed = round(total_dist / dur_s, 3)
    b.add(ses)

    act = ActivityMessage()
    act.timestamp = start_ms + dur_s * 1000
    act.total_timer_time = dur_s
    act.num_sessions = 1
    act.type = 0
    b.add(act)

    b.build().to_file(path)
    return {"bytes": os.path.getsize(path), "records": len(recs),
            "hr_records": len(hrs), "avg_hr": avg_hr, "max_hr": max_hr,
            "distance_m": total_dist, "calories": calories}


def _overlaps(a0, a1, b0, b1):
    return a0 < b1 and b0 < a1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--date", default="yesterday")
    ap.add_argument("--min-minutes", type=int, default=MIN_MINUTES)
    ap.add_argument("--bike-type", default="e_bike_fitness", choices=sorted(BIKE_SUBSPORT))
    ap.add_argument("--replace-id", type=int, action="append", default=[])
    ap.add_argument("--commit", action="store_true")
    args = ap.parse_args()

    if args.date == "today":
        target = date.today()
    elif args.date == "yesterday":
        target = date.today() - timedelta(days=1)
    else:
        target = date.fromisoformat(args.date)
    ds = target.isoformat()

    cfg = load_app_config()
    client = connect_with_tokens(cfg.garmin)
    stride = _recent_stride(client)

    events = client.safe_call("get_all_day_events", ds) or []
    existing = [a for a in (client.safe_call("get_activities_by_date", ds, ds, "") or [])
                if isinstance(a, dict)]
    ex_windows = []
    for a in existing:
        s = _utc(_parse_iso(a.get("startTimeGMT")))
        if s and a.get("activityId") not in args.replace_id:
            ex_windows.append((s, s + timedelta(seconds=float(a.get("duration") or 0))))

    if args.commit:
        for rid in args.replace_id:
            try:
                client.safe_call("delete_activity", str(rid))
                print(f"deleted {rid}")
            except Exception as ex:  # noqa: BLE001
                print(f"delete {rid} failed: {ex}")

    hr_day = client.safe_call("get_heart_rates", ds) or {}
    steps_day = client.safe_call("get_steps_data", ds) or []
    floors_day = client.safe_call("get_floors", ds) or {}
    hr_rest = _hr_rest(client)
    coef = {"walking": _kcal_coef(client, "walking", hr_rest),
            "cycling": _kcal_coef(client, "cycling", hr_rest)}

    results = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        atype = str(ev.get("activityType") or "").lower()
        s_gmt = _utc(_parse_iso(ev.get("startTimestampGMT")))
        e_gmt = _utc(_parse_iso(ev.get("endTimestampGMT")))
        s_loc = _parse_iso(ev.get("startTimestampLocal"))
        if not (s_gmt and e_gmt and s_loc):
            continue
        dur_s = int((e_gmt - s_gmt).total_seconds())
        row: dict[str, Any] = {"type": atype, "start_local": s_loc.isoformat(),
                               "duration_min": round(dur_s / 60)}
        if atype not in ALLOWED:
            row["action"] = "skip: type"; results.append(row); continue
        if dur_s < args.min_minutes * 60:
            row["action"] = f"skip: {round(dur_s/60)}m"; results.append(row); continue
        if any(_overlaps(s_gmt, e_gmt, w0, w1) for w0, w1 in ex_windows):
            row["action"] = "skip: overlaps existing"; results.append(row); continue

        w0, w1 = _ms(s_gmt), _ms(e_gmt)
        hr_series = _win(hr_day.get("heartRateValues"), w0 - HR_SAMPLE_S * 1000,
                         w1 + HR_SAMPLE_S * 1000)
        if not hr_series:
            row["action"] = "skip: no HR in window"; results.append(row); continue

        dist_series = None
        if atype in ("walking", "running"):
            cum, dist_series = 0.0, [(w0, 0.0)]
            for b in steps_day:
                b0, b1 = _parse_iso(b.get("startGMT")), _parse_iso(b.get("endGMT"))
                if not (b0 and b1):
                    continue
                bs, be = _ms(b0), _ms(b1)
                if be <= w0 or bs >= w1:
                    continue
                frac = (min(be, w1) - max(bs, w0)) / (be - bs)
                cum += (b.get("steps", 0) or 0) * frac * stride
                dist_series.append((min(be, w1), round(cum, 2)))
            dist_series.append((w1, round(cum, 2)))

        sport, sub = SPORT[atype]
        if atype == "cycling":
            sub = BIKE_SUBSPORT[args.bike_type]

        # calories from the athlete-calibrated HR-reserve model
        parent = "cycling" if atype == "cycling" else "walking"
        avg_hr_win = statistics.mean([v for _, v in hr_series]) if hr_series else 0
        kcal = (round(coef[parent] * dur_s * max(avg_hr_win - hr_rest, 0))
                if coef[parent] else None)

        # coarse elevation from the barometric floor counter
        asc = 0.0
        for fr in floors_day.get("floorValuesArray") or []:
            if len(fr) >= 4 and isinstance(fr[0], str):
                r0, r1 = _parse_iso(fr[0]), _parse_iso(fr[1])
                if r0 and r1 and _ms(r0) >= w0 and _ms(r1) <= w1:
                    asc += (fr[2] or 0) * 3.048

        fd = os.path.dirname(tempfile.mktemp())
        fname = f"moveiq_{atype}_{s_gmt:%Y%m%dT%H%M%S}Z.fit"
        path = os.path.join(fd, fname)
        meta = build_fit(path, sport, sub, s_gmt, dur_s, hr_series, dist_series,
                         calories=kcal, altitude_m=1530.0,
                         ascent_m=asc or None)
        row["fit"] = meta

        if not args.commit:
            row["action"] = "would-upload"; results.append(row)
            os.unlink(path); continue

        try:
            resp = client.safe_call("upload_activity", path)
            data = resp.json() if hasattr(resp, "json") else resp
            row["upload"] = data.get("detailedImportResult", data) if isinstance(data, dict) else str(data)
        except Exception as ex:  # noqa: BLE001
            row["action"] = f"upload failed: {ex}"
            results.append(row); os.unlink(path); continue
        os.unlink(path)

        # give Garmin a moment, then locate the new activity + name it
        new_id = None
        for _ in range(6):
            time.sleep(5)
            for a in client.safe_call("get_activities_by_date", ds, ds, "") or []:
                st = _utc(_parse_iso(a.get("startTimeGMT")))
                if st and abs((st - s_gmt).total_seconds()) < 90 and a.get("activityId") not in args.replace_id:
                    new_id = a.get("activityId")
                    break
            if new_id:
                break
        if new_id:
            try:
                client.safe_call("set_activity_name", str(new_id),
                                 f"{NAME[atype]} (Move IQ / HR-only FIT)")
                client.safe_call(
                    "set_activity_description", str(new_id),
                    f"Synthesised from Garmin Move IQ event {ds}. HR stream interpolated "
                    f"from {len(hr_series)} all-day samples @ {HR_SAMPLE_S}s to "
                    f"{RECORD_STEP_S}s records. "
                    + ("Distance from step counter x %.2f m stride. " % stride
                       if dist_series else "No distance (no GPS/wheel sensor). ")
                    + "HR zones / time-in-zone / Training Effect / intensity minutes "
                    "computed by Garmin from the stream. No GPS track.")
            except Exception as ex:  # noqa: BLE001
                row["post_error"] = str(ex)
            back = client.safe_call("get_activity", int(new_id)) or {}
            s = back.get("summaryDTO", {})
            row["activityId"] = new_id
            row["url"] = f"https://connect.garmin.com/modern/activity/{new_id}"
            row["persisted"] = {k: s.get(k) for k in (
                "distance", "duration", "averageHR", "maxHR", "calories", "elevationGain",
                "trainingEffect", "anaerobicTrainingEffect", "activityTrainingLoad",
                "moderateIntensityMinutes", "vigorousIntensityMinutes",
                "hrTimeInZone_1", "hrTimeInZone_2", "hrTimeInZone_3", "hrTimeInZone_4",
                "hrTimeInZone_5") if s.get(k) is not None}
        row["action"] = "uploaded"
        results.append(row)

    print(json.dumps({"date": ds, "mode": "commit" if args.commit else "dry-run",
                      "stride_m": stride, "results": results}, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
