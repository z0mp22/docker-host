#!/usr/bin/env python3
"""Create Move IQ backfill activities enriched with every stat we can recover.

Move IQ events themselves carry only start/end/duration/type. But the watch
logged continuous all-day streams, so for the event's time window we can
recover real numbers:

  * heart rate       -> avg / max / min + time-in-zone (2-min samples)
  * steps            -> distance + cadence (walking only; cycling steps are noise)
  * floors           -> elevation gain / loss
  * respiration      -> avg / max / min breaths-per-min (when measured)
  * stress           -> avg (when measured)
  * body battery     -> drain across the window
  * intensity min    -> straight from the Move IQ event

Calories are estimated from a per-sport linear model calibrated against the
athlete's own recently recorded activities (kcal vs HR-reserve x time), falling
back to the Keytel (2005) HR equation. GPS track, per-second speed, and Garmin
Training Effect / training load cannot be reconstructed and stay absent.

Every created activity gets a description documenting which fields are measured
vs estimated.

Usage (inside the garmin-coaching-report image):
    python enrich-moveiq.py --date today                 # dry run
    python enrich-moveiq.py --date today --commit
    python enrich-moveiq.py --date 2026-08-29 --bike-type e_bike_fitness --commit
"""

from __future__ import annotations

import argparse
import json
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Any

from coaching_report.config import load_app_config
from coaching_report.garmin_auth import connect_with_tokens

TYPE_MAP = {
    "walking": {"typeId": 9, "typeKey": "walking", "parentTypeId": 17, "label": "Walk"},
    "running": {"typeId": 1, "typeKey": "running", "parentTypeId": 17, "label": "Run"},
    "cycling": {"typeId": 2, "typeKey": "cycling", "parentTypeId": 17, "label": "Ride"},
}
BIKE_TYPES = {
    "cycling": {"typeId": 2, "typeKey": "cycling", "parentTypeId": 17, "label": "Ride"},
    "e_bike_fitness": {"typeId": 176, "typeKey": "e_bike_fitness", "parentTypeId": 2, "label": "E-Bike"},
    "e_bike_mountain": {"typeId": 175, "typeKey": "e_bike_mountain", "parentTypeId": 2, "label": "E-MTB"},
    "gravel_cycling": {"typeId": 143, "typeKey": "gravel_cycling", "parentTypeId": 2, "label": "Gravel"},
    "road_biking": {"typeId": 10, "typeKey": "road_biking", "parentTypeId": 2, "label": "Road ride"},
}
DEFAULT_MIN_MINUTES = 15
HR_SAMPLE_SECONDS = 120  # Garmin all-day HR cadence
FLOOR_METERS = 3.048


# --------------------------------------------------------------------------- #
# time helpers
# --------------------------------------------------------------------------- #
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


def _win_vals(arr: Any, w0: int, w1: int, ti: int = 0, vi: int = 1) -> list[float]:
    out: list[float] = []
    for row in arr or []:
        if not isinstance(row, (list, tuple)) or len(row) <= max(ti, vi):
            continue
        t, v = row[ti], row[vi]
        if isinstance(t, str):
            dt = _parse_iso(t)
            t = _ms(dt) if dt else None
        if t is None or v is None or t < 1e12:
            continue
        if w0 <= t <= w1:
            out.append(v)
    return out


