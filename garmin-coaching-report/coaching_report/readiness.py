"""The morning readiness check behind "schedule aggressively, walk it back as
needed" (2026-11-04).

Each morning, once Garmin has last night's HRV and today's resting HR, they're
compared with his own normal: the median of the previous BASELINE_DAYS days.
Only the two together walk a day back, and only when it's more than one bad
reading (his choice: HRV + RHR vs baseline, multi-day):

- ease: RHR up RHR_UP and HRV down HRV_DOWN today, and yesterday was off too
  (RHR up YESTERDAY_RHR_UP or HRV down YESTERDAY_HRV_DOWN); or today alone is
  far off (RHR up BIG_RHR_UP and HRV down BIG_HRV_DOWN).
- go: anything else.

The verdict never changes the plan by itself. A morning push asks him (Keep
it / Ease it), and coach_chat's day mode applies his answer. Daily values are
cached in REPORT_OUTPUT_DIR/recovery_daily.json, so a morning costs two Garmin
calls after the first backfill.
"""

from __future__ import annotations

import json
import statistics
from datetime import date, timedelta
from pathlib import Path
from typing import Any

STORE = "recovery_daily.json"
BASELINE_DAYS = 28
MIN_BASELINE_DAYS = 10
RHR_UP = 3
HRV_DOWN = 0.12
YESTERDAY_RHR_UP = 2
YESTERDAY_HRV_DOWN = 0.08
BIG_RHR_UP = 5
BIG_HRV_DOWN = 0.20


def parse_hrv(raw: Any) -> float | None:
    if not isinstance(raw, dict):
        return None
    summary = raw.get("hrvSummary") or raw
    value = summary.get("lastNightAvg") if isinstance(summary, dict) else None
    return float(value) if isinstance(value, (int, float)) else None


def parse_rhr(raw: Any) -> float | None:
    if not isinstance(raw, dict):
        return None
    rows = ((raw.get("allMetrics") or {}).get("metricsMap") or {}).get("WELLNESS_RESTING_HEART_RATE") or []
    for r in rows:
        if isinstance(r.get("value"), (int, float)):
            return float(r["value"])
    value = raw.get("restingHeartRate")
    return float(value) if isinstance(value, (int, float)) else None


def _load(reports_dir: Path) -> dict[str, dict[str, Any]]:
    try:
        return json.loads((reports_dir / STORE).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def update_store(client: Any, reports_dir: Path, today: date) -> dict[str, dict[str, Any]]:
    """Fill in any of the last BASELINE_DAYS days not cached yet (past days
    are final once both values are in) and refresh today. A failed call just
    leaves that day out."""
    store = _load(reports_dir)
    for i in range(BASELINE_DAYS, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        have = store.get(day) or {}
        if i and have.get("rhr") is not None and have.get("hrv") is not None:
            continue
        try:
            store[day] = {"rhr": parse_rhr(client.safe_call("get_rhr_day", day)),
                          "hrv": parse_hrv(client.safe_call("get_hrv_data", day))}
        except Exception:
            continue
    keep = (today - timedelta(days=BASELINE_DAYS + 7)).isoformat()
    store = {k: v for k, v in store.items() if k >= keep}
    (reports_dir / STORE).write_text(json.dumps(store, indent=1, sort_keys=True), encoding="utf-8")
    return store


def assess(store: dict[str, dict[str, Any]], today: date) -> dict[str, Any] | None:
    """Today's verdict, or None until today's HRV and RHR are both in (or
    there isn't enough history for a baseline)."""
    t = store.get(today.isoformat()) or {}
    if t.get("rhr") is None or t.get("hrv") is None:
        return None
    past = [store.get((today - timedelta(days=i)).isoformat()) or {} for i in range(1, BASELINE_DAYS + 1)]
    rhrs = [p["rhr"] for p in past if p.get("rhr") is not None]
    hrvs = [p["hrv"] for p in past if p.get("hrv") is not None]
    if len(rhrs) < MIN_BASELINE_DAYS or len(hrvs) < MIN_BASELINE_DAYS:
        return None
    base_rhr, base_hrv = statistics.median(rhrs), statistics.median(hrvs)

    def off(v: dict[str, Any]) -> tuple[float, float]:
        up = (v["rhr"] - base_rhr) if v.get("rhr") is not None else 0.0
        down = ((base_hrv - v["hrv"]) / base_hrv) if v.get("hrv") is not None and base_hrv else 0.0
        return up, down

    up, down = off(t)
    y_up, y_down = off(past[0])
    both = up >= RHR_UP and down >= HRV_DOWN
    ease = (both and (y_up >= YESTERDAY_RHR_UP or y_down >= YESTERDAY_HRV_DOWN)) or (up >= BIG_RHR_UP and down >= BIG_HRV_DOWN)
    return {
        "date": today.isoformat(),
        "verdict": "ease" if ease else "go",
        "rhr": t["rhr"], "hrv": t["hrv"],
        "base_rhr": round(base_rhr, 1), "base_hrv": round(base_hrv, 1),
        "rhr_up": round(up, 1), "hrv_down_pct": round(down * 100),
        "yesterday_off": y_up >= YESTERDAY_RHR_UP or y_down >= YESTERDAY_HRV_DOWN,
    }
