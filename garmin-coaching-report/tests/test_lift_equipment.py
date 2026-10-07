"""Home-gym catalog filter and load checks (lift_equipment.py)."""

from coaching_report.lift_coach import ExercisePrescription
from coaching_report.lift_equipment import (
    BARBELL_LOADS,
    CABLE_LOADS,
    home_gym_catalog,
    load_problems,
    snap_free_weights,
)

CATALOG = [
    {"id": "DL", "name": "Deadlift (Barbell)", "type": "weight_reps", "equipment": "barbell", "muscle": "glutes"},
    {"id": "HC", "name": "Hammer Curl (Dumbbell)", "type": "weight_reps", "equipment": "dumbbell", "muscle": "biceps"},
    {"id": "ROW", "name": "Seated Cable Row - V Grip (Cable)", "type": "weight_reps", "equipment": "machine", "muscle": "upper_back"},
    {"id": "PU", "name": "Pull Up", "type": "reps_only", "equipment": "machine", "muscle": "lats"},
    {"id": "KB", "name": "Kettlebell Swing", "type": "weight_reps", "equipment": "kettlebell", "muscle": "full_body"},
    {"id": "LP", "name": "Leg Press (Machine)", "type": "weight_reps", "equipment": "machine", "muscle": "quadriceps"},
    {"id": "BSS", "name": "Bulgarian Split Squat (Dumbbell)", "type": "weight_reps", "equipment": "dumbbell", "muscle": "quadriceps"},
    {"id": "SLR", "name": "Single Leg Romanian Deadlift (Dumbbell)", "type": "weight_reps", "equipment": "dumbbell", "muscle": "hamstrings"},
    {"id": "PRE", "name": "Preacher Curl (Dumbbell)", "type": "weight_reps", "equipment": "dumbbell", "muscle": "biceps"},
    {"id": "TRX", "name": "Low Row (Suspension)", "type": "weight_reps", "equipment": "suspension", "muscle": "upper_back"},
]
BY_ID = {e["id"]: e for e in CATALOG}


def _ex(ex_id, weight, superset=None):
    return ExercisePrescription(ex_id, BY_ID[ex_id]["name"], 1, superset, 3, 10, None, weight, 2.0, 90, None)


def test_catalog_keeps_home_kit_and_drops_machines_benches_and_single_leg():
    kept, dropped = home_gym_catalog(CATALOG)
    assert {e["id"] for e in kept} == {"DL", "HC", "ROW", "PU", "KB"}
    assert dropped["Bulgarian Split Squat (Dumbbell)"] == "single-leg"
    assert dropped["Single Leg Romanian Deadlift (Dumbbell)"] == "single-leg"
    assert dropped["Leg Press (Machine)"] == "not in the home gym"
    assert dropped["Preacher Curl (Dumbbell)"] == "not in the home gym"
    assert dropped["Low Row (Suspension)"] == "not in the home gym"


def test_load_tables_match_the_plate_inventory():
    assert BARBELL_LOADS[0] == 45 and BARBELL_LOADS[-1] == 280
    assert all(b - a == 5 for a, b in zip(BARBELL_LOADS, BARBELL_LOADS[1:]))
    assert CABLE_LOADS[0] == 2.5 and CABLE_LOADS[-1] == 235


def test_the_27_5_lb_dumbbell_does_not_exist():
    (problem,) = load_problems([_ex("HC", 27.5)], BY_ID)
    assert "5 to 40 lb" in problem
    assert load_problems([_ex("HC", 25.0)], BY_ID) == []
    assert load_problems([_ex("HC", 45.0)], BY_ID)  # heavier than the rack


def test_kettlebell_barbell_and_cable_loads_checked():
    assert load_problems([_ex("KB", 40.0)], BY_ID)
    assert load_problems([_ex("KB", 45.0)], BY_ID) == []
    assert load_problems([_ex("DL", 197.5)], BY_ID)  # needs 1.25s
    assert load_problems([_ex("DL", 285.0)], BY_ID)  # more plates than he owns
    assert load_problems([_ex("DL", 195.0), _ex("ROW", 187.5)], BY_ID) == []
    assert load_problems([_ex("ROW", 240.0)], BY_ID)


def test_superset_cannot_use_more_plates_than_exist():
    (problem,) = load_problems([_ex("DL", 195.0, 1), _ex("ROW", 180.0, 1)], BY_ID)
    assert "330 lb of plates" in problem
    assert load_problems([_ex("DL", 195.0, 1), _ex("HC", 30.0, 1)], BY_ID) == []


def test_snap_moves_free_weights_to_the_nearest_owned_one():
    plan = [_ex("HC", 27.5), _ex("KB", 50.0), _ex("DL", 197.5)]
    changed = snap_free_weights(plan, BY_ID)
    assert [e.weight_lb for e in plan] == [25.0, 45.0, 197.5]  # barbell is left for the coach
    assert len(changed) == 2
