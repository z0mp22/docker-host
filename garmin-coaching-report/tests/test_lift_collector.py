"""Regression test for a real bug caught while verifying this feature live:
build_lift_payload originally sent collect_recent_health()'s raw output
straight to Claude -- raw Garmin body-battery data is a full time-series
array, and the uncompressed payload measured ~122k tokens for just 2 days.
The fix routes recovery data through compression.compress_week() (the same
"compact" summarization the mountain report always applies), same as every
other Garmin payload in this codebase.
"""

import json
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

from coaching_report.lift_collector import build_lift_payload

# A body-battery time series shaped like Garmin's real API response --
# hundreds of [timestamp, status, value] triples in one flat array, the
# actual source of the bloat this test guards against.
_HUGE_BODY_BATTERY = [
    {"bodyBatteryValuesArray": [[i * 1000, "MEASURED", 50 + (i % 20)] for i in range(200)]}
]


def _fake_garmin_client():
    client = MagicMock()

    def safe_call(method, *args, **kwargs):
        if method == "get_body_battery":
            return _HUGE_BODY_BATTERY
        if method == "get_activities_by_date":
            return []
        return {}

    client.safe_call.side_effect = safe_call
    return client


def _fake_wger_client():
    wger = MagicMock()
    wger.get_recent_sessions.return_value = []
    wger.get_bodyweight_history.return_value = []
    return wger


def _fake_config(tmp_path: Path):
    config = MagicMock()
    config.athlete_timezone = "America/Denver"
    config.athlete_location = "Fort Collins, CO"
    config.unit_system = "metric"
    config.wger_history_sessions = 6
    config.report_output_dir = tmp_path
    return config


def test_recent_recovery_is_compressed_not_raw(tmp_path):
    payload = build_lift_payload(
        _fake_garmin_client(),
        _fake_wger_client(),
        _fake_config(tmp_path),
        catalog=[],
        session_type="heavy_1h",
        shoulder_flag=False,
        session_date=date(2026, 9, 19),
    )

    recent_recovery = payload["recent_recovery"]
    assert len(recent_recovery) == 2  # days=2

    for day_entry in recent_recovery:
        bb = day_entry.get("body_battery")
        # Compact shape is a tiny {high, low, end} summary, never the raw
        # per-entry array -- this is the actual regression guard.
        assert bb is None or set(bb.keys()) <= {"high", "low", "end"}

    # The whole thing must be small -- the original bug produced ~487KB for
    # 2 days from this exact fixture shape. A generous ceiling here still
    # catches any reintroduction of the raw time series by orders of
    # magnitude, without being a brittle exact-byte-count assertion.
    size = len(json.dumps(recent_recovery, default=str))
    assert size < 5_000, f"recent_recovery is {size} bytes -- looks uncompressed again"


def test_session_type_passed_through(tmp_path):
    payload = build_lift_payload(
        _fake_garmin_client(),
        _fake_wger_client(),
        _fake_config(tmp_path),
        catalog=[],
        session_type="shoulder_pt",
        shoulder_flag=True,
        session_date=date(2026, 9, 19),
    )
    assert payload["session_type"] == "shoulder_pt"
    assert payload["flags"] == {"shoulder_flag_active": True}


def test_recent_feedback_included_from_the_persistent_log(tmp_path):
    from coaching_report.lift_feedback import append_feedback

    append_feedback(tmp_path, "Loved the pull day, felt strong.")
    append_feedback(tmp_path, "Left shoulder was cranky after Tuesday's session.")

    payload = build_lift_payload(
        _fake_garmin_client(),
        _fake_wger_client(),
        _fake_config(tmp_path),
        catalog=[],
        session_type="heavy_1h",
        shoulder_flag=False,
        session_date=date(2026, 9, 19),
    )

    notes = [e["note"] for e in payload["recent_feedback"]]
    assert notes == [
        "Loved the pull day, felt strong.",
        "Left shoulder was cranky after Tuesday's session.",
    ]
