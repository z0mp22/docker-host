"""Tests for readiness.py: HRV and resting HR against his own baseline walk a
day back only when both are off, two days running or far off today."""

import json
from datetime import date, timedelta

from coaching_report import readiness as rd

TODAY = date(2026, 11, 5)


def _store(today=(75, 16), yesterday=(73, 20), base=(70, 21)):
    s = {}
    for i in range(2, 30):
        s[(TODAY - timedelta(days=i)).isoformat()] = {"rhr": base[0], "hrv": base[1]}
    s[(TODAY - timedelta(days=1)).isoformat()] = {"rhr": yesterday[0], "hrv": yesterday[1]}
    s[TODAY.isoformat()] = {"rhr": today[0], "hrv": today[1]}
    return s


def test_parsers_read_garmins_shapes():
    assert rd.parse_hrv({"hrvSummary": {"lastNightAvg": 22, "weeklyAvg": 21}}) == 22.0
    assert rd.parse_rhr({"allMetrics": {"metricsMap": {"WELLNESS_RESTING_HEART_RATE": [{"value": 75.0}]}}}) == 75.0
    assert rd.parse_hrv(None) is None and rd.parse_rhr({"allMetrics": None}) is None


def test_both_off_two_days_running_eases():
    v = rd.assess(_store(), TODAY)
    assert v["verdict"] == "ease" and v["base_rhr"] == 70 and v["base_hrv"] == 21
    assert v["rhr_up"] == 5 and v["hrv_down_pct"] == 24 and v["yesterday_off"] is True


def test_only_one_signal_off_is_go():
    # Nov 4 for real: RHR 75 (up 5) but HRV 22, at his normal.
    assert rd.assess(_store(today=(75, 22)), TODAY)["verdict"] == "go"
    assert rd.assess(_store(today=(70, 15)), TODAY)["verdict"] == "go"


def test_one_bad_morning_needs_to_be_far_off():
    mild = _store(today=(73.5, 18), yesterday=(70, 21))  # +3.5, -14%: off, but alone
    assert rd.assess(mild, TODAY)["verdict"] == "go"
    big = _store(today=(76, 16), yesterday=(70, 21))  # +6, -24%: far off
    assert rd.assess(big, TODAY)["verdict"] == "ease"


def test_waits_for_todays_numbers_and_a_baseline():
    s = _store()
    s[TODAY.isoformat()] = {"rhr": 75, "hrv": None}
    assert rd.assess(s, TODAY) is None
    short = {k: v for k, v in _store().items() if k >= (TODAY - timedelta(days=5)).isoformat()}
    assert rd.assess(short, TODAY) is None


def test_store_backfills_once_then_only_refreshes_today(tmp_path):
    calls = []

    class Client:
        def safe_call(self, name, day):
            calls.append((name, day))
            if name == "get_rhr_day":
                return {"allMetrics": {"metricsMap": {"WELLNESS_RESTING_HEART_RATE": [{"value": 70.0}]}}}
            return {"hrvSummary": {"lastNightAvg": 21}}

    rd.update_store(Client(), tmp_path, TODAY)
    assert len(calls) == 2 * (rd.BASELINE_DAYS + 1)
    calls.clear()
    rd.update_store(Client(), tmp_path, TODAY)
    assert calls == [("get_rhr_day", TODAY.isoformat()), ("get_hrv_data", TODAY.isoformat())]
    assert json.loads((tmp_path / rd.STORE).read_text())[TODAY.isoformat()] == {"rhr": 70.0, "hrv": 21.0}
