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


def _fake_hevy_client(workouts=()):
    hevy = MagicMock()
    hevy.get_recent_workouts.return_value = list(workouts)
    hevy.get_bodyweight_history.return_value = []
    return hevy


def _fake_config(tmp_path: Path):
    config = MagicMock()
    config.athlete_timezone = "America/Denver"
    config.athlete_location = "Fort Collins, CO"
    config.unit_system = "metric"
    config.lift_history_sessions = 6
    config.report_output_dir = tmp_path
    return config


def test_recent_recovery_is_compressed_not_raw(tmp_path):
    payload = build_lift_payload(
        _fake_garmin_client(),
        _fake_hevy_client(),
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
        _fake_hevy_client(),
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
        _fake_hevy_client(),
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


def _prescription(generated_at, routine_id="r-1", session_type="heavy_1h", weight_lb=135.0):
    return {
        "generated_at": generated_at,
        "session_date": generated_at[:10],
        "session_type": session_type,
        "routine_id": routine_id,
        "exercises": [
            {"exercise_id": "ROW", "exercise_name": "Bent Over Row (Barbell)", "slot_order": 1,
             "superset_group": None, "sets": 3, "reps": 8, "duration_seconds": None,
             "weight_lb": weight_lb, "rir_target": 2.0, "rest_seconds": 90, "notes": None},
        ],
    }


def _write_prescriptions(tmp_path, *entries):
    from coaching_report.emailer import PRESCRIPTIONS_LOG

    with (tmp_path / PRESCRIPTIONS_LOG).open("a") as fh:
        for e in entries:
            fh.write(json.dumps(e) + "\n")


_LOGGED_WORKOUT = {
    "id": "w-1",
    "title": "Next Lift Session",
    "routine_id": "r-1",
    "description": "Felt strong",
    "start_time": "2026-09-25T12:30:00+00:00",
    "exercises": [
        {"title": "Bent Over Row (Barbell)", "exercise_template_id": "ROW", "notes": "",
         "sets": [
             {"type": "warmup", "weight_kg": 20.0, "reps": 10, "rpe": None},
             {"type": "normal", "weight_kg": 61.235, "reps": 8, "rpe": 8},
             {"type": "normal", "weight_kg": 61.235, "reps": 7, "rpe": 9.5},
         ]},
        {"title": "Dead Hang", "exercise_template_id": "HANG", "notes": None,
         "sets": [{"type": "normal", "weight_kg": None, "reps": None, "duration_seconds": 40, "rpe": None}]},
    ],
}


def test_logged_workout_joined_to_the_prescription_it_was_started_from(tmp_path):
    """The routine is overwritten every generation, so the target must come
    from the latest prescription written BEFORE the workout started --
    not an older one, and not one generated afterwards."""
    _write_prescriptions(
        tmp_path,
        _prescription("2026-09-20T06:00:00-06:00", weight_lb=125.0),
        _prescription("2026-09-25T05:00:00-06:00", weight_lb=135.0),  # the one he did
        _prescription("2026-09-26T05:00:00-06:00", weight_lb=145.0),  # generated later
    )
    payload = build_lift_payload(
        _fake_garmin_client(), _fake_hevy_client([_LOGGED_WORKOUT]), _fake_config(tmp_path),
        catalog=[], session_type="heavy_1h", shoulder_flag=False, session_date=date(2026, 9, 26),
    )
    (session,) = payload["recent_lift_sessions"]
    assert session["date"] == "2026-09-25"
    assert session["from_coach_prescription"] is True
    assert session["prescribed_session_type"] == "heavy_1h"
    assert session["athlete_notes"] == "Felt strong"

    row, hang = session["exercises"]
    assert row["prescribed"] == {"sets": 3, "reps": 8, "duration_seconds": None, "weight_lb": 135.0, "rir_target": 2.0}
    assert [s["weight_lb"] for s in row["sets"]] == [44.1, 135.0, 135.0]
    assert [s["rir"] for s in row["sets"]] == [None, 2.0, 0.5]
    assert row["sets"][0]["set_type"] == "warmup"
    assert hang["prescribed"] is None  # he added it himself
    assert hang["sets"][0]["duration_seconds"] == 40


def test_workout_not_started_from_the_coach_routine_has_no_prescription(tmp_path):
    _write_prescriptions(tmp_path, _prescription("2026-09-25T05:00:00-06:00"))
    freestyle = {**_LOGGED_WORKOUT, "routine_id": None}
    payload = build_lift_payload(
        _fake_garmin_client(), _fake_hevy_client([freestyle]), _fake_config(tmp_path),
        catalog=[], session_type="heavy_1h", shoulder_flag=False, session_date=date(2026, 9, 26),
    )
    (session,) = payload["recent_lift_sessions"]
    assert session["from_coach_prescription"] is False
    assert all(ex["prescribed"] is None for ex in session["exercises"])


def test_missing_or_corrupt_prescription_log_is_not_fatal(tmp_path):
    from coaching_report.emailer import PRESCRIPTIONS_LOG
    from coaching_report.lift_collector import load_prescriptions

    assert load_prescriptions(tmp_path) == []
    (tmp_path / PRESCRIPTIONS_LOG).write_text('not json\n{"generated_at": "2026-09-25T05:00:00-06:00"}\n')
    assert load_prescriptions(tmp_path) == [{"generated_at": "2026-09-25T05:00:00-06:00"}]


def test_save_lift_outputs_snapshot_round_trips_into_the_join(tmp_path):
    from coaching_report.emailer import save_lift_outputs
    from coaching_report.lift_coach import ExercisePrescription, SessionPlanResponse
    from coaching_report.lift_collector import load_prescriptions

    plan = SessionPlanResponse(
        session_date="2026-09-25",
        rationale="r",
        summary_text="s",
        exercises=[ExercisePrescription("ROW", "Bent Over Row (Barbell)", 1, None, 3, 8, None, 135.0, 2.0, 90, None)],
    )
    config = _fake_config(tmp_path)
    save_lift_outputs(config, date(2026, 9, 25), plan, {"model": "m"}, "r-1", "heavy_1h")
    save_lift_outputs(config, date(2026, 9, 25), plan, {"model": "m"}, "r-1", "light_30m")

    entries = load_prescriptions(tmp_path)
    assert [e["session_type"] for e in entries] == ["heavy_1h", "light_30m"]  # appended, not overwritten
    assert entries[0]["routine_id"] == "r-1"
    assert entries[0]["exercises"][0]["weight_lb"] == 135.0

    latest = json.loads((tmp_path / "lift_session_latest.json").read_text())
    assert latest["routine_id"] == "r-1"
