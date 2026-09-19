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
    exercise_id: int
    exercise_name: str


CATALOG = [
    {"id": 1, "name": "Standing Barbell Overhead Press", "category": "Shoulders"},
    {"id": 2, "name": "Weighted Dip", "category": "Chest"},
    {"id": 3, "name": "Flat Bench Press", "category": "Chest"},
    {"id": 4, "name": "Incline Dumbbell Press", "category": "Chest"},
    {"id": 5, "name": "Floor Press", "category": "Chest"},
    {"id": 6, "name": "Barbell Row", "category": "Back"},
    {"id": 7, "name": "Landmine Press", "category": "Shoulders"},
    {"id": 8, "name": "Handstand Pushup", "category": "Shoulders"},
    {"id": 9, "name": "Push-Up", "category": "Chest"},
]
CATALOG_BY_ID = {ex["id"]: ex for ex in CATALOG}


def test_floor_press_never_banned():
    """The one exception that matters: floor press is explicitly allowed."""
    banned = resolve_banned_exercise_ids(CATALOG)
    assert 5 not in banned


@pytest.mark.parametrize("exercise_id", [1, 2, 3, 4])
def test_each_hard_excluded_movement_is_banned(exercise_id):
    banned = resolve_banned_exercise_ids(CATALOG)
    assert exercise_id in banned


def test_safe_exercises_not_banned():
    banned = resolve_banned_exercise_ids(CATALOG)
    assert 6 not in banned  # Barbell Row
    assert 7 not in banned  # Landmine Press


def test_assert_session_plan_safe_passes_for_clean_plan():
    banned = resolve_banned_exercise_ids(CATALOG)
    plan = [
        _FakeExercise(exercise_id=6, exercise_name="Barbell Row"),
        _FakeExercise(exercise_id=5, exercise_name="Floor Press"),
    ]
    assert_session_plan_safe(plan, CATALOG_BY_ID, banned)  # must not raise


def test_assert_session_plan_safe_raises_for_banned_exercise():
    banned = resolve_banned_exercise_ids(CATALOG)
    plan = [_FakeExercise(exercise_id=1, exercise_name="Standing Barbell Overhead Press")]
    with pytest.raises(UnsafeExerciseError):
        assert_session_plan_safe(plan, CATALOG_BY_ID, banned)


def test_assert_session_plan_safe_raises_for_unknown_exercise_id():
    banned = resolve_banned_exercise_ids(CATALOG)
    plan = [_FakeExercise(exercise_id=999, exercise_name="Made Up Exercise")]
    with pytest.raises(UnknownExerciseError):
        assert_session_plan_safe(plan, CATALOG_BY_ID, banned)


def test_extra_allowed_override_forces_an_exercise_through():
    lift_safety.EXTRA_ALLOWED_EXERCISE_IDS.add(1)
    try:
        banned = resolve_banned_exercise_ids(CATALOG)
        assert 1 not in banned
    finally:
        lift_safety.EXTRA_ALLOWED_EXERCISE_IDS.discard(1)


def test_extra_banned_override_forces_an_exercise_out():
    lift_safety.EXTRA_BANNED_EXERCISE_IDS.add(6)
    try:
        banned = resolve_banned_exercise_ids(CATALOG)
        assert 6 in banned
    finally:
        lift_safety.EXTRA_BANNED_EXERCISE_IDS.discard(6)


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
    assert 8 in banned  # Handstand Pushup
    assert 9 not in banned  # Push-Up


def test_pike_push_ups_banned_via_hand_curated_override_on_the_real_catalog():
    """Locks in the second live-catalog finding: "Pike Push Ups" (id 454 on
    the actual self-hosted instance, synced 2026-09) is close enough to an
    overhead press to exclude, but "pike" isn't made a generic word rule
    (it would over-catch unrelated ab/core "pike" exercises if the catalog
    gains more of them) -- it's a specific, hand-curated override instead."""
    assert 454 in lift_safety.EXTRA_BANNED_EXERCISE_IDS
