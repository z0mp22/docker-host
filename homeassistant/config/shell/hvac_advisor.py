#!/usr/bin/env python3
"""Rules-based heating advice for the /hvac panel (packages/hvac_schedule.yaml).

Usage: hvac_advisor.py last_month|month_to_date|trial [--db PATH] [--out PATH]

Reads the recorder database read-only: hourly long-term statistics for the period, plus the
last 10 days of states for furnace burn lengths and warm-ups (the recorder keeps no more).
Writes JSON for sensor.hvac_advice. Every rule is plain arithmetic on what the house actually
did; nothing here changes the thermostat. Suggestions may carry an `apply` block, which the
panel turns into a one-tap button.
"""
from __future__ import annotations

import json
import sqlite3
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

DB = Path("/config/home-assistant_v2.db")
OUT = Path("/config/hvac_advice.json")
CORE_CONFIG = Path("/config/.storage/core.config")

STAT = {
    "heat_h": "sensor.hvac_heating_runtime",
    "fan_h": "sensor.hvac_fan_runtime",
    "therm": "sensor.hvac_gas_usage_total",
    "gas_usd": "sensor.hvac_gas_cost_total",
    "elec_usd": "sensor.hvac_electric_cost_total",
    "t_mid": "sensor.thermostat_temperature",
    "t_bed": "sensor.tp358s_1c99_temperature",
    "t_base": "sensor.tp358s_f429_temperature",
    "t_out": "sensor.outdoor_temperature",
    "early": "sensor.hvac_warm_up_minutes_early",
}
SUMS = {"heat_h", "fan_h", "therm", "gas_usd", "elec_usd"}
HELPERS = [
    "input_number.hvac_blower_kw", "input_number.hvac_furnace_btuh", "input_number.hvac_gas_usd_per_therm",
    "input_number.fc_rate_winter_on_peak", "input_number.fc_rate_winter_off_peak",
    "input_number.fc_rate_summer_on_peak", "input_number.fc_rate_summer_off_peak",
    "input_number.hvac_day_temp", "input_number.hvac_night_temp", "input_number.hvac_sleep_target",
    "input_number.hvac_preheat_rate", "input_datetime.hvac_setback", "input_datetime.hvac_fan_trial_start",
    "input_boolean.hvac_schedule", "input_boolean.hvac_fan_trial", "input_boolean.hvac_fan_peak_auto",
]
BALANCE_F = 60  # house needs no heat above ~60 °F outside (sun + people), measured Oct–Nov 2026
TRIAL_DAYS = 14


def tz() -> ZoneInfo:
    try:
        return ZoneInfo(json.loads(CORE_CONFIG.read_text())["data"]["time_zone"])
    except Exception:
        return ZoneInfo("America/Denver")


