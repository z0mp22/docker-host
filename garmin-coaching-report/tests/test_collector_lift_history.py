"""_collect_lift_history() is the mountain report's optional wger-sourced
strength data -- it must behave exactly like _attach_nutrition()'s existing
FatSecret integration: silently absent when unconfigured, and never allowed
to fail the report when the instance errors or is unreachable.
"""

from datetime import date
from unittest.mock import MagicMock, patch

from coaching_report.collector import _collect_lift_history


def _fake_config(wger_url="http://wger-nginx:80", wger_api_token="tok"):
    config = MagicMock()
    config.wger_url = wger_url
    config.wger_api_token = wger_api_token
    return config


def test_returns_none_when_wger_not_configured():
    with patch("coaching_report.collector.WgerClient") as wger_client_cls:
        result = _collect_lift_history(_fake_config(wger_url=""), date(2026, 9, 15), date(2026, 9, 21))
    assert result is None
    wger_client_cls.assert_not_called()


def test_returns_none_on_any_error_not_just_wgererror():
    with patch("coaching_report.collector.WgerClient") as wger_client_cls:
        wger_client_cls.side_effect = ConnectionError("instance unreachable")
        result = _collect_lift_history(_fake_config(), date(2026, 9, 15), date(2026, 9, 21))
    assert result is None


def test_resolves_exercise_name_and_per_set_unit():
    session = {
        "id": "01a0c43a-b677-7620-a789-1a6725b6510b",
        "datetime_start": "2026-09-21T07:47:03.371481-06:00",
        "notes": "",
        "impression": "2",
        "logs": [
            {"exercise": 222, "repetitions": "20.00", "weight": "30.00", "weight_unit": 1, "rir": "4.0"},
            {"exercise": 222, "repetitions": "15.00", "weight": "30.00", "weight_unit": 2, "rir": "4.0"},
        ],
    }
    with patch("coaching_report.collector.WgerClient") as wger_client_cls:
        client = wger_client_cls.return_value
        client.get_exercise_catalog.return_value = [{"id": 222, "name": "Bench Press", "category": "Chest"}]
        client.get_unit_labels.return_value = ({1: "kg", 2: "lb"}, {1: "Repetitions"})
        client.get_workout_history.return_value = [session]

        result = _collect_lift_history(_fake_config(), date(2026, 9, 15), date(2026, 9, 21))

    assert result == [
        {
            "date": "2026-09-21",
            "notes": None,
            "impression": "2",
            "logs": [
                {"exercise_name": "Bench Press", "reps": 20.0, "weight": 30.0, "weight_unit": "kg", "rir": 4.0},
                {"exercise_name": "Bench Press", "reps": 15.0, "weight": 30.0, "weight_unit": "lb", "rir": 4.0},
            ],
        }
    ]


def test_excludes_sessions_after_the_report_window_end():
    # get_workout_history(since=week_start) is expected to have already
    # filtered out anything before week_start (that lower bound is the real
    # WgerClient's job, exercised in wger_client tests) -- what
    # _collect_lift_history itself must still guard is the upper bound,
    # since since= has no "through"/upper-bound counterpart.
    after_window = {
        "id": "1",
        "datetime_start": "2026-09-25T07:00:00-06:00",
        "notes": "",
        "impression": None,
        "logs": [],
    }
    with patch("coaching_report.collector.WgerClient") as wger_client_cls:
        client = wger_client_cls.return_value
        client.get_exercise_catalog.return_value = []
        client.get_unit_labels.return_value = ({}, {})
        client.get_workout_history.return_value = [after_window]

        result = _collect_lift_history(_fake_config(), date(2026, 9, 15), date(2026, 9, 21))

    assert result == []
