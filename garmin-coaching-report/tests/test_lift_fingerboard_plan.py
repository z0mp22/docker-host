"""Tests for the rules-based fingerboard planner (lift_fingerboard_plan.py):
where on the phase ladder a session lands, the today-only cuts, and that
every plan it makes passes the same guard and review a Claude plan had to."""

import json
from datetime import date, datetime

import pytest

from coaching_report import lift_fingerboard as fb
from coaching_report import lift_fingerboard_plan as plan_mod
from coaching_report.lift_review import fingerboard_problems, review_plan

CATALOG = [
    {"id": "mid-hc", "name": "BM1000 Middle Row Outside - Half Crimp"},
    {"id": "mid-oh", "name": "BM1000 Middle Row Outside - Open Hand"},
    {"id": "bot-hc", "name": "BM1000 Bottom Row Outside - Half Crimp"},
    {"id": "bot-oh", "name": "BM1000 Bottom Row Outside - Open Hand"},
    {"id": "warm", "name": "BM1000 Warm-up"},
    {"id": "rwc", "name": "Reverse Wrist Curl (Dumbbell)", "muscle": "forearms", "equipment": "dumbbell"},
]
HOLD_OF = {"mid-hc": "middle_outside", "mid-oh": "middle_outside", "bot-hc": "bottom_outside", "bot-oh": "bottom_outside"}
TODAY = date(2026, 11, 7)  # a Saturday
NOON = datetime(2026, 11, 7, 12, 0)


def _sets(day, n, seconds=10, hold="middle_outside", rpe=None, weight=None):
    return [
        {"date": day, "hold": hold, "set_type": "normal", "duration_seconds": seconds, "rpe": rpe,
         "added_weight_lb": weight, "exercise_name": "x"}
        for _ in range(n)
    ]


def _prescription(day, phase=1, level=0, board_sets=12, seconds=10, reduced=False, feet=None, hold=None, weight=0.0):
    step = plan_mod._step(phase, level, weight)
    return {"date": day, "progression": {
        "phase": phase, "level": level, "weight_lb": weight, "board_sets": board_sets, "seconds": seconds,
        "reduced": reduced, "feet": feet or step.feet, "hold": hold or step.hold, "rounds": step.rounds,
    }}


def _payload(phase=1, history=(), feedback=(), activities=(), deload=False, shoulder=False,
             phase_started="2026-10-05", ramp_week=5, hours_since_climb=None):
    state = {"phase": phase, "deload_week": deload}
    history = list(history)
    return {
        "session_date": TODAY.isoformat(),
        "athlete_context": {"timezone": "America/Denver"},
        "recent_mountain_activity": list(activities),
        "recent_feedback": list(feedback),
        "exercise_catalog": CATALOG,
        "flags": {"shoulder_flag_active": shoulder},
        "fingerboard": {
            "phase": phase, "phase_name": fb.PHASES[phase].name, "phase_started": phase_started,
            "weeks_in_phase": 5, "ramp_week": ramp_week, "deload_week": deload,
            "hours_since_last_climb": hours_since_climb,
            "limits": fb.limits_for(state, history, False, 0),
            "history": history,
        },
    }


def _plan(payload, prescriptions=(), now=NOON):
    return plan_mod.plan_fingerboard_session(payload, list(prescriptions), now)


def _board(plan):
    return [ex for ex in plan.exercises if ex.exercise_id in HOLD_OF]


def _assert_valid(plan, payload):
    """The guard and review that lift_main runs before any Hevy write."""
    fb.assert_fingerboard_safe(plan.exercises, CATALOG, payload["fingerboard"])
    by_id = {ex["id"]: ex for ex in CATALOG}
    assert review_plan(plan.exercises, "fingerboard", by_id) == []
    assert fingerboard_problems(plan.exercises, plan.summary_text, "warm") == []


# --- Starting and stepping ------------------------------------------------------


def test_first_session_starts_at_feet_heavy_two_rounds_split_across_grips():
    payload = _payload()
    plan, prog = _plan(payload)
    _assert_valid(plan, payload)
    names = [ex.exercise_name for ex in plan.exercises]
    assert names == [
        "BM1000 Warm-up", "BM1000 Middle Row Outside - Half Crimp", "BM1000 Middle Row Outside - Open Hand",
        "Reverse Wrist Curl (Dumbbell)",
    ]
    hc, oh = _board(plan)
    assert (hc.sets, hc.duration_seconds, hc.rest_seconds, hc.rir_target) == (6, 10, 20, 4.0)
    assert "feet: heavy" in hc.notes and "active shoulders" in hc.notes
    assert "2 min rest after every 6th set" in hc.notes  # the open-hand round follows
    assert plan.exercises[0].goal == "warmup" and plan.exercises[0].rir_target is None
    assert prog == {**prog, "phase": 1, "level": 0, "feet": "heavy", "board_sets": 12, "reduced": False}
    assert plan.summary_text.startswith("**Phase 1 · week 5 · Middle Row Outside (#3), feet heavy**")