class Recorder:
    def __init__(self, path: Path):
        self.db = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=30)

    def hourly(self, stat_id: str, start: datetime, end: datetime, want_sum: bool) -> dict[float, float]:
        """{hour start ts: value}; for sums, the change during that hour."""
        row = self.db.execute("SELECT id FROM statistics_meta WHERE statistic_id = ?", (stat_id,)).fetchone()
        if not row:
            return {}
        lo = start.timestamp() - (3600 if want_sum else 0)
        rows = self.db.execute(
            "SELECT start_ts, mean, sum FROM statistics WHERE metadata_id = ? AND start_ts >= ? AND start_ts < ? ORDER BY start_ts",
            (row[0], lo, end.timestamp()),
        ).fetchall()
        out, prev = {}, None
        for ts, mean, total in rows:
            if want_sum:
                if prev is not None and total is not None and ts >= start.timestamp():
                    out[ts] = max(0.0, total - prev)
                prev = total if total is not None else prev
            elif mean is not None:
                out[ts] = mean
        return out

    def hourly_min(self, stat_id: str, start: datetime, end: datetime) -> dict[float, float]:
        row = self.db.execute("SELECT id FROM statistics_meta WHERE statistic_id = ?", (stat_id,)).fetchone()
        if not row:
            return {}
        rows = self.db.execute(
            "SELECT start_ts, min FROM statistics WHERE metadata_id = ? AND start_ts >= ? AND start_ts < ?",
            (row[0], start.timestamp(), end.timestamp()),
        ).fetchall()
        return {ts: v for ts, v in rows if v is not None}

    def states(self, entity_id: str, since: datetime) -> list[tuple[float, str]]:
        rows = self.db.execute(
            "SELECT s.last_updated_ts, s.state FROM states s JOIN states_meta m ON s.metadata_id = m.metadata_id "
            "WHERE m.entity_id = ? AND s.last_updated_ts >= ? ORDER BY s.last_updated_ts",
            (entity_id, since.timestamp()),
        ).fetchall()
        return [(ts, st) for ts, st in rows]

    def latest(self, entity_id: str) -> tuple[str | None, dict]:
        row = self.db.execute(
            "SELECT s.state, a.shared_attrs FROM states s JOIN states_meta m ON s.metadata_id = m.metadata_id "
            "LEFT JOIN state_attributes a ON s.attributes_id = a.attributes_id "
            "WHERE m.entity_id = ? ORDER BY s.last_updated_ts DESC LIMIT 1",
            (entity_id,),
        ).fetchone()
        if not row:
            return None, {}
        try:
            attrs = json.loads(row[1]) if row[1] else {}
        except ValueError:
            attrs = {}
        return row[0], attrs


def fnum(v, default=None):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def on_peak(t: datetime) -> bool:
    """Fort Collins ToD (same hours as custom_templates/fc_tod.jinja; holidays ignored here)."""
    if t.weekday() >= 5:
        return False
    return 14 <= t.hour < 19 if 5 <= t.month <= 9 else 17 <= t.hour < 21


def period_bounds(kind: str, now: datetime, h: dict) -> tuple[datetime, datetime, str]:
    first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if kind == "last_month":
        start = (first - timedelta(days=1)).replace(day=1)
        return start, first, start.strftime("%B")
    if kind == "month_to_date":
        return first, now, f"{now.strftime('%B')} so far"
    if kind == "trial":
        d = h.get("input_datetime.hvac_fan_trial_start")
        start = datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=now.tzinfo) if d and d[:1].isdigit() else now - timedelta(days=TRIAL_DAYS)
        return start, min(now, start + timedelta(days=TRIAL_DAYS)), "fan trial"
    raise SystemExit(f"unknown period {kind!r}")


def burns(rec: Recorder, start: datetime, end: datetime) -> list[float]:
    """Minutes of each furnace burn (sensor.hvac_activity == heating) inside the window."""
    rows = [(ts, s) for ts, s in rec.states("sensor.hvac_activity", start) if ts < end.timestamp()]
    out, on = [], None
    for ts, s in rows:
        if s == "heating" and on is None:
            on = ts
        elif s != "heating" and on is not None:
            if s not in ("unavailable", "unknown"):
                out.append((ts - on) / 60)
            on = None
    return out


def warmups(rec: Recorder, start: datetime) -> list[dict]:
    seen, out = set(), []
    for _, s in rec.states("input_text.hvac_warmup", start):
        try:
            w = json.loads(s)
        except ValueError:
            continue
        if w.get("done") and isinstance(w.get("early_min"), (int, float)) and w.get("start") not in seen:
            seen.add(w["start"])
            out.append(w)
    return out


