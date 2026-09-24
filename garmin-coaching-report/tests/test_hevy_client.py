"""Unit tests for hevy_client.py -- no real network calls (the requests
session is mocked). Verifies the request shapes this client sends against
Hevy's published OpenAPI spec (api.hevyapp.com/docs.json); the live API is
exercised for real in the staged verification (dry run, then one write).
"""

from datetime import date
from unittest.mock import MagicMock

import pytest

from coaching_report.errors import HevyError
from coaching_report.hevy_client import HevyClient, kg_to_lb, lb_to_kg, rpe_to_rir
from coaching_report.lift_coach import ExercisePrescription, SessionPlanResponse


def _resp(status=200, json_body=None, text=""):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = json_body if json_body is not None else {}
    m.text = text
    return m


def _client(*responses):
    client = HevyClient("key-123")
    client._session = MagicMock()
    client._session.request.side_effect = list(responses)
    return client


def _calls(client):
    """(method, path, params, json) for every request made."""
    out = []
    for c in client._session.request.call_args_list:
        method, url = c.args
        out.append((method, url.removeprefix("https://api.hevyapp.com"), c.kwargs.get("params"), c.kwargs.get("json")))
    return out


def _ex(**overrides):
    base = dict(
        exercise_id="55E6546F",
        exercise_name="Bent Over Row (Barbell)",
        slot_order=1,
        superset_group=None,
        sets=3,
        reps=8,
        duration_seconds=None,
        weight_lb=135.0,
        rir_target=2.0,
        rest_seconds=90,
        notes=None,
    )
    base.update(overrides)
    return ExercisePrescription(**base)


def _plan(*exercises):
    return SessionPlanResponse(
        session_date="2026-09-25",
        rationale="r",
        summary_text="# Pull day",
        exercises=list(exercises),
    )


def test_requires_api_key():
    with pytest.raises(HevyError):
        HevyClient("")


def test_api_key_sent_as_header():
    client = HevyClient("key-123")
    assert client._session.headers["api-key"] == "key-123"


def test_non_2xx_raises_hevy_error():
    client = _client(_resp(401, text="Unauthorized"))
    with pytest.raises(HevyError, match="401"):
        client.find_routine_id("Next Lift Session")


def test_paging_follows_page_count():
    client = _client(
        _resp(200, {"page": 1, "page_count": 2, "routines": [{"id": "a", "title": "Other"}]}),
        _resp(200, {"page": 2, "page_count": 2, "routines": [{"id": "b", "title": "Next Lift Session"}]}),
    )
    assert client.find_routine_id("Next Lift Session") == "b"
    assert [c[2]["page"] for c in _calls(client)] == [1, 2]


def test_missing_list_key_raises():
    client = _client(_resp(200, {"page": 1, "page_count": 1}))
    with pytest.raises(HevyError):
        client.find_routine_id("x")


def test_catalog_keeps_strength_and_holds_drops_cardio_and_machines():
    templates = [
        {"id": "1", "title": "Pull Up", "type": "reps_only", "primary_muscle_group": "lats", "equipment": "none"},
        {"id": "2", "title": "Dead Hang", "type": "duration", "primary_muscle_group": "forearms", "equipment": "none"},
        {"id": "3", "title": "Running", "type": "distance_duration", "primary_muscle_group": "cardio", "equipment": "none"},
        {"id": "4", "title": "Stair Machine", "type": "floors_duration", "primary_muscle_group": "quadriceps", "equipment": "machine"},
        {"id": "5", "title": "Sled Push", "type": "short_distance_weight", "primary_muscle_group": "quadriceps", "equipment": "other"},
        {"id": "6", "title": "Jumping Jack", "type": "reps_only", "primary_muscle_group": "cardio", "equipment": "none"},
    ]
    client = _client(_resp(200, {"page": 1, "page_count": 1, "exercise_templates": templates}))
    catalog = client.get_exercise_catalog()
    assert [e["id"] for e in catalog] == ["1", "2"]
    assert catalog[1] == {"id": "2", "name": "Dead Hang", "type": "duration", "muscle": "forearms", "equipment": "none"}


def test_empty_catalog_raises():
    client = _client(_resp(200, {"page": 1, "page_count": 1, "exercise_templates": []}))
    with pytest.raises(HevyError):
        client.get_exercise_catalog()


def test_routine_payload_maps_sets_units_rir_and_supersets():
    client = HevyClient("k")
    plan = _plan(
        _ex(slot_order=2, exercise_id="B", superset_group=1, weight_lb=None, reps=10, rir_target=None, notes="Slow eccentric"),
        _ex(slot_order=1, exercise_id="A", superset_group=1),
        _ex(slot_order=3, exercise_id="H", sets=2, reps=None, duration_seconds=30, weight_lb=None, rir_target=4.0),
    )
    routine = client.routine_payload(plan, "Next Lift Session", "heavy_1h")["routine"]

    assert routine["title"] == "Next Lift Session"
    assert routine["notes"].startswith("2026-09-25 · heavy_1h")
    assert [e["exercise_template_id"] for e in routine["exercises"]] == ["A", "B", "H"]  # slot order

    a, b, h = routine["exercises"]
    assert a["superset_id"] == 1 and b["superset_id"] == 1
    assert len(a["sets"]) == 3
    assert a["sets"][0] == {"type": "normal", "weight_kg": lb_to_kg(135.0), "reps": 8, "duration_seconds": None}
    assert a["notes"] == "Target RIR 2 (RPE 8)"
    assert a["rest_seconds"] == 90
    assert b["sets"][0]["weight_kg"] is None  # bodyweight
    assert b["notes"] == "Slow eccentric"  # no RIR target -> no target text
    assert h["sets"] == [{"type": "normal", "weight_kg": None, "reps": None, "duration_seconds": 30}] * 2
    assert h["notes"] == "Target RIR 4 (RPE 6)"