def test_unlogged_session_is_repeated():
    plan, prog = _plan(_payload(), [_prescription("2026-11-04", level=1)])
    assert prog["level"] == 1
    assert "isn't logged" in plan.rationale


def test_one_easy_session_holds_two_in_a_row_step_up():
    one = _sets("2026-11-04", 12)
    plan, prog = _plan(_payload(history=one), [_prescription("2026-11-01"), _prescription("2026-11-04")])
    # Nov 1 was prescribed but not logged, so only one easy session at level 0.
    assert prog["level"] == 0 and "one more easy session" in plan.rationale

    two = _sets("2026-11-01", 12) + _sets("2026-11-04", 12)
    payload = _payload(history=two)
    plan, prog = _plan(payload, [_prescription("2026-11-01"), _prescription("2026-11-04")])
    _assert_valid(plan, payload)
    assert prog["level"] == 1 and prog["feet"] == "light"
    assert "feet heavy → light" in _board(plan)[0].why


def test_third_round_goes_to_half_crimp():
    history = _sets("2026-11-01", 12) + _sets("2026-11-04", 12)
    payload = _payload(history=history)
    plan, prog = _plan(payload, [_prescription("2026-11-01", level=1), _prescription("2026-11-04", level=1)])
    _assert_valid(plan, payload)
    hc, oh = _board(plan)
    assert (hc.sets, oh.sets, prog["board_sets"]) == (12, 6, 18)
    assert "12 × 10s (2 rounds of 6)" in plan.summary_text


def test_unfinished_session_steps_back():
    history = _sets("2026-11-04", 8)
    _, prog = _plan(_payload(history=history), [_prescription("2026-11-04", level=2, board_sets=18)])
    assert prog["level"] == 1


def test_high_logged_rpe_steps_back_and_moderate_rpe_holds():
    pres = [_prescription("2026-11-04", level=2, board_sets=12)]
    _, prog = _plan(_payload(history=_sets("2026-11-04", 12, rpe=9)), pres)
    assert prog["level"] == 1
    _, prog = _plan(_payload(history=_sets("2026-11-04", 12, rpe=8)), pres)
    assert prog["level"] == 2


def test_hard_in_that_days_feedback_steps_back():
    feedback = [{"date": "2026-11-04T19:00:00-07:00", "note": "Board felt hard today"}]
    _, prog = _plan(_payload(history=_sets("2026-11-04", 12), feedback=feedback), [_prescription("2026-11-04", level=2)])
    assert prog["level"] == 1


def test_finger_pain_steps_back_and_drops_the_wrist_block():
    feedback = [{"date": "2026-11-05T14:00:00+00:00", "note": "Left middle finger a bit sore this morning"}]
    plan, prog = _plan(_payload(history=_sets("2026-11-04", 12), feedback=feedback), [_prescription("2026-11-04", level=2)])
    assert prog["level"] == 1
    assert "pain" in plan.rationale
    assert all("Wrist Curl" not in ex.exercise_name for ex in plan.exercises)


def test_long_break_steps_back():
    plan, prog = _plan(_payload(history=_sets("2026-10-11", 3, seconds=24)), [_prescription("2026-10-11", level=2)])
    assert prog["level"] == 1 and "27 days" in plan.rationale


def test_sessions_before_the_rules_dont_count():
    """The Oct 11 hangs were planned by Claude; the ladder starts at the bottom."""
    _, prog = _plan(_payload(history=_sets("2026-10-11", 3, seconds=24)))
    assert prog["level"] == 0


# --- Today-only cuts --------------------------------------------------------------


def test_deload_halves_rounds_and_never_steps_up():
    history = _sets("2026-11-01", 12) + _sets("2026-11-04", 12)
    payload = _payload(history=history, deload=True)
    plan, prog = _plan(payload, [_prescription("2026-11-01"), _prescription("2026-11-04")])
    _assert_valid(plan, payload)
    assert prog["level"] == 0 and prog["reduced"] is True
    assert sum(ex.sets for ex in _board(plan)) == 6
    assert "deload" in plan.rationale


def test_hard_climb_yesterday_means_short_session_heavier_feet():
    climb = {"activityType": {"typeKey": "indoor_climbing"}, "startTimeLocal": "2026-11-06T17:00:00", "duration": 6000}
    payload = _payload(activities=[climb], hours_since_climb=17.3)
    plan, prog = _plan(payload, [_prescription("2026-11-04", level=3, board_sets=12)])
    _assert_valid(plan, payload)
    # level 3 is feet off, 2 rounds -> feet light today, still 2 rounds (the phase's lowest)
    assert (prog["level"], prog["feet"], prog["rounds"], prog["reduced"]) == (3, "light", 2, True)
    assert "hard climb" in plan.rationale


def test_short_easy_climb_changes_nothing():
    climb = {"activityType": {"typeKey": "indoor_climbing"}, "startTimeLocal": "2026-11-06T17:00:00",
             "duration": 2400, "aerobicTrainingEffect": 1.8}
    _, prog = _plan(_payload(activities=[climb], hours_since_climb=17.3))
    assert prog["reduced"] is False


