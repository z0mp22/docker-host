"""Unit tests for wger_client.py -- no real network calls (all requests
methods are mocked). Verifies the request shapes this client sends, not
wger's actual behavior -- the real endpoint's field names are verified
against the live self-hosted instance during initial deployment (Stage 1 of
the implementation plan's verification section); if that reveals a mismatch,
update the client AND these tests together.
"""

import itertools
from unittest.mock import MagicMock, patch

import pytest

from coaching_report.errors import WgerError
from coaching_report.lift_coach import ExercisePrescription, SessionPlanResponse
from coaching_report.wger_client import WgerClient


def _resp(status=200, json_body=None, text=""):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = json_body if json_body is not None else {}
    m.text = text
    return m


def test_requires_url_and_token():
    with pytest.raises(WgerError):
        WgerClient("", "token")
    with pytest.raises(WgerError):
        WgerClient("http://wger.local", "")


def test_auth_header_set():
    client = WgerClient("http://wger.local", "abc123")
    assert client._session.headers["Authorization"] == "Token abc123"


@patch("requests.Session.get")
def test_get_all_follows_pagination(mock_get):
    mock_get.side_effect = [
        _resp(200, {"results": [{"id": 1}], "next": "http://wger.local/api/v2/x/?offset=1"}),
        _resp(200, {"results": [{"id": 2}], "next": None}),
    ]
    client = WgerClient("http://wger.local", "tok")
    out = client._get_all("/api/v2/x/")
    assert [o["id"] for o in out] == [1, 2]
    assert mock_get.call_count == 2


@patch("requests.Session.get")
def test_get_all_raises_on_non_200(mock_get):
    mock_get.return_value = _resp(500, text="boom")
    client = WgerClient("http://wger.local", "tok")
    with pytest.raises(WgerError):
        client._get_all("/api/v2/x/")


@patch("requests.Session.get")
def test_get_all_raises_on_unexpected_shape(mock_get):
    """Guards the "no assumptions" boundary -- a response missing `results`
    must raise, not be silently treated as an empty list."""
    mock_get.return_value = _resp(200, {"not_results": []})
    client = WgerClient("http://wger.local", "tok")
    with pytest.raises(WgerError):
        client._get_all("/api/v2/x/")


@patch("requests.Session.post")
def test_post_raises_on_non_2xx(mock_post):
    mock_post.return_value = _resp(400, text="bad request")
    client = WgerClient("http://wger.local", "tok")
    with pytest.raises(WgerError):
        client._post("/api/v2/x/", {"a": 1})


@patch("requests.Session.get")
def test_exercise_catalog_filters_cardio_and_resolves_english_name(mock_get):
    mock_get.side_effect = [
        _resp(200, {"results": [{"id": 2, "short_name": "en"}, {"id": 1, "short_name": "de"}], "next": None}),
        _resp(
            200,
            {
                "results": [
                    {
                        "id": 10,
                        "category": {"name": "Chest"},
                        "translations": [
                            {"language": 2, "name": "Bench Press"},
                            {"language": 1, "name": "Bankdruecken"},
                        ],
                    },
                    {
                        "id": 11,
                        "category": {"name": "Cardio"},
                        "translations": [{"language": 2, "name": "Running"}],
                    },
                ],
                "next": None,
            },
        ),
    ]
    client = WgerClient("http://wger.local", "tok")
    catalog = client.get_exercise_catalog()
    assert catalog == [{"id": 10, "name": "Bench Press", "category": "Chest"}]


@patch("requests.Session.post")
def test_create_session_writes_flat_replace_configs(mock_post):
    created_ids = itertools.count(101)

    def fake_post(url, json=None, timeout=None):
        return _resp(201, {"id": next(created_ids), **json})

    mock_post.side_effect = fake_post

    plan = SessionPlanResponse(
        session_date="2026-09-19",
        rationale="test",
        summary_text="test summary",
        flags_considered=[],
        exercises=[
            ExercisePrescription(
                exercise_id=10,
                exercise_name="Barbell Row",
                slot_order=1,
                superset_group=None,
                sets=3,
                reps=8,
                weight_kg=60.0,
                rir_target=2.0,
                rest_seconds=90,
                notes=None,
            ),
        ],
    )
    client = WgerClient("http://wger.local", "tok")
    routine_id = client.create_session(plan)
    assert routine_id == 101

    paths = [call.args[0] for call in mock_post.call_args_list]
    assert paths[0].endswith("/api/v2/routine/")
    assert paths[1].endswith("/api/v2/day/")
    assert paths[2].endswith("/api/v2/slot/")
    assert paths[3].endswith("/api/v2/slot-entry/")
    config_paths = paths[4:]
    assert any(p.endswith("/api/v2/sets-config/") for p in config_paths)
    assert any(p.endswith("/api/v2/repetitions-config/") for p in config_paths)
    assert any(p.endswith("/api/v2/weight-config/") for p in config_paths)
    assert any(p.endswith("/api/v2/rir-config/") for p in config_paths)
    assert any(p.endswith("/api/v2/rest-config/") for p in config_paths)

    # Every config write is a flat replace -- never wger's own +/- progression
    # rules (decision 4: fully autoregulated, no periodization machinery).
    for call in mock_post.call_args_list[4:]:
        payload = call.kwargs["json"]
        assert payload["operation"] == "r"
        assert payload["step"] == "abs"
        assert payload["iteration"] == 1


@patch("requests.Session.post")
def test_create_session_groups_supersets_into_one_slot(mock_post):
    created_ids = iter(range(100, 120))

    def fake_post(url, json=None, timeout=None):
        return _resp(201, {"id": next(created_ids), **json})

    mock_post.side_effect = fake_post

    def ex(exercise_id: int, exercise_name: str, superset_group: int | None = None) -> ExercisePrescription:
        return ExercisePrescription(
            exercise_id=exercise_id,
            exercise_name=exercise_name,
            slot_order=1,
            superset_group=superset_group,
            sets=3,
            reps=8,
            weight_kg=None,
            rir_target=None,
            rest_seconds=None,
            notes=None,
        )

    plan = SessionPlanResponse(
        session_date="2026-09-19",
        rationale="test",
        summary_text="test",
        flags_considered=[],
        exercises=[
            ex(1, "A", superset_group=1),
            ex(2, "B", superset_group=1),
            ex(3, "C", superset_group=None),
        ],
    )
    client = WgerClient("http://wger.local", "tok")
    client.create_session(plan)

    slot_calls = [c for c in mock_post.call_args_list if c.args[0].endswith("/api/v2/slot/")]
    # Two slots: one shared by the superset pair, one solo for the third.
    assert len(slot_calls) == 2
    slot_entry_calls = [
        c for c in mock_post.call_args_list if c.args[0].endswith("/api/v2/slot-entry/")
    ]
    assert len(slot_entry_calls) == 3
