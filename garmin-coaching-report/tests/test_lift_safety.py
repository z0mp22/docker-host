"""Unit tests for the code-level shoulder-safety guard (lift_safety.py).

This is the single most safety-critical piece of the lift-session feature
(see lift_safety.py's module docstring). These tests exist so a future
change to the denylist can't silently reintroduce a banned movement -- or
silently ban floor press, which must always stay allowed -- without a test
failing.
"""

from dataclasses import dataclass

import pytest

from coaching_report import lift_safety
from coaching_report.errors import UnknownExerciseError, UnsafeExerciseError
from coaching_report.lift_safety import (
    _name_is_banned,
    assert_session_plan_safe,
    resolve_banned_exercise_ids,
)


@dataclass
class _FakeExercise:
    exercise_id: str
    exercise_name: str


# Real Hevy exercise-template names (ids are stand-ins except where a test
# pins a hand-curated override id).
CATALOG = [
    {"id": "1", "name": "Overhead Press (Barbell)"},
    {"id": "2", "name": "Chest Dip (Weighted)"},
    {"id": "3", "name": "Bench Press (Barbell)"},
    {"id": "4", "name": "Incline Bench Press (Dumbbell)"},
    {"id": "5", "name": "Floor Press (Barbell)"},
    {"id": "6", "name": "Bent Over Row (Barbell)"},
    {"id": "7", "name": "Single Arm Landmine Press (Barbell)"},
    {"id": "8", "name": "Handstand Push Up"},
    {"id": "9", "name": "Push Up"},
    {"id": "10", "name": "Power Snatch"},
    {"id": "11", "name": "Split Jerk"},
    {"id": "12", "name": "Thruster (Kettlebell)"},
    {"id": "13", "name": "Leg Press (Machine)"},
    {"id": "0EFE8162", "name": "Pike Pushup"},
    {"id": "D3095577", "name": "Clean and Press"},
    {"id": "2CFED196", "name": "Overhead Squat"},
]
CATALOG_BY_ID = {ex["id"]: ex for ex in CATALOG}


def test_floor_press_never_banned():
    """The one exception that matters: floor press is explicitly allowed."""
    banned = resolve_banned_exercise_ids(CATALOG)
    assert "5" not in banned


@pytest.mark.parametrize("exercise_id", ["1", "2", "3", "4", "10", "11", "12"])
def test_each_hard_excluded_movement_is_banned(exercise_id):
    banned = resolve_banned_exercise_ids(CATALOG)
    assert exercise_id in banned


def test_safe_exercises_not_banned():
    banned = resolve_banned_exercise_ids(CATALOG)
    assert "6" not in banned  # Bent Over Row
    assert "7" not in banned  # Landmine Press
    assert "13" not in banned  # Leg Press


def test_assert_session_plan_safe_passes_for_clean_plan():
    banned = resolve_banned_exercise_ids(CATALOG)
    plan = [
        _FakeExercise(exercise_id="6", exercise_name="Bent Over Row (Barbell)"),
        _FakeExercise(exercise_id="5", exercise_name="Floor Press (Barbell)"),
    ]
    assert_session_plan_safe(plan, CATALOG_BY_ID, banned)  # must not raise


def test_assert_session_plan_safe_raises_for_banned_exercise():
    banned = resolve_banned_exercise_ids(CATALOG)
    plan = [_FakeExercise(exercise_id="1", exercise_name="Overhead Press (Barbell)")]
    with pytest.raises(UnsafeExerciseError):
        assert_session_plan_safe(plan, CATALOG_BY_ID, banned)


def test_assert_session_plan_safe_raises_for_unknown_exercise_id():
    banned = resolve_banned_exercise_ids(CATALOG)
    plan = [_FakeExercise(exercise_id="NOPE", exercise_name="Made Up Exercise")]
    with pytest.raises(UnknownExerciseError):
        assert_session_plan_safe(plan, CATALOG_BY_ID, banned)


def test_extra_allowed_override_forces_an_exercise_through():
    lift_safety.EXTRA_ALLOWED_EXERCISE_IDS.add("1")
    try:
        banned = resolve_banned_exercise_ids(CATALOG)
        assert "1" not in banned
    finally:
        lift_safety.EXTRA_ALLOWED_EXERCISE_IDS.discard("1")


def test_extra_banned_override_forces_an_exercise_out():
    lift_safety.EXTRA_BANNED_EXERCISE_IDS.add("6")
    try:
        banned = resolve_banned_exercise_ids(CATALOG)
        assert "6" in banned
    finally:
        lift_safety.EXTRA_BANNED_EXERCISE_IDS.discard("6")


def test_floor_press_name_never_matches_the_word_rule():
    """Mirrors lift_safety.py's own import-time assertions so this invariant
    also shows up in normal test output, not only as a hidden import guard."""
    assert not _name_is_banned("Floor Press")


def test_press_with_intervening_equipment_word_still_matches():
    """The specific bug this test suite caught: a naive substring check for
    "incline press" misses "Incline Dumbbell Press" -- word-based matching
    must not have the same gap."""
    assert _name_is_banned("Incline Dumbbell Press")
    assert _name_is_banned("Standing Overhead Dumbbell Press")


def test_unrelated_press_exercises_not_swept_in():
    assert not _name_is_banned("Leg Press")
    assert not _name_is_banned("Landmine Press")
    assert not _name_is_banned("Cable Chest Press")


def test_handstand_pushup_banned_but_regular_pushup_is_not():
    """Found during the live-catalog review (Stage 2): "push-up" tokenizes to
    {"push", "up"}, never "press", so the qualifier rule alone can't catch
    "Handstand Pushup" -- a compressive, fully-overhead bodyweight press.
    Regular push-ups (horizontal, self-limited) must stay unbanned."""
    banned = resolve_banned_exercise_ids(CATALOG)
    assert "8" in banned  # Handstand Push Up
    assert "9" not in banned  # Push Up


def test_hand_curated_hevy_overrides_banned():
    """Names the word rule can't catch, pinned by Hevy template id after the
    live-catalog review (2026-09-24): Pike Pushup is close enough to an
    overhead press ("pike" isn't a generic word -- it would over-catch ab
    work), and Clean and Press / Overhead Squat hold load at end-range
    overhead without a banned word in the name."""
    banned = resolve_banned_exercise_ids(CATALOG)
    for hevy_id in ("0EFE8162", "D3095577", "2CFED196"):
        assert hevy_id in banned
    assert {"0EFE8162", "D3095577", "2CFED196", "54E60954", "84A77566"} <= lift_safety.EXTRA_BANNED_EXERCISE_IDS


def test_hevy_equipment_suffix_does_not_break_matching():
    assert not _name_is_banned("Floor Press (Dumbbell)")
    assert _name_is_banned("Overhead Press (Smith Machine)")
    assert _name_is_banned("Bench Press - Close Grip (Barbell)")
