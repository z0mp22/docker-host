"""Non-safety session checks (lift_review.py)."""

from coaching_report.lift_coach import ExercisePrescription
from coaching_report.lift_fingerboard import board_blocks
from coaching_report.lift_review import (
    enforce_hinge_limits,
    fingerboard_problems,
    hinge_kind,
    hinge_limits,
    name_problems,
    review_plan,
    warmup_problems,
)

CATALOG = {
    "DL": {"name": "Deadlift (Barbell)", "muscle": "glutes", "type": "weight_reps", "equipment": "barbell"},
    "RDL": {"name": "Romanian Deadlift (Barbell)", "muscle": "hamstrings", "type": "weight_reps", "equipment": "barbell"},
    "RP": {"name": "Rack Pull", "muscle": "upper_back", "type": "weight_reps", "equipment": "barbell"},
    "DHP": {"name": "Deadlift High Pull", "muscle": "traps", "type": "weight_reps", "equipment": "barbell"},
    "DBDL": {"name": "Deadlift (Dumbbell)", "muscle": "glutes", "type": "weight_reps", "equipment": "dumbbell"},
    "ROW": {"name": "Seated Cable Row - V Grip (Cable)", "muscle": "upper_back", "type": "weight_reps", "equipment": "machine"},
    "FP": {"name": "Floor Press (Dumbbell)", "muscle": "chest", "type": "weight_reps", "equipment": "dumbbell"},
    "LPD": {"name": "Lat Pulldown (Cable)", "muscle": "lats", "type": "weight_reps", "equipment": "machine"},
    "HC": {"name": "Hammer Curl (Dumbbell)", "muscle": "biceps", "type": "weight_reps", "equipment": "dumbbell"},
    "TP": {"name": "Triceps Rope Pushdown", "muscle": "triceps", "type": "weight_reps", "equipment": "machine"},
    "HANG": {"name": "Dead Hang", "muscle": "upper_back", "type": "duration", "equipment": "none"},
    "PU": {"name": "Pull Up (Band)", "muscle": "lats", "type": "reps_only", "equipment": "resistance_band"},
    "RWC": {"name": "Reverse Wrist Curl (Dumbbell)", "muscle": "forearms", "type": "weight_reps", "equipment": "dumbbell"},
    "PUWC": {"name": "Seated Palms Up Wrist Curl", "muscle": "forearms", "type": "weight_reps", "equipment": "dumbbell"},
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
    dl = _ex("DL", 4, 195.0, "mtb", "Still progressing: 185 -> 195 with RPE 7, so hold and add a set.")
    dl.reps = 5
    dl.warmup_sets = [{"reps": 8, "weight_lb": 45.0}, {"reps": 5, "weight_lb": 95.0}, {"reps": 3, "weight_lb": 145.0}]
    plan = [dl,
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


def test_a_name_that_does_not_match_its_hevy_id_is_a_problem():
    # Hevy shows the template behind the id: "reverse" in the plan, palms-up in Hevy.
    wrong = ExercisePrescription("PUWC", "Reverse Wrist Curl (Dumbbell)", 1, None, 2, 15, None, 5.0, 4.0, 60,
                                 None, "climbing", "wrist extensors")
    (problem,) = name_problems([wrong, _ex("RWC", 2, 5.0)], CATALOG)
    assert "'Seated Palms Up Wrist Curl'" in problem
    assert any("Hevy shows" in p for p in review_plan([wrong], "fingerboard", CATALOG))


def _board(name, sets, seconds, notes="Feet heavy. Active shoulders.", goal="climbing", slot=1):
    return ExercisePrescription(name, name, slot, None, sets, None, seconds, None, 4.0, 20, notes, goal, "why")


def test_fingerboard_wants_its_own_warmup_and_short_text():
    plan = [_board("BM1000 Middle Row Outside - Half Crimp", 12, 10, notes="x" * 141)]
    problems = fingerboard_problems(plan, "y" * 501, warmup_id="BM1000 Warm-up")
    assert len(problems) == 3
    assert "no BM1000 Warm-up entry" in problems[0]
    assert "141 characters" in problems[1]
    assert "summary_text is 501" in problems[2]
    plan = [_board("BM1000 Warm-up", 6, 10, goal="warmup"), _board("BM1000 Middle Row Outside - Half Crimp", 12, 10)]
    assert fingerboard_problems(plan, "short", warmup_id="BM1000 Warm-up") == []


def test_board_blocks_lay_the_session_out_set_by_set():
    plan = [_board("BM1000 Middle Row Outside - Half Crimp", 12, 10, slot=2),
            _board("BM1000 Warm-up", 6, 10, goal="warmup", slot=1),
            _ex("RWC", 2, 5.0)]
    plan[2].slot_order = 3
    warm, board, acc = board_blocks(plan, sets_per_round=6)
    assert (warm["kind"], warm["sets"], warm["seconds"], warm["round"]) == ("warmup", 6, 10, None)
    assert (board["kind"], board["sets"], board["round"], board["rest_seconds"]) == ("board", 12, 6, 20)
    assert (acc["kind"], acc["reps"], acc["weight_lb"]) == ("accessory", 10, 5.0)


def test_heavy_barbell_lift_needs_makeable_lighter_warmups():
    dl = _ex("DL", 4, 185.0)
    (problem,) = warmup_problems([dl], CATALOG)
    assert "no warmup_sets" in problem
    dl.warmup_sets = [{"reps": 8, "weight_lb": 45.0}, {"reps": 5, "weight_lb": 97.5}, {"reps": 3, "weight_lb": 185.0}]
    problems = warmup_problems([dl], CATALOG)
    assert any("185 lb isn't lighter" in p for p in problems)
    assert any("Deadlift (Barbell) warm-up at 97.5 lb" in p for p in problems)
    hang = _ex("HANG")
    hang.warmup_sets = [{"reps": 5, "weight_lb": None}]
    assert "timed" in warmup_problems([hang], CATALOG)[0]
    assert warmup_problems([_ex("HC", 3, 30.0), _ex("DL", 3, 65.0)], CATALOG) == []


def _hinge(ex_id, weight, reps=5, rir=2.0):
    ex = _ex(ex_id, 3, weight, "mtb")
    ex.reps, ex.rir_target = reps, rir
    ex.warmup_sets = [{"reps": 8, "weight_lb": 45.0}, {"reps": 3, "weight_lb": 135.0}]
    return ex


def _dl_history(weight, rpe):
    return [{"exercises": [{"exercise_id": "DL", "sets": [
        {"set_type": "warmup", "weight_lb": 135.0, "reps": 5, "rpe": None},
        {"set_type": "normal", "weight_lb": weight, "reps": 5, "rpe": rpe},
    ]}]}]


def test_which_lifts_are_barbell_hinges():
    assert [hinge_kind(CATALOG[k]) for k in ("DL", "RP", "RDL", "DHP", "DBDL", "ROW")] == [
        "pull", "pull", "hinge", None, None, None,
    ]


def test_ceiling_is_one_and_a_half_bodyweight_from_hevy_or_the_profile():
    assert hinge_limits([])["ceiling_lb"] == 270
    assert hinge_limits([])["bodyweight_source"] == "profile"
    limits = hinge_limits([{"date": "2026-10-01", "weight_lb": 190.0}, {"date": "2026-10-20", "weight_lb": 176.4}])
    assert (limits["ceiling_lb"], limits["bodyweight_source"]) == (260, "hevy")


def test_deadlift_over_the_ceiling_singles_and_low_rir_are_problems():
    problems = review_plan([_hinge("DL", 275.0, reps=1, rir=0.5)], "shoulder_pt", CATALOG)
    assert any("275 lb is too heavy" in p and "270 lb" in p for p in problems)
    assert any("rir_target 0.5" in p for p in problems)
    assert any("1 reps" in p and "3-6" in p for p in problems)
    assert review_plan([_hinge("DL", 270.0)], "shoulder_pt", CATALOG) == []
    assert review_plan([_hinge("RDL", 155.0, reps=10)], "shoulder_pt", CATALOG) == []


def test_no_added_deadlift_load_after_a_top_set_harder_than_rpe_8():
    history = _dl_history(225.0, 8.5)
    (problem,) = review_plan([_hinge("DL", 235.0)], "shoulder_pt", CATALOG, history=history)
    assert "RPE 8.5" in problem
    assert review_plan([_hinge("DL", 225.0)], "shoulder_pt", CATALOG, history=history) == []
    assert review_plan([_hinge("DL", 235.0)], "shoulder_pt", CATALOG, history=_dl_history(225.0, 8)) == []


def test_enforce_clamps_what_the_revision_left_and_drops_heavy_warmups():
    dl, rdl, other = _hinge("DL", 285.0, reps=8, rir=1.0), _hinge("RDL", 155.0, reps=12), _ex("HC", 3, 30.0)
    dl.warmup_sets.append({"reps": 2, "weight_lb": 275.0})
    other.rir_target = 0.0
    changes = enforce_hinge_limits([dl, rdl, other], CATALOG, hinge_limits([]))
    assert (dl.weight_lb, dl.reps, dl.rir_target) == (270.0, 6, 2.0)
    assert [w["weight_lb"] for w in dl.warmup_sets] == [45.0, 135.0]
    assert rdl.reps == 10 and other.rir_target == 0.0
    assert len(changes) == 4

    dl = _hinge("DL", 245.0)
    dl.warmup_sets.append({"reps": 2, "weight_lb": 225.0})
    enforce_hinge_limits([dl], CATALOG, hinge_limits([]), _dl_history(225.0, 9))
    assert dl.weight_lb == 225.0
    assert [w["weight_lb"] for w in dl.warmup_sets] == [45.0, 135.0]
