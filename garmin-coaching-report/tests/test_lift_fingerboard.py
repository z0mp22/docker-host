"""Tests for the Beastmaker 1000 fingerboard ramp (lift_fingerboard.py):
phase state, the limits handed to the coach, and the code-level guard that
backs them. The guard is the part that matters -- a coach that drifts past
the current phase must never reach Hevy."""

import json
from dataclasses import dataclass
from datetime import date, datetime
from unittest.mock import MagicMock

import pytest

from coaching_report import lift_fingerboard as fb
from coaching_report.errors import UnsafeExerciseError

MID_HC = "mid-hc"
MID_OH = "mid-oh"
BOT_HC = "bot-hc"
OLD_HANGBOARD = "old-hb"
DEAD_HANG = "B9380898"

CATALOG = [
    {"id": MID_HC, "name": "BM1000 Middle Row Outside - Half Crimp"},
    {"id": MID_OH, "name": "BM1000 Middle Row Outside - Open Hand"},
    {"id": BOT_HC, "name": "BM1000 Bottom Row Outside - Half Crimp"},
    {"id": OLD_HANGBOARD, "name": "Hangboard"},
    {"id": DEAD_HANG, "name": "Dead Hang"},
    {"id": "row", "name": "Seated Cable Row - V Grip (Cable)"},
]
SESSION = date(2026, 10, 12)


@dataclass
class _Ex:
    exercise_id: str
    exercise_name: str = "x"
    sets: int = 3
    reps: int | None = None
    duration_seconds: int | None = 60
    weight_lb: float | None = None
    rir_target: float | None = 4.0


def _context(phase=1, deload=False, finger_flag=False, history=(), board_days=0):
    state = {"phase": phase, "deload_week": deload}
    return {
        **state,
        "limits": fb.limits_for(state, list(history), finger_flag, board_days),
        "history": list(history),
    }


def _write_state(tmp_path, **state):
    (tmp_path / fb.STATE_FILE).write_text(json.dumps(state))


# --- State -------------------------------------------------------------------


def test_missing_state_file_is_phase_1_without_deload(tmp_path):
    state = fb.load_state(tmp_path, SESSION)
    assert state["phase"] == 1
    assert state["ramp_week"] is None
    assert state["deload_week"] is False


def test_every_fourth_ramp_week_is_a_deload(tmp_path):
    _write_state(tmp_path, phase=1, phase_started="2026-10-05", ramp_started="2026-10-05")
    assert fb.load_state(tmp_path, date(2026, 10, 5))["ramp_week"] == 1
    assert fb.load_state(tmp_path, date(2026, 10, 26))["deload_week"] is True  # week 4
    assert fb.load_state(tmp_path, date(2026, 11, 2))["deload_week"] is False  # week 5


def test_bad_phase_value_falls_back_to_phase_1(tmp_path):
    _write_state(tmp_path, phase=7)
    assert fb.load_state(tmp_path, SESSION)["phase"] == 1


# --- Guard -------------------------------------------------------------------


def test_valid_phase_1_block_passes():
    fb.assert_fingerboard_safe([_Ex(MID_HC, sets=2), _Ex(DEAD_HANG, sets=3)], CATALOG, _context())


def test_no_board_work_is_always_fine_even_with_flag():
    fb.assert_fingerboard_safe([_Ex("row", reps=10, duration_seconds=None)], CATALOG, _context(finger_flag=True))


def test_off_plan_hangboard_exercise_is_banned():
    with pytest.raises(UnsafeExerciseError, match="outside the Beastmaker ramp"):
        fb.assert_fingerboard_safe([_Ex(OLD_HANGBOARD)], CATALOG, _context())


def test_finger_flag_blocks_board():
    with pytest.raises(UnsafeExerciseError, match="finger flag"):
        fb.assert_fingerboard_safe([_Ex(MID_HC)], CATALOG, _context(finger_flag=True))


def test_third_board_day_in_a_week_is_blocked():
    with pytest.raises(UnsafeExerciseError, match="board days"):
        fb.assert_fingerboard_safe([_Ex(MID_HC)], CATALOG, _context(board_days=2))


def test_bottom_row_is_not_allowed_in_phase_1():
    with pytest.raises(UnsafeExerciseError, match="bottom_outside"):
        fb.assert_fingerboard_safe([_Ex(BOT_HC)], CATALOG, _context(phase=1))


def test_total_sets_across_grips_are_capped():
    with pytest.raises(UnsafeExerciseError, match="4 sets, limit 3"):
        fb.assert_fingerboard_safe([_Ex(MID_HC, sets=2), _Ex(MID_OH, sets=2)], CATALOG, _context())