def test_tuesday_morning_is_short_for_the_lunch_climb():
    payload = _payload()
    payload["session_date"] = "2026-11-10"
    plan, prog = _plan(payload, [_prescription("2026-11-07", level=2, board_sets=18)], now=datetime(2026, 11, 10, 6, 30))
    assert prog["rounds"] == 2 and prog["reduced"] is True
    assert "lunch" in plan.rationale


def test_reduced_day_doesnt_count_toward_stepping_up():
    history = _sets("2026-11-01", 12) + _sets("2026-11-04", 6)
    pres = [_prescription("2026-11-01"), _prescription("2026-11-04", board_sets=6, reduced=True)]
    _, prog = _plan(_payload(history=history), pres)
    assert prog["level"] == 0


def test_shoulder_flag_keeps_more_weight_on_the_feet():
    _, prog = _plan(_payload(shoulder=True), [_prescription("2026-11-04", level=3, board_sets=12)])
    assert prog["feet"] == "light"


# --- Gates and later phases --------------------------------------------------------


def test_phase_1_gate_needs_six_weeks_and_an_easy_bodyweight_session():
    history = _sets("2026-11-04", 12)
    pres = [_prescription("2026-11-04", level=3, board_sets=12, feet="off")]
    plan, _ = _plan(_payload(history=history, phase_started="2026-09-20"), pres)
    assert "Fingerboard: phase 1 gate looks met, confirm to advance" in plan.flags_considered
    plan, _ = _plan(_payload(history=history, phase_started="2026-10-05"), pres)
    assert not any("gate" in f for f in plan.flags_considered)


def test_phase_2_repeaters():
    payload = _payload(phase=2)
    plan, prog = _plan(payload)
    _assert_valid(plan, payload)
    hc, oh = _board(plan)
    assert (hc.sets, oh.sets, hc.duration_seconds, hc.rest_seconds, hc.rir_target) == (2, 1, 42, 180, 3.0)
    assert "Repeater" in hc.notes and "6th set" not in hc.notes


def test_phase_2_gate_after_two_easy_bodyweight_sessions_on_bottom_row():
    history = _sets("2026-11-01", 4, seconds=42, hold="bottom_outside") + _sets("2026-11-04", 4, seconds=42, hold="bottom_outside")
    pres = [_prescription(d, phase=2, level=6, board_sets=4, seconds=42) for d in ("2026-11-01", "2026-11-04")]
    plan, _ = _plan(_payload(phase=2, history=history), pres)
    assert "Fingerboard: phase 2 gate looks met, confirm to advance" in plan.flags_considered


def test_phase_3_adds_weight_at_the_top_within_the_limit():
    history = (_sets("2026-11-01", 5, hold="bottom_outside", weight=5.0)
               + _sets("2026-11-04", 5, hold="bottom_outside", weight=5.0))
    pres = [_prescription(d, phase=3, level=1, board_sets=5, weight=5.0) for d in ("2026-11-01", "2026-11-04")]
    payload = _payload(phase=3, history=history)
    plan, prog = _plan(payload, pres)
    _assert_valid(plan, payload)
    assert prog["weight_lb"] == 7.5
    assert all(ex.weight_lb == 7.5 for ex in _board(plan))


# --- Saved prescriptions -------------------------------------------------------------


def test_load_board_prescriptions_skips_claude_era_files(tmp_path):
    (tmp_path / "fingerboard-session-2026-10-07.meta.json").write_text(json.dumps({"session_date": "2026-10-07", "model": "claude"}))
    (tmp_path / "fingerboard-session-2026-11-04.meta.json").write_text(
        json.dumps({"session_date": "2026-11-04", "progression": {"phase": 1, "level": 2}})
    )
    (tmp_path / "fingerboard-session-bad.meta.json").write_text("{")
    assert plan_mod.load_board_prescriptions(tmp_path) == [
        {"date": "2026-11-04", "progression": {"phase": 1, "level": 2}}
    ]


@pytest.mark.parametrize("phase", [1, 2, 3])
@pytest.mark.parametrize("level", range(7))
def test_every_ladder_step_passes_the_guard(phase, level):
    level = min(level, len(plan_mod.LADDERS[phase]) - 1)
    step = plan_mod.LADDERS[phase][level]
    hold_ex = "mid-hc" if step.hold == "middle_outside" else "bot-hc"
    dose = plan_mod.DOSE[phase]
    history = _sets("2026-11-04", step.rounds * fb.PHASES[phase].sets_per_round, seconds=dose.seconds, hold=step.hold, rpe=8)
    pres = [_prescription("2026-11-04", phase=phase, level=level,
                          board_sets=step.rounds * fb.PHASES[phase].sets_per_round, seconds=dose.seconds)]
    payload = _payload(phase=phase, history=history)
    plan, prog = _plan(payload, pres)
    assert prog["level"] == level, hold_ex
    _assert_valid(plan, payload)