# --------------------------------------------------------------------------- #
# athlete context
# --------------------------------------------------------------------------- #
class Athlete:
    def __init__(self, client: Any) -> None:
        info = client.safe_call("connectapi",
                                "/userprofile-service/userprofile/personal-information") or {}
        ui = info.get("userInfo", {})
        bp = info.get("biometricProfile", {})
        self.age = ui.get("age") or 40
        self.male = (info.get("gender") or ui.get("genderType") or "MALE").upper().startswith("M")
        self.weight_kg = round((bp.get("weight") or 80000) / 1000, 1)
        zones = client.safe_call("get_heart_rate_zones") or []
        z = zones[0] if zones else {}
        self.z_floors = [z.get(f"zone{i}Floor") for i in range(1, 6)]
        self.hr_max = z.get("maxHeartRateUsed") or (220 - self.age)
        self.hr_rest = z.get("restingHeartRateUsed") or 60
        self.stride_m = self._recent_stride(client)
        self.kcal_coef: dict[str, float] = {}

    def _recent_stride(self, client: Any) -> float:
        acts = client.safe_call("get_activities", 0, 40) or []
        strides = []
        for a in acts:
            if (a.get("activityType") or {}).get("typeKey") != "walking":
                continue
            dist, steps = a.get("distance"), a.get("steps")
            if dist and steps:
                strides.append(dist / steps)
        return round(statistics.median(strides), 3) if strides else 0.78

    def kcal_coefficient(self, client: Any, parent_key: str) -> float:
        """kcal per (second * bpm above resting), from recorded activities."""
        if parent_key in self.kcal_coef:
            return self.kcal_coef[parent_key]
        acts = client.safe_call("get_activities", 0, 60) or []
        pts = []
        for a in acts:
            key = (a.get("activityType") or {}).get("typeKey") or ""
            if parent_key == "cycling" and not ("cycl" in key or "bik" in key):
                continue
            if parent_key == "walking" and key not in ("walking", "hiking", "casual_walking"):
                continue
            hr, dur, kcal = a.get("averageHR"), a.get("duration"), a.get("calories")
            if hr and dur and kcal and hr > self.hr_rest:
                pts.append(kcal / (dur * (hr - self.hr_rest)))
        coef = round(statistics.median(pts), 8) if pts else 0.0
        self.kcal_coef[parent_key] = coef
        return coef

    def calories(self, client: Any, parent_key: str, avg_hr: float, dur_s: float) -> tuple[int, str]:
        coef = self.kcal_coefficient(client, parent_key)
        if coef:
            return round(coef * dur_s * max(avg_hr - self.hr_rest, 0)), "calibrated-hr-reserve"
        # Keytel 2005 fallback
        if self.male:
            per_min = (-55.0969 + 0.6309 * avg_hr + 0.1988 * self.weight_kg
                       + 0.2017 * self.age) / 4.184
        else:
            per_min = (-20.4022 + 0.4472 * avg_hr - 0.1263 * self.weight_kg
                       + 0.074 * self.age) / 4.184
        return max(round(per_min * dur_s / 60), 0), "keytel-2005"

    def bmr_kcal(self, dur_s: float) -> int:
        # Mifflin-St Jeor, resting portion for the window
        base = 10 * self.weight_kg + 6.25 * 188 - 5 * self.age + (5 if self.male else -161)
        return round(base / 86400 * dur_s)

    def time_in_zone(self, hr_samples: list[float]) -> list[float]:
        z = [0.0] * 5
        floors = self.z_floors
        for hr in hr_samples:
            idx = 0
            for i, f in enumerate(floors):
                if f is not None and hr >= f:
                    idx = i
            z[idx] += HR_SAMPLE_SECONDS
        return z