def test_deload_week_halves_sets():
    with pytest.raises(UnsafeExerciseError, match="deload"):
        fb.assert_fingerboard_safe([_Ex(MID_HC, sets=3)], CATALOG, _context(deload=True))


def test_phase_1_is_rpe_6_only():
    with pytest.raises(UnsafeExerciseError, match="rir_target 3"):
        fb.assert_fingerboard_safe([_Ex(MID_HC, rir_target=3.0)], CATALOG, _context())


def test_hangs_must_be_timed():
    with pytest.raises(UnsafeExerciseError, match="timed hang"):
        fb.assert_fingerboard_safe([_Ex(MID_HC, reps=6, duration_seconds=None)], CATALOG, _context())


def test_no_added_weight_before_phase_3():
    with pytest.raises(UnsafeExerciseError, match="limit 0"):
        fb.assert_fingerboard_safe(
            [_Ex(MID_HC, duration_seconds=42, rir_target=3.0, weight_lb=5)], CATALOG, _context(phase=2)
        )


def test_phase_3_hangs_are_short():
    with pytest.raises(UnsafeExerciseError, match="1-12s"):
        fb.assert_fingerboard_safe([_Ex(BOT_HC, duration_seconds=42, rir_target=2.0)], CATALOG, _context(phase=3))


def test_phase_3_weight_creeps_up_from_best_logged():
    history = [{"hold": "bottom_outside", "set_type": "normal", "added_weight_lb": 5.0}]
    ctx = _context(phase=3, history=history)
    fb.assert_fingerboard_safe([_Ex(BOT_HC, sets=4, duration_seconds=10, rir_target=2.0, weight_lb=7.5)], CATALOG, ctx)
    with pytest.raises(UnsafeExerciseError, match="limit 7.5"):
        fb.assert_fingerboard_safe([_Ex(BOT_HC, sets=4, duration_seconds=10, rir_target=2.0, weight_lb=10)], CATALOG, ctx)


def test_negative_weight_is_rejected():
    with pytest.raises(UnsafeExerciseError, match="negative"):
        fb.assert_fingerboard_safe([_Ex(MID_HC, weight_lb=-10)], CATALOG, _context())


# --- Context -----------------------------------------------------------------


def test_hours_since_last_climb_uses_climb_end_and_ignores_other_sports():
    activities = [
        {"activityType": {"typeKey": "indoor_climbing"}, "startTimeLocal": "2026-10-11 12:00:00", "duration": 3600},
        {"activityType": {"typeKey": "mountain_biking"}, "startTimeLocal": "2026-10-12 06:00:00", "duration": 3600},
        {"activityType": {"typeKey": "bouldering"}, "startTimeLocal": "2026-10-09 12:00:00", "duration": 3600},
    ]
    assert fb.hours_since_last_climb(activities, datetime(2026, 10, 12, 7, 0)) == 18.0
    assert fb.hours_since_last_climb(activities[1:2], datetime(2026, 10, 12, 7, 0)) is None


def test_build_context_converts_history_and_counts_board_days(tmp_path):
    hevy = MagicMock()
    hevy.get_exercise_history.side_effect = lambda ex_id, since: (
        [
            {"workout_start_time": "2026-10-08T12:00:00Z", "weight_kg": None, "duration_seconds": 60, "rpe": 6, "set_type": "normal"},
            {"workout_start_time": "2026-10-10T12:00:00Z", "weight_kg": 2.26796, "duration_seconds": 60, "rpe": 7, "set_type": "normal"},
            {"workout_start_time": "2026-09-30T12:00:00Z", "weight_kg": None, "duration_seconds": 60, "rpe": None, "set_type": "normal"},
        ]
        if ex_id == MID_HC
        else []
    )
    ctx = fb.build_context(hevy, CATALOG, tmp_path, SESSION, [], finger_flag=False, now=datetime(2026, 10, 12, 7))
    assert ctx["board_days_last_7d"] == 2
    assert ctx["limits"]["board_allowed_today"] is False
    assert {e["id"] for e in ctx["plan_exercises"]} == {MID_HC, MID_OH, BOT_HC}
    logged = [r for r in ctx["history"] if r["date"] == "2026-10-10"][0]
    assert logged["added_weight_lb"] == pytest.approx(5.0, abs=0.01)
    assert logged["rir"] == 3
    assert logged["hold"] == "middle_outside"


def test_board_map_names_every_plan_hold_by_location():
    locations = {row["location"] for row in fb.BOARD_MAP}
    assert "Middle row, outside" in locations
    assert "Bottom row, outside" in locations
    assert not any("mm" in row["hold"] for row in fb.BOARD_MAP)
