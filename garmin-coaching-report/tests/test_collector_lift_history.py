"""_collect_lift_history() is the mountain report's optional Hevy-sourced
strength data -- it must behave exactly like _attach_nutrition()'s existing
FatSecret integration: silently absent when unconfigured, and never allowed
to fail the report when the API errors, is unreachable, or Pro has lapsed.
"""

from datetime import date
from unittest.mock import MagicMock, patch

from coaching_report.collector import _collect_lift_history


def _fake_config(hevy_api_key="key"):
    config = MagicMock()
    config.hevy_api_key = hevy_api_key
    return config


def test_returns_none_when_hevy_not_configured():
    with patch("coaching_report.collector.HevyClient") as hevy_client_cls:
        result = _collect_lift_history(_fake_config(hevy_api_key=""), date(2026, 9, 15), date(2026, 9, 21))
    assert result is None
    hevy_client_cls.assert_not_called()


def test_returns_none_on_any_error_not_just_hevyerror():
    with patch("coaching_report.collector.HevyClient") as hevy_client_cls:
        hevy_client_cls.return_value.get_workouts_since.side_effect = ConnectionError("unreachable")
        result = _collect_lift_history(_fake_config(), date(2026, 9, 15), date(2026, 9, 21))
    assert result is None


def test_sets_in_lb_with_rir_from_rpe_warmups_dropped():
    workout = {
        "id": "w-1",
        "start_time": "2026-09-21T13:47:03+00:00",
        "description": "",
        "exercises": [
            {"title": "Bent Over Row (Barbell)", "sets": [
                {"type": "warmup", "weight_kg": 20.0, "reps": 10, "rpe": None},
                {"type": "normal", "weight_kg": 61.235, "reps": 8, "rpe": 8},
                {"type": "failure", "weight_kg": None, "reps": 12, "rpe": None},
            ]},
        ],
    }
    with patch("coaching_report.collector.HevyClient") as hevy_client_cls:
        hevy_client_cls.return_value.get_workouts_since.return_value = [workout]
        result = _collect_lift_history(_fake_config(), date(2026, 9, 15), date(2026, 9, 21))

    assert result == [
        {
            "date": "2026-09-21",
            "notes": None,
            "impression": None,
            "logs": [
                {"exercise_name": "Bent Over Row (Barbell)", "reps": 8, "weight": 135.0, "weight_unit": "lb", "rir": 2.0},
                {"exercise_name": "Bent Over Row (Barbell)", "reps": 12, "weight": None, "weight_unit": "lb", "rir": None},
            ],
        }
    ]


def test_excludes_workouts_after_the_report_window_end():
    # get_workouts_since(week_start) already enforces the lower bound (tested
    # in test_hevy_client.py); the upper bound is this function's job.
    after_window = {"id": "1", "start_time": "2026-09-25T13:00:00+00:00", "exercises": []}
    with patch("coaching_report.collector.HevyClient") as hevy_client_cls:
        hevy_client_cls.return_value.get_workouts_since.return_value = [after_window]
        result = _collect_lift_history(_fake_config(), date(2026, 9, 15), date(2026, 9, 21))
    assert result == []