# --------------------------------------------------------------------------- #
# window enrichment
# --------------------------------------------------------------------------- #
def enrich_window(client: Any, ath: Athlete, day: str, start_gmt: datetime,
                  end_gmt: datetime, parent_key: str) -> dict[str, Any]:
    w0, w1 = _ms(start_gmt), _ms(end_gmt)
    dur_s = (end_gmt - start_gmt).total_seconds()
    out: dict[str, Any] = {"measured": [], "estimated": [], "unavailable": []}
    summary: dict[str, Any] = {}

    # heart rate
    hr = client.safe_call("get_heart_rates", day) or {}
    hv = _win_vals(hr.get("heartRateValues"), w0, w1)
    if hv:
        summary["averageHR"] = round(statistics.mean(hv))
        summary["maxHR"] = max(hv)
        summary["minHR"] = min(hv)
        zones = ath.time_in_zone(hv)
        # scale zone seconds to actual window duration
        scale = dur_s / sum(zones) if sum(zones) else 1.0
        for i, sec in enumerate(zones, 1):
            summary[f"hrTimeInZone_{i}"] = round(sec * scale, 1)
        out["measured"] += ["averageHR", "maxHR", "minHR", "hrTimeInZone_1..5"]
        out["hr_samples"] = len(hv)
    else:
        out["unavailable"].append("heartRate")

    # steps -> distance + cadence (walking only)
    steps_total = 0
    st = client.safe_call("get_steps_data", day) or []
    for b in st:
        b0 = _parse_iso(b.get("startGMT"))
        if b0 and w0 <= _ms(b0) < w1:
            steps_total += b.get("steps", 0) or 0
    if parent_key == "walking" and steps_total:
        summary["distance"] = round(steps_total * ath.stride_m, 1)
        summary["averageSpeed"] = round(summary["distance"] / dur_s, 4)
        out["steps"] = steps_total
        out["cadence_spm"] = round(steps_total / (dur_s / 60), 1)
        out["measured"].append("steps")
        out["estimated"] += [f"distance(steps x {ath.stride_m} m stride)", "averageSpeed"]
    elif parent_key == "cycling":
        out["unavailable"] += ["distance", "speed (no GPS / wheel sensor)"]

    # floors -> elevation
    fl = client.safe_call("get_floors", day) or {}
    asc = desc = 0.0
    for row in fl.get("floorValuesArray") or []:
        if len(row) >= 4 and isinstance(row[0], str):
            r0, r1 = _parse_iso(row[0]), _parse_iso(row[1])
            if r0 and r1 and _ms(r0) >= w0 and _ms(r1) <= w1:
                asc += row[2] or 0
                desc += row[3] or 0
    if asc or desc:
        summary["elevationGain"] = round(asc * FLOOR_METERS, 1)
        summary["elevationLoss"] = round(desc * FLOOR_METERS, 1)
        out["estimated"].append("elevationGain/Loss (barometric floor counter, coarse)")

    # respiration
    resp = client.safe_call("get_respiration_data", day) or {}
    rv = [v for v in _win_vals(resp.get("respirationValuesArray"), w0, w1) if v and v > 0]
    if rv:
        summary["minRespirationRate"] = round(min(rv), 1)
        summary["maxRespirationRate"] = round(max(rv), 1)
        summary["avgRespirationRate"] = round(statistics.mean(rv), 1)
        out["measured"].append("respiration")

    # stress
    stress = client.safe_call("get_stress_data", day) or {}
    sv = [v for v in _win_vals(stress.get("stressValuesArray"), w0, w1) if v is not None and v >= 0]
    if sv:
        out["avg_stress"] = round(statistics.mean(sv))

    # body battery
    bb = client.safe_call("get_body_battery", day, day) or []
    bb_arr = bb[0].get("bodyBatteryValuesArray") if bb and isinstance(bb[0], dict) else None
    bv = _win_vals(bb_arr, w0, w1)
    if bv:
        out["body_battery_drain"] = bv[0] - bv[-1]
        summary["differenceBodyBattery"] = bv[-1] - bv[0]

    # duration fields
    summary["duration"] = dur_s
    summary["elapsedDuration"] = dur_s
    summary["movingDuration"] = dur_s

    # calories
    if "averageHR" in summary:
        kcal, method = ath.calories(client, parent_key, summary["averageHR"], dur_s)
        summary["calories"] = kcal
        summary["bmrCalories"] = ath.bmr_kcal(dur_s)
        out["estimated"].append(f"calories ({method})")

    out["summary"] = summary
    return out


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def _overlaps(a0, a1, b0, b1):
    return a0 < b1 and b0 < a1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--date", default="today")
    ap.add_argument("--min-minutes", type=int, default=DEFAULT_MIN_MINUTES)
    ap.add_argument("--bike-type", default="e_bike_fitness", choices=sorted(BIKE_TYPES))
    ap.add_argument("--replace-id", type=int, action="append", default=[],
                    help="delete this manual activityId before recreating (repeatable)")
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
    tz = cfg.athlete_timezone
    client = connect_with_tokens(cfg.garmin)
    ath = Athlete(client)

    events = client.safe_call("get_all_day_events", ds) or []
    existing = [a for a in (client.safe_call("get_activities_by_date", ds, ds, "") or [])
                if isinstance(a, dict)]
    ex_windows = []
    for a in existing:
        s = _utc(_parse_iso(a.get("startTimeGMT")))
        if s:
            ex_windows.append((s, s + timedelta(seconds=float(a.get("duration") or 0)),
                               a.get("activityId")))

    if args.replace_id:
        ex_windows = [w for w in ex_windows if w[2] not in args.replace_id]
        if args.commit:
            for rid in args.replace_id:
                try:
                    client.safe_call("delete_activity", str(rid))
                    print(f"deleted {rid}")
                except Exception as ex:  # noqa: BLE001
                    print(f"delete {rid} failed: {ex}")

    report = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        atype = str(ev.get("activityType") or "").lower()
        s_gmt = _utc(_parse_iso(ev.get("startTimestampGMT")))
        e_gmt = _utc(_parse_iso(ev.get("endTimestampGMT")))
        s_loc = _parse_iso(ev.get("startTimestampLocal"))
        if not (s_gmt and e_gmt and s_loc):
            continue
        dur_min = round((e_gmt - s_gmt).total_seconds() / 60)
        row: dict[str, Any] = {"type": atype, "start_local": s_loc.isoformat(),
                               "duration_min": dur_min}

        if atype not in ("walking", "running", "cycling"):
            row["action"] = "skip: type not in allowlist"
            report.append(row); continue
        if dur_min < args.min_minutes:
            row["action"] = f"skip: {dur_min}m < {args.min_minutes}m"
            report.append(row); continue
        if any(_overlaps(s_gmt, e_gmt, w0, w1) for w0, w1, _ in ex_windows):
            row["action"] = "skip: overlaps existing activity"
            report.append(row); continue

        parent_key = "walking" if atype in ("walking", "running") else "cycling"
        tdef = TYPE_MAP[atype] if atype != "cycling" else BIKE_TYPES[args.bike_type]
        enr = enrich_window(client, ath, ds, s_gmt, e_gmt, parent_key)
        summary = enr["summary"]
        summary["startTimeLocal"] = s_loc.strftime("%Y-%m-%dT%H:%M:%S.000")
        summary["startTimeGMT"] = s_gmt.strftime("%Y-%m-%dT%H:%M:%S.000")
        label = tdef["label"]

        # Stats Garmin will not store on a manual activity go in the description
        # as a structured block so they stay attached and greppable.
        s = summary
        extra: list[str] = []
        tiz = [s.get(f"hrTimeInZone_{i}", 0.0) for i in range(1, 6)]
        if any(tiz):
            extra.append("HR time-in-zone (min): "
                         + " / ".join(f"Z{i} {v/60:.0f}" for i, v in enumerate(tiz, 1)))
        if enr.get("steps"):
            extra.append(f"steps {enr['steps']} | walking cadence {enr.get('cadence_spm')} spm")
        if "avgRespirationRate" in s:
            extra.append(f"respiration {s['avgRespirationRate']} br/min "
                         f"({s['minRespirationRate']}-{s['maxRespirationRate']})")
        if enr.get("avg_stress") is not None:
            extra.append(f"avg stress {enr['avg_stress']}")
        if enr.get("body_battery_drain") is not None:
            extra.append(f"body battery drain {enr['body_battery_drain']}")
        if ev.get("moderateIntensityMinutes") is not None:
            extra.append(f"intensity min: moderate {ev.get('moderateIntensityMinutes')} / "
                         f"vigorous {ev.get('vigorousIntensityMinutes')}")

        desc = (
            f"Backfilled from Garmin Move IQ auto-detected event on {ds}.\n"
            f"MEASURED from all-day streams: {', '.join(enr['measured']) or 'none'} "
            f"(HR: {enr.get('hr_samples', 0)} samples @ {HR_SAMPLE_SECONDS}s).\n"
            f"ESTIMATED: {', '.join(enr['estimated']) or 'none'}.\n"
            f"UNAVAILABLE (needs a live recording): "
            f"{', '.join(enr['unavailable']) or 'none'}, GPS track, per-second traces.\n"
            + ("\n".join(extra) + "\n" if extra else "")
            + "Fields not queryable on manual activities (shown above only): "
            "time-in-zone, steps, cadence, intensity minutes."
        )

        payload = {
            "activityTypeDTO": {"typeKey": tdef["typeKey"]},
            "accessControlRuleDTO": {"typeId": 2, "typeKey": "private"},
            "timeZoneUnitDTO": {"unitKey": tz},
            "activityName": f"{label} (Move IQ backfill)",
            "metadataDTO": {"autoCalcCalories": False},
            "summaryDTO": summary,
        }
        row["payload"] = payload
        row["provenance"] = {k: enr[k] for k in ("measured", "estimated", "unavailable")}

        if not args.commit:
            row["action"] = "would-create"
            report.append(row); continue

        created = client.safe_call("create_manual_activity_from_json", payload)
        aid = created.get("activityId") if isinstance(created, dict) else None
        row["activityId"] = aid
        if aid:
            try:
                client.safe_call("set_activity_description", str(aid), desc)
            except Exception as ex:  # noqa: BLE001
                row["desc_error"] = str(ex)
            back = client.safe_call("get_activity", int(aid)) or {}
            row["persisted"] = dict(back.get("summaryDTO") or {})
            row["description"] = desc
            row["url"] = f"https://connect.garmin.com/modern/activity/{aid}"
        row["action"] = "created"
        report.append(row)

    print(json.dumps({
        "date": ds,
        "athlete": {"age": ath.age, "male": ath.male, "weight_kg": ath.weight_kg,
                    "hr_rest": ath.hr_rest, "hr_max": ath.hr_max, "zone_floors": ath.z_floors,
                    "stride_m": ath.stride_m, "kcal_coef": ath.kcal_coef},
        "mode": "commit" if args.commit else "dry-run",
        "results": report,
    }, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
