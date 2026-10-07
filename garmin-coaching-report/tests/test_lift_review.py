"""Non-safety session checks (lift_review.py)."""

from coaching_report.lift_coach import ExercisePrescription
from coaching_report.lift_review import review_plan

CATALOG = {
    "DL": {"name": "Deadlift (Barbell)", "muscle": "glutes", "type": "weight_reps", "equipment": "barbell"},
    "ROW": {"name": "Seated Cable Row - V Grip (Cable)", "muscle": "upper_back", "type": "weight_reps", "equipment": "machine"},
    "FP": {"name": "Floor Press (Dumbbell)", "muscle": "chest", "type": "weight_reps", "equipment": "dumbbell"},
    "LPD": {"name": "Lat Pulldown (Cable)", "muscle": "lats", "type": "weight_reps", "equipment": "machine"},
    "HC": {"name": "Hammer Curl (Dumbbell)", "muscle": "biceps", "type": "weight_reps", "equipment": "dumbbell"},
    "TP": {"name": "Triceps Rope Pushdown", "muscle": "triceps", "type": "weight_reps", "equipment": "machine"},
    "GS": {"name": "Goblet Squat", "muscle": "quadriceps", "type": "weight_reps", "equipment": "dumbbell"},
    "HANG": {"name": "Dead Hang", "muscle": "upper_back", "type": "duration", "equipment": "none"},
    "PU": {"name": "Pull Up", "muscle": "lats", "type": "reps_only", "equipment": "machine"},
}


def _ex(ex_id, sets=3, weight=None):
    duration = 30 if CATALOG[ex_id]["type"] == "duration" else None
    return ExercisePrescription(ex_id, CATALOG[ex_id]["name"], 1, None, sets, None if duration else 10,
                                duration, weight, 2.0, 90, None)


MONDAY = ["DL", "ROW", "FP", "HC", "LPD", "HANG"]


def test_mondays_session_again_is_flagged():
    plan = [_ex("DL", 4, 195.0), _ex("ROW", 4, 180.0), _ex("FP", 4, 40.0), _ex("LPD", 3, 185.0),
            _ex("HC", 3, 27.5), _ex("HANG")]
    problems = review_plan(plan, "heavy_1h", CATALOG, MONDAY)
    assert any("repeat the last lift session" in p for p in problems)
    assert any("27.5 lb" in p for p in problems)
    assert any("no triceps" in p for p in problems)


def test_two_repeats_plus_dead_hang_is_fine():
    plan = [_ex("DL", 4, 195.0), _ex("HC", 3, 30.0), _ex("PU", 4), _ex("TP", 3, 50.0), _ex("HANG")]
    assert review_plan(plan, "heavy_1h", CATALOG, MONDAY) == []


def test_leg_heavy_session_is_flagged():
    plan = [_ex("DL", 5, 195.0), _ex("GS", 5, 40.0), _ex("HC", 3, 30.0), _ex("TP", 3, 50.0)]
    (problem,) = review_plan(plan, "heavy_1h", CATALOG, [])
    assert "10 of 16 working sets" in problem


def test_light_session_needs_one_arm_movement_and_pt_is_exempt():
    plan = [_ex("PU", 3), _ex("FP", 3, 35.0)]
    (problem,) = review_plan(plan, "light_30m", CATALOG, [])
    assert "no arm exercise" in problem
    assert review_plan(plan, "shoulder_pt", CATALOG, ["PU", "FP"]) == []