def test_lb_round_trips_to_the_same_plate_number():
    """Hevy set to lb must display exactly what the coach chose (135, not 134.9)."""
    for lb in (5.0, 22.5, 45.0, 135.0, 225.0, 317.5):
        assert kg_to_lb(lb_to_kg(lb)) == lb


def test_upsert_creates_when_routine_missing():
    client = _client(
        _resp(200, {"page": 1, "page_count": 1, "routines": []}),
        _resp(201, {"routine": [{"id": "new-id", "title": "Next Lift Session"}]}),
    )
    assert client.upsert_session_routine(_plan(_ex()), "Next Lift Session", "heavy_1h") == "new-id"
    method, path, _, body = _calls(client)[1]
    assert (method, path) == ("POST", "/v1/routines")
    assert body["routine"]["title"] == "Next Lift Session"


def test_upsert_accepts_unwrapped_create_response():
    client = _client(
        _resp(200, {"page": 1, "page_count": 1, "routines": []}),
        _resp(201, {"id": "new-id", "title": "Next Lift Session"}),
    )
    assert client.upsert_session_routine(_plan(_ex()), "Next Lift Session", "heavy_1h") == "new-id"


def test_upsert_overwrites_existing_routine_in_place():
    client = _client(
        _resp(200, {"page": 1, "page_count": 1, "routines": [{"id": "r-1", "title": "Next Lift Session"}]}),
        _resp(200, {"id": "r-1"}),
    )
    assert client.upsert_session_routine(_plan(_ex()), "Next Lift Session", "light_30m") == "r-1"
    method, path, _, body = _calls(client)[1]
    assert (method, path) == ("PUT", "/v1/routines/r-1")
    assert "light_30m" in body["routine"]["notes"]


def test_create_without_an_id_raises():
    client = _client(
        _resp(200, {"page": 1, "page_count": 1, "routines": []}),
        _resp(201, {"routine": []}),
    )
    with pytest.raises(HevyError):
        client.upsert_session_routine(_plan(_ex()), "Next Lift Session", "heavy_1h")


def _workout(wid, start):
    return {"id": wid, "start_time": start, "exercises": []}


def test_workouts_since_stops_paging_at_cutoff_and_sorts_oldest_first():
    client = _client(
        _resp(200, {"page": 1, "page_count": 3, "workouts": [
            _workout("c", "2026-09-24T12:00:00Z"), _workout("b", "2026-09-22T12:00:00Z")]}),
        _resp(200, {"page": 2, "page_count": 3, "workouts": [
            _workout("a", "2026-09-21T12:00:00Z"), _workout("old", "2026-09-10T12:00:00Z")]}),
        _resp(200, {"page": 3, "page_count": 3, "workouts": [_workout("older", "2026-09-01T12:00:00Z")]}),
    )
    got = client.get_workouts_since(date(2026, 9, 15))
    assert [w["id"] for w in got] == ["a", "b", "c"]
    # Page 3 is never requested -- page 2 already reached past the cutoff.
    assert [c[2]["page"] for c in _calls(client)] == [1, 2]


def test_workouts_since_stops_when_a_page_has_nothing_recent():
    client = _client(
        _resp(200, {"page": 1, "page_count": 5, "workouts": [_workout("old", "2026-09-01T12:00:00Z")]}),
    )
    assert client.get_workouts_since(date(2026, 9, 15)) == []
    assert len(_calls(client)) == 1


def test_recent_workouts_returns_oldest_first_capped_at_limit():
    client = _client(_resp(200, {"page": 1, "page_count": 1, "workouts": [
        _workout("c", "2026-09-24T12:00:00Z"), _workout("b", "2026-09-22T12:00:00Z"), _workout("a", "2026-09-21T12:00:00Z")]}))
    assert [w["id"] for w in client.get_recent_workouts(2)] == ["b", "c"]
    assert _calls(client)[0][2] == {"page": 1, "pageSize": 2}


def test_bodyweight_history_in_lb_filtered_and_sorted():
    client = _client(_resp(200, {"page": 1, "page_count": 1, "body_measurements": [
        {"date": "2026-09-20", "weight_kg": 81.6},
        {"date": "2026-08-01", "weight_kg": 82.0},
        {"date": "2026-09-18", "weight_kg": None},
        {"date": "2026-09-10", "weight_kg": 82.1},
    ]}))
    assert client.get_bodyweight_history(since=date(2026, 9, 1)) == [
        {"date": "2026-09-10", "weight_lb": kg_to_lb(82.1)},
        {"date": "2026-09-20", "weight_lb": kg_to_lb(81.6)},
    ]


def test_rpe_to_rir():
    assert rpe_to_rir(8) == 2.0
    assert rpe_to_rir(9.5) == 0.5
    assert rpe_to_rir(None) is None