def main(argv: list[str]) -> int:
    args = list(argv[1:])
    db, out = DB, OUT
    if "--db" in args:
        i = args.index("--db"); db = Path(args[i + 1]); del args[i:i + 2]
    if "--out" in args:
        i = args.index("--out"); out = Path(args[i + 1]); del args[i:i + 2]
    kind = args[0] if args else "month_to_date"
    if kind not in ("last_month", "month_to_date", "trial"):
        print(f"usage: {argv[0]} last_month|month_to_date|trial", file=sys.stderr)
        return 2

    zone = tz()
    now = datetime.now(zone)
    errors: list[str] = []
    rec = Recorder(db)
    h = {e: rec.latest(e)[0] for e in HELPERS}
    climate_state, climate = rec.latest("climate.thermostat")
    start, end, label = period_bounds(kind, now, h)

    blower_kw = fnum(h["input_number.hvac_blower_kw"], 0.5)
    furnace = fnum(h["input_number.hvac_furnace_btuh"], 80000)
    price = fnum(h["input_number.hvac_gas_usd_per_therm"], 0.9)
    rates = {
        (True, "winter"): fnum(h["input_number.fc_rate_winter_on_peak"], 0.30),
        (False, "winter"): fnum(h["input_number.fc_rate_winter_off_peak"], 0.09),
        (True, "summer"): fnum(h["input_number.fc_rate_summer_on_peak"], 0.32),
        (False, "summer"): fnum(h["input_number.fc_rate_summer_off_peak"], 0.09),
    }
    day_t = fnum(h["input_number.hvac_day_temp"], 67)
    night_t = fnum(h["input_number.hvac_night_temp"], 63)
    sleep_t = fnum(h["input_number.hvac_sleep_target"], 64)

    # ---- hourly table -------------------------------------------------------------------
    series = {k: rec.hourly(v, start, end, k in SUMS) for k, v in STAT.items()}
    mid_min = rec.hourly_min(STAT["t_mid"], start, end)
    hours = sorted(set().union(*[set(s) for k, s in series.items() if k in SUMS]))
    if not hours:
        errors.append("No HVAC statistics for this period yet.")
    H = []
    for ts in hours:
        t = datetime.fromtimestamp(ts, zone)
        H.append({"ts": ts, "t": t, **{k: series[k].get(ts) for k in STAT}, "mid_min": mid_min.get(ts)})
    days_covered = len(H) / 24

    def total(k):
        return sum(r[k] or 0 for r in H)

    therms, gas_usd, elec_usd, heat_h, fan_h = (total(k) for k in ("therm", "gas_usd", "elec_usd", "heat_h", "fan_h"))
    fan_usd = sum((r["fan_h"] or 0) * blower_kw * rates[(on_peak(r["t"]), "summer" if 5 <= r["t"].month <= 9 else "winter")] for r in H)
    fan_peak_usd = sum((r["fan_h"] or 0) * blower_kw * rates[(True, "winter")] for r in H if on_peak(r["t"]) and not 5 <= r["t"].month <= 9)
    fan_peak_usd -= sum((r["fan_h"] or 0) * blower_kw * rates[(False, "winter")] for r in H if on_peak(r["t"]) and not 5 <= r["t"].month <= 9)
    out_hours = [r for r in H if r["t_out"] is not None]
    hdd = sum(max(0.0, BALANCE_F - r["t_out"]) for r in out_hours) / 24 if out_hours else None
    hdd_full = hdd * len(H) / len(out_hours) if out_hours and len(out_hours) >= 0.8 * len(H) else None
    per_month = 30.4 / days_covered if days_covered else 0

    def per_hdd(rows):
        oh = [r for r in rows if r["t_out"] is not None]
        d = sum(max(0.0, BALANCE_F - r["t_out"]) for r in oh) / 24
        th = sum(r["therm"] or 0 for r in oh)
        return (th / d) if d >= 5 else None

    eff = per_hdd(H)
    prev_start = (start - timedelta(days=1)).replace(day=1)
    prev_rows = []
    if kind != "trial":
        ps = {k: rec.hourly(STAT[k], prev_start, start, k in SUMS) for k in ("therm", "t_out")}
        prev_rows = [{"therm": ps["therm"].get(ts), "t_out": ps["t_out"].get(ts)} for ts in ps["therm"]]
    prev_eff = per_hdd(prev_rows) if prev_rows else None

    # ---- nights: 22:00–04:00, keyed by the evening's date -------------------------------
    nights: dict = {}
    for r in H:
        hr = r["t"].hour
        if hr >= 22 or hr < 4:
            key = (r["t"] - timedelta(hours=12)).date()
            nights.setdefault(key, []).append(r)
    night_rows = []
    for d, rows in sorted(nights.items()):
        bed = [r["t_bed"] for r in rows if r["t_bed"] is not None]
        mins = [r["mid_min"] for r in rows if r["mid_min"] is not None]
        if len(bed) >= 4:
            night_rows.append({"date": d.isoformat(), "bed": statistics.mean(bed), "mid_min": min(mins) if mins else None,
                               "heat_h": sum(r["heat_h"] or 0 for r in rows)})
    heating_nights = [n for n in night_rows if n["mid_min"] is not None]
    reached = [n for n in heating_nights if n["mid_min"] <= night_t + 0.5]
    bed_avg = statistics.mean(n["bed"] for n in night_rows) if night_rows else None
    warm_nights = [n for n in night_rows if n["bed"] > sleep_t + 1]

    # UA in gas-input terms (BTU/h per °F), from therms per degree-day.
    ua = eff * 1e5 / 24 if eff else None

    # ---- last 10 days: burns and warm-ups ----------------------------------------------
    recent = max(start, now - timedelta(days=10))
    b = burns(rec, recent, end)
    w = [x for x in warmups(rec, start) if x.get("start", "") < end.isoformat()]

    metrics = {
        "days": round(days_covered, 1),
        "gas_therms": round(therms, 1), "gas_usd": round(gas_usd, 2),
        "elec_usd": round(elec_usd, 2), "fan_usd": round(fan_usd, 2),
        "total_usd": round(gas_usd + elec_usd, 2),
        "heating_hours": round(heat_h, 1), "fan_only_hours": round(fan_h, 1),
        "hdd60": round(hdd_full, 1) if hdd_full is not None else None,
        "therms_per_hdd": round(eff, 3) if eff else None,
        "prev_therms_per_hdd": round(prev_eff, 3) if prev_eff else None,
        "ua_btuh_per_f": round(ua) if ua else None,
        "bedroom_night_avg": round(bed_avg, 1) if bed_avg is not None else None,
        "nights": len(night_rows), "nights_reached_setback": len(reached),
        "burn_median_min": round(statistics.median(b), 1) if len(b) >= 5 else None,
        "burns_per_day": round(len(b) / max(1, (end - recent).total_seconds() / 86400), 1) if b else 0,
        "warmups": len(w),
        "warmup_early_median_min": round(statistics.median(x["early_min"] for x in w)) if w else None,
        "warmup_rate": fnum(h["input_number.hvac_preheat_rate"]),
        "fan_mode": climate.get("fan_mode"),
    }

    S: list[dict] = []

    def add(id_, kind_, title, detail, usd=None, apply=None):
        S.append({"id": id_, "kind": kind_, "title": title, "detail": detail,
                  "usd_month": round(usd, 2) if usd is not None else None, **({"apply": apply} if apply else {})})

    # ---- trial ------------------------------------------------------------------------
    trial = None
    if kind == "trial" or h.get("input_boolean.hvac_fan_trial") == "on":
        trial = trial_result(rec, h, zone, now, rates, blower_kw)
        if kind == "trial" and trial:
            label = f"fan trial ({trial['days_on']} On days vs {trial['days_auto']} Auto days)"

    # ---- rules ------------------------------------------------------------------------
    fan_mode = climate.get("fan_mode")
    fan_month = fan_usd * per_month
    if trial and trial.get("verdict") and not h.get("input_boolean.hvac_fan_trial") == "on":
        if trial["recommend"] == "auto":
            add("fan_trial", "action", "Switch the fan to Auto", trial["verdict"], trial.get("usd_month"),
                {"label": "Fan to Auto", "service": "climate.set_fan_mode", "data": {"entity_id": "climate.thermostat", "fan_mode": "auto"}})
        elif trial["recommend"] == "peak_auto" and h.get("input_boolean.hvac_fan_peak_auto") != "on":
            add("fan_trial", "action", "Keep the fan on, but not 5–9 pm on weekdays", trial["verdict"], trial.get("usd_month_peak"),
                {"label": "Auto on-peak", "service": "input_boolean.turn_on", "data": {"entity_id": "input_boolean.hvac_fan_peak_auto"}})
        else:
            add("fan_trial", "ok", "Fan trial: keep circulating", trial["verdict"])
    elif h.get("input_boolean.hvac_fan_trial") == "on" and trial:
        add("fan_trial", "info", f"Fan trial running · day {trial['day'] + 1} of {TRIAL_DAYS}",
            f"So far {trial['days_on']} On days and {trial['days_auto']} Auto days. Results come in a push when it ends.")
    elif fan_mode == "on" and fan_month >= 5:
        peak_month = fan_peak_usd * per_month
        add("fan_cost", "action", f"The fan ran {fan_h:.0f} h on its own",
            f"Continuous fan cost about ${fan_month:.0f}/month at {blower_kw:.2f} kW, ${peak_month:.0f} of it 5–9 pm on weekdays. "
            "Auto during those hours keeps most of the mixing for less.", peak_month,
            {"label": "Auto on-peak", "service": "input_boolean.turn_on", "data": {"entity_id": "input_boolean.hvac_fan_peak_auto"}}
            if h.get("input_boolean.hvac_fan_peak_auto") != "on" and peak_month >= 1 else None)

    if b and metrics["burn_median_min"] is not None and metrics["burn_median_min"] < 5 and len(b) >= 20:
        add("short_cycles", "action", f"Furnace runs in short bursts ({metrics['burn_median_min']:.1f} min)",
            f"{len(b)} burns in the last {(end - recent).days} days. A gas furnace is least efficient in its first few minutes, "
            "so set Heat cycle rate to 3 CPH in the thermostat's installer menu (it can't be changed from HA). "
            "Expect ~2–5% less gas and slightly wider swings.", 0.035 * gas_usd * per_month)

    if night_rows and bed_avg is not None and len(warm_nights) >= max(3, len(night_rows) // 2):
        sb = h.get("input_datetime.hvac_setback") or "19:45:00"
        try:
            sb_t = datetime.strptime(sb, "%H:%M:%S")
            earlier = (sb_t - timedelta(minutes=30)).strftime("%H:%M:%S")
        except ValueError:
            earlier = None
        add("bedroom_warm", "info", f"Bedroom averaged {bed_avg:.0f}° overnight (target {sleep_t:.0f}°)",
            f"Warmer than {sleep_t + 1:.0f}° on {len(warm_nights)} of {len(night_rows)} nights. The house only coasts down a few degrees "
            "overnight, so the thermostat can't make the upstairs cold; an earlier setback helps a little and costs nothing.",
            None, {"label": "Setback 30 min earlier", "service": "input_datetime.set_datetime",
                   "data": {"entity_id": "input_datetime.hvac_setback", "time": earlier}} if earlier else None)

    if heating_nights:
        share = len(reached) / len(heating_nights)
        if share < 0.25:
            add("setback_depth", "ok", f"Night setting reached on {len(reached)} of {len(heating_nights)} nights",
                f"The house coasts slowly, so a lower night temperature than {night_t:.0f}° wouldn't save anything yet. "
                "This changes on cold nights; it's re-checked every month.")
        elif ua:
            hrs = sum(1 for r in H if r["mid_min"] is not None and r["mid_min"] <= night_t + 0.5 and (r["t"].hour >= 22 or r["t"].hour < 4))
            usd = hrs * 2 * ua / 1e5 * price * per_month
            if usd >= 1:
                add("setback_depth", "action", f"Try a {night_t - 2:.0f}° night setting",
                    f"The house sat at {night_t:.0f}° for {hrs} night hours. Two degrees lower saves about ${usd:.0f}/month "
                    "and makes the bedroom colder, which you prefer.", usd,
                    {"label": f"Night to {night_t - 2:.0f}°", "service": "input_number.set_value",
                     "data": {"entity_id": "input_number.hvac_night_temp", "value": night_t - 2}})

    if w:
        med = metrics["warmup_early_median_min"]
        late = [x for x in w if x["early_min"] < -10]
        if len(late) >= 3:
            add("warmup_late", "info", f"Warm-up finished late on {len(late)} mornings",
                f"The learned rate ({metrics['warmup_rate']}°/h) is catching up on its own. Move the warm-by time earlier if mornings feel cold.")
        elif med is not None and med > 30:
            add("warmup_early", "info", f"Warm-up finishes ~{med} min early",
                "The learned rate adjusts by itself; nothing to do unless it stays this early.")

    if eff and prev_eff and therms > 10 and eff > prev_eff * 1.15:
        add("efficiency", "action", f"Gas per cold degree is up {100 * (eff / prev_eff - 1):.0f}%",
            f"{eff:.3f} therms per degree-day vs {prev_eff:.3f} the month before. A clogged filter, a door or window left open, "
            "or a change in setpoints are the usual causes. Check the filter first.")

    if abs(blower_kw - 0.5) < 1e-6 and abs(furnace - 80000) < 1 and h.get("input_number.hvac_blower_kw") is not None:
        add("assumptions", "info", "Costs still use default equipment numbers",
            "Enter the furnace's gas input (BTU/h) and blower size from its rating plate under “How costs are estimated”; "
            "every dollar figure here scales with them.")

    order = {"action": 0, "info": 1, "ok": 2}
    S.sort(key=lambda s: (order[s["kind"]], -(s["usd_month"] or 0)))

    if H:
        summary = f"{label}: ${gas_usd + elec_usd:.0f} (gas ${gas_usd:.0f}, electric ${elec_usd:.0f})"
        if hdd_full:
            summary += f" over {hdd_full:.0f} heating degree-days"
        n_act = sum(1 for s in S if s["kind"] == "action")
        summary += f" · {n_act} suggestion{'s' if n_act != 1 else ''}" if n_act else " · nothing to change"
    else:
        summary = f"{label}: no data yet"

    doc = {
        "schema": 1,
        "generated": now.isoformat(timespec="seconds"),
        "period": {"kind": kind, "start": start.isoformat(), "end": end.isoformat(), "label": label},
        "summary": summary,
        "metrics": metrics,
        "suggestions": S,
        "trial": trial,
        "errors": errors,
    }
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, indent=1))
    tmp.replace(out)
    print(summary)
    return 0


