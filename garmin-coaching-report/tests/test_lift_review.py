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
    "HANG": {"name": "Dead Hang", "muscle": "upper_back", "type": "duration", "equipment": "none"},
    "PU": {"name": "Pull Up (Band)", "muscle": "lats", "type": "reps_only", "equipment": "resistance_band"},
}


def _ex(ex_id, sets=3, weight=None, goal="physique", why="best option for this goal today"):
    duration = 30 if CATALOG[ex_id]["type"] == "duration" else None
    return ExercisePrescription(ex_id, CATALOG[ex_id]["name"], 1, None, sets, None if duration else 10,
                                duration, weight, 2.0, 90, None, goal, why)


def test_this_mornings_session_is_flagged_for_load_and_missing_triceps():
    plan = [_ex("DL", 4, 195.0), _ex("ROW", 4, 180.0), _ex("FP", 4, 40.0), _ex("LPD", 3, 185.0),
            _ex("HC", 3, 27.5), _ex("HANG")]
    problems = review_plan(plan, "heavy_1h", CATALOG)
    assert any("27.5 lb" in p for p in problems)
    assert any("no triceps" in p for p in problems)


def test_repeating_justified_lifts_is_fine():
    plan = [_ex("DL", 4, 195.0, "mtb", "Still progressing: 185 -> 195 with RPE 7, so hold and add a set."),
            _ex("PU", 4, None, "climbing"), _ex("HC", 3, 30.0), _ex("TP", 3, 50.0), _ex("HANG", goal="climbing")]
    assert review_plan(plan, "heavy_1h", CATALOG) == []


def test_every_exercise_needs_a_goal_and_a_why():
    (problem,) = review_plan([_ex("HC", 3, 30.0), _ex("TP", 3, 50.0, why="  ")], "light_30m", CATALOG)
    assert "Triceps Rope Pushdown" in problem


def test_light_session_needs_one_arm_movement_and_pt_is_exempt():
    plan = [_ex("PU", 3), _ex("FP", 3, 35.0)]
    (problem,) = review_plan(plan, "light_30m", CATALOG)
    assert "no arm exercise" in problem
    assert review_plan(plan, "shoulder_pt", CATALOG) == []


def test_every_priority_must_be_trained_and_climbing_means_pulling_bodyweight():
    plan = [_ex("LPD", 4, 185.0, "climbing"), _ex("HC", 3, 30.0), _ex("TP", 3, 50.0)]
    problems = review_plan(plan, "heavy_1h", CATALOG, ["climbing: lats undertrained", "core: none in 2 weeks"])
    assert any("pull-up or chin-up" in p for p in problems)
    assert any("'core' has no exercise" in p for p in problems)
    plan[0] = _ex("PU", 4, None, "climbing")
    assert review_plan(plan, "heavy_1h", CATALOG, ["climbing: lats undertrained", "physique: arms"]) == []


def test_no_added_load_after_an_rpe_10_set():
    history = [{"exercises": [{"exercise_id": "HC", "sets": [
        {"set_type": "normal", "weight_lb": 30.0, "reps": 12, "rpe": None},
        {"set_type": "normal", "weight_lb": 30.0, "reps": 12, "rpe": 10},
    ]}]}]
    plan = [_ex("HC", 3, 35.0), _ex("TP", 3, 50.0)]
    (problem,) = review_plan(plan, "light_30m", CATALOG, history=history)
    assert "RPE 10" in problem
    plan[0] = _ex("HC", 3, 30.0)
    assert review_plan(plan, "light_30m", CATALOG, history=history) == []