def trial_result(rec: Recorder, h: dict, zone, now: datetime, rates, blower_kw) -> dict | None:
    d = h.get("input_datetime.hvac_fan_trial_start")
    if not d or not d[:1].isdigit():
        return None
    start = datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=zone)
    end = min(now, start + timedelta(days=TRIAL_DAYS))
    s = {k: rec.hourly(STAT[k], start, end, k in SUMS) for k in ("fan_h", "therm", "t_mid", "t_bed", "t_base", "t_out")}
    days: dict = {}
    for ts in s["fan_h"]:
        t = datetime.fromtimestamp(ts, zone)
        days.setdefault(t.date(), []).append({k: s[k].get(ts) for k in s} | {"t": t})
    groups = {"on": [], "auto": []}
    for day, rows in sorted(days.items()):
        if len(rows) < 22:
            continue
        mode = "on" if sum(r["fan_h"] or 0 for r in rows) >= 6 else "auto"
        # Skip the first 3 h after midnight: the air is still mixed (or not) from the day before.
        rs = [r for r in rows if r["t"].hour >= 3]
        def avg(f):
            v = [f(r) for r in rs if None not in (r["t_bed"], r["t_mid"], r["t_base"])]
            return statistics.mean(v) if v else None
        night = [r["t_bed"] for r in rs if r["t"].hour >= 22 and r["t_bed"] is not None]
        oh = [r for r in rows if r["t_out"] is not None]
        hdd = sum(max(0.0, BALANCE_F - r["t_out"]) for r in oh) / 24 if oh else 0
        groups[mode].append({
            "date": day.isoformat(),
            "spread": avg(lambda r: r["t_bed"] - r["t_base"]),
            "bed_minus_mid": avg(lambda r: r["t_bed"] - r["t_mid"]),
            "bed_night": statistics.mean(night) if night else None,
            "therms": sum(r["therm"] or 0 for r in rows), "hdd": hdd,
            "fan_usd": sum((r["fan_h"] or 0) * blower_kw * rates[(on_peak(r["t"]), "winter")] for r in rows),
            "fan_peak_extra": sum((r["fan_h"] or 0) * blower_kw * (rates[(True, "winter")] - rates[(False, "winter")]) for r in rows if on_peak(r["t"])),
        })

    def g(mode, key):
        v = [x[key] for x in groups[mode] if x[key] is not None]
        return statistics.mean(v) if v else None

    def eff(mode):
        th = sum(x["therms"] for x in groups[mode]); dd = sum(x["hdd"] for x in groups[mode])
        return th / dd if dd >= 3 else None

    res = {
        "day": (now.date() - start.date()).days,
        "days_on": len(groups["on"]), "days_auto": len(groups["auto"]),
        "spread_on": g("on", "spread"), "spread_auto": g("auto", "spread"),
        "bed_mid_on": g("on", "bed_minus_mid"), "bed_mid_auto": g("auto", "bed_minus_mid"),
        "bed_night_on": g("on", "bed_night"), "bed_night_auto": g("auto", "bed_night"),
        "therm_per_hdd_on": eff("on"), "therm_per_hdd_auto": eff("auto"),
        "fan_usd_day_on": g("on", "fan_usd"), "fan_peak_extra_day_on": g("on", "fan_peak_extra"),
        "verdict": None, "recommend": None,
    }
    for k, v in list(res.items()):
        if isinstance(v, float):
            res[k] = round(v, 3 if "therm" in k else 2)
    if res["days_on"] < 3 or res["days_auto"] < 3 or res["spread_on"] is None or res["spread_auto"] is None:
        return res
    extra = res["spread_auto"] - res["spread_on"]
    gas_note = ""
    if res["therm_per_hdd_on"] and res["therm_per_hdd_auto"]:
        diff = 100 * (res["therm_per_hdd_auto"] / res["therm_per_hdd_on"] - 1)
        gas_note = f" Gas per cold degree was {abs(diff):.0f}% {'higher' if diff > 0 else 'lower'} on Auto days."
    fan_month = (res["fan_usd_day_on"] or 0) * 30.4
    res["usd_month"] = round(fan_month, 2)
    res["usd_month_peak"] = round((res["fan_peak_extra_day_on"] or 0) * 30.4 * 5 / 7, 2)
    base = (f"Bedroom-to-basement gap: {res['spread_on']:.1f}° with the fan On, {res['spread_auto']:.1f}° on Auto "
            f"({res['days_on']} vs {res['days_auto']} days). Bedroom overnight: {res['bed_night_on'] or 0:.1f}° vs {res['bed_night_auto'] or 0:.1f}°.")
    if extra < 1.5:
        res["recommend"] = "auto"
        res["verdict"] = f"Auto kept the floors almost as even (+{max(extra, 0):.1f}°) and saves about ${fan_month:.0f}/month. {base}{gas_note}"
    elif extra < 3:
        res["recommend"] = "peak_auto"
        res["verdict"] = (f"The fan evens the floors by {extra:.1f}°. Keeping it but switching to Auto 5–9 pm on weekdays "
                          f"saves about ${res['usd_month_peak']:.0f}/month. {base}{gas_note}")
    else:
        res["recommend"] = "on"
        res["verdict"] = f"The fan really does even out the house ({extra:.1f}° difference), so it's worth its ~${fan_month:.0f}/month. {base}{gas_note}"
    return res


if __name__ == "__main__":
    sys.exit(main(sys.argv))
