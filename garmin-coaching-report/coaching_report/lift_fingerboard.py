"""Fingerboard ramp for the lift coach: the Beastmaker 1000 board map, the
athlete's current phase, recent hang history, and the code-level guard.

The athlete trains on a Beastmaker 1000 and wants every hold named by where
it sits on the board, never by an edge depth. The map below follows the
numbered Beastmaker 1000 chart the athlete uses (holds #1-#9; jugs and
slopers are unnumbered), checked against Beastmaker's own hold list and
product photo (beastmaker.co.uk, 2026-10-05). "chart" is that number. Hevy has no "hold" field, so each hold+grip
the plan uses is its own custom Hevy exercise (created via
POST /v1/exercise_templates on 2026-10-05, type weight_duration so added
weight can be logged later). Exercises are resolved from the live catalog
by exact title, never by hardcoded id.

Phase is deliberately NOT decided by the coach. It lives in
REPORT_OUTPUT_DIR/fingerboard_state.json and only moves when the athlete
confirms a gate. The coach can only say a gate looks met.

Same posture as lift_safety.py: the prompt explains the rules,
assert_fingerboard_safe() enforces the hard ones before any Hevy write.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any

from .errors import UnsafeExerciseError

if TYPE_CHECKING:
    from .hevy_client import HevyClient
    from .lift_coach import ExercisePrescription

STATE_FILE = "fingerboard_state.json"

# Every hold on the board, by location. Rows run top to bottom; "outside"
# is the hold nearest each end of the board. The board is mirrored, so each
# entry (except the center pockets) is a left/right pair.
BOARD_MAP = [
    {"chart": None, "location": "Top corners (the raised horns)", "hold": "Jugs", "in_plan": "warm-up only"},
    {"chart": None, "location": "Top edge of the board (rounded lip)", "hold": "Slopers", "in_plan": "no"},
    {"chart": 1, "location": "Top row, outside", "hold": "4-finger edge, the shallowest hold on the board", "in_plan": "no"},
    {"chart": 2, "location": "Top row, two center holds", "hold": "3-finger edge", "in_plan": "no"},
    {"chart": 3, "location": "Middle row, outside", "hold": "Deep 4-finger edge", "in_plan": "phase 1-3"},
    {"chart": 4, "location": "Middle row, 2nd from outside", "hold": "Deep 2-finger pocket", "in_plan": "no"},
    {"chart": 5, "location": "Middle row, 3rd from outside", "hold": "Deep 3-finger pocket", "in_plan": "no"},
    {"chart": 6, "location": "Middle row, center (single wide hold)", "hold": "Very deep 4-finger edge (single hold)", "in_plan": "no"},
    {"chart": 7, "location": "Bottom row, outside", "hold": "Medium 4-finger edge", "in_plan": "phase 2-3"},
    {"chart": 8, "location": "Bottom row, 2nd from outside", "hold": "2-finger pocket", "in_plan": "no"},
    {"chart": 9, "location": "Bottom row, center pair", "hold": "3-finger pocket", "in_plan": "no"},
]

# Hevy exercise title -> hold key. The only fingerboard exercises the coach
# may prescribe.
PLAN_EXERCISES = {
    "BM1000 Middle Row Outside - Half Crimp": "middle_outside",
    "BM1000 Middle Row Outside - Open Hand": "middle_outside",
    "BM1000 Bottom Row Outside - Half Crimp": "bottom_outside",
    "BM1000 Bottom Row Outside - Open Hand": "bottom_outside",
}
# Any other catalog entry with one of these words is a finger-loading
# exercise outside the plan (e.g. the athlete's older generic "Hangboard",
# which has no hold and no weight field) and is never prescribable.
_FINGER_WORDS = {"hangboard", "fingerboard", "bm1000", "campus"}


@dataclass(frozen=True)
class PhaseRule:
    name: str
    holds: frozenset[str]
    max_sets: int
    max_set_seconds: int
    added_weight: bool
    min_rir: float


PHASES = {
    1: PhaseRule("Tissue prep", frozenset({"middle_outside"}), 3, 60, False, 4.0),
    2: PhaseRule("Volume base", frozenset({"middle_outside", "bottom_outside"}), 4, 60, False, 3.0),
    3: PhaseRule("Strength", frozenset({"middle_outside", "bottom_outside"}), 5, 12, True, 2.0),
}
MAX_BOARD_DAYS_PER_WEEK = 2
# Phase 3 load creeps up at most this much over the best weight already
# logged on that hold.
MAX_WEIGHT_STEP_LB = 2.5


def _name_words(name: str) -> set[str]:
    for ch in "-/()":
        name = name.replace(ch, " ")
    return set(name.lower().split())


def resolve_plan_exercises(catalog: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    """{exercise_id: {"name", "hold"}} for the plan's exercises found in the
    live catalog. Missing ones simply aren't prescribable this run."""
    return {
        ex["id"]: {"name": ex["name"], "hold": PLAN_EXERCISES[ex["name"]]}
        for ex in catalog
        if ex["name"] in PLAN_EXERCISES
    }


def resolve_off_plan_finger_ids(catalog: list[dict[str, Any]]) -> dict[str, str]:
    return {
        ex["id"]: ex["name"]
        for ex in catalog
        if ex["name"] not in PLAN_EXERCISES and _name_words(ex["name"]) & _FINGER_WORDS
    }


# --- State -------------------------------------------------------------------


def load_state(report_dir: Path, session_date: date) -> dict[str, Any]:
    """Current phase. A missing or unreadable file means phase 1 with no
    known start, which turns off deload-week scheduling but nothing else."""
    raw: dict[str, Any] = {}
    path = report_dir / STATE_FILE
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            raw = {}
    phase = raw.get("phase") if raw.get("phase") in PHASES else 1
    ramp_started = _parse_date(raw.get("ramp_started"))
    phase_started = _parse_date(raw.get("phase_started"))
    ramp_week = (session_date - ramp_started).days // 7 + 1 if ramp_started else None
    return {
        "phase": phase,
        "phase_name": PHASES[phase].name,
        "phase_started": phase_started.isoformat() if phase_started else None,
        "weeks_in_phase": (session_date - phase_started).days // 7 + 1 if phase_started else None,
        "ramp_started": ramp_started.isoformat() if ramp_started else None,
        "ramp_week": ramp_week,
        # Every 4th week of the ramp halves board sets.
        "deload_week": bool(ramp_week and ramp_week % 4 == 0),
    }


def _parse_date(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


# --- History -----------------------------------------------------------------


def collect_history(
    hevy_client: "HevyClient",
    plan_exercises: dict[str, dict[str, str]],
    since: date,
) -> list[dict[str, Any]]:
    """Every logged set on the plan's exercises since `since`, oldest first,
    in pounds and RIR."""
    from .hevy_client import kg_to_lb, rpe_to_rir

    rows = []
    for ex_id, info in plan_exercises.items():
        for entry in hevy_client.get_exercise_history(ex_id, since):
            rows.append(
                {
                    "date": (entry.get("workout_start_time") or "")[:10],
                    "workout_id": entry.get("workout_id"),
                    "exercise_name": info["name"],
                    "hold": info["hold"],
                    "set_type": entry.get("set_type"),
                    "duration_seconds": entry.get("duration_seconds"),
                    "added_weight_lb": kg_to_lb(entry["weight_kg"]) if entry.get("weight_kg") else None,
                    "rpe": entry.get("rpe"),
                    "rir": rpe_to_rir(entry.get("rpe")),
                }
            )
    rows.sort(key=lambda r: r["date"])
    return rows


def board_days_in_last_week(history: list[dict[str, Any]], session_date: date) -> int:
    start = session_date - timedelta(days=6)
    return len(
        {
            r["date"]
            for r in history
            if r["date"] and start <= date.fromisoformat(r["date"]) < session_date
        }
    )


def best_added_weight_lb(history: list[dict[str, Any]], hold: str) -> float:
    weights = [r["added_weight_lb"] or 0.0 for r in history if r["hold"] == hold and r["set_type"] != "warmup"]
    return max(weights, default=0.0)


_CLIMB_TYPES = ("climb", "boulder")


def hours_since_last_climb(
    activities: list[dict[str, Any]], now: datetime
) -> float | None:
    """From Garmin activity summaries (indoor_climbing, bouldering, ...):
    hours between the end of the most recent climb and `now` (naive local
    time, matching Garmin's startTimeLocal). None when no climb is in the
    window."""
    ends = []
    for a in activities:
        type_key = ((a.get("activityType") or {}).get("typeKey") or "").lower()
        if not any(t in type_key for t in _CLIMB_TYPES):
            continue
        try:
            start = datetime.fromisoformat(str(a.get("startTimeLocal")))
        except ValueError:
            continue
        ends.append(start + timedelta(seconds=float(a.get("duration") or 0)))
    if not ends:
        return None
    return round((now - max(ends)).total_seconds() / 3600, 1)


def build_context(
    hevy_client: "HevyClient",
    catalog: list[dict[str, Any]],
    report_dir: Path,
    session_date: date,
    mountain_activity: list[dict[str, Any]],
    finger_flag: bool,
    now: datetime | None = None,
) -> dict[str, Any]:
    plan_exercises = resolve_plan_exercises(catalog)
    state = load_state(report_dir, session_date)
    history = collect_history(hevy_client, plan_exercises, session_date - timedelta(weeks=8))
    board_days = board_days_in_last_week(history, session_date)
    return {
        **state,
        "finger_flag_active": finger_flag,
        "board_days_last_7d": board_days,
        "hours_since_last_climb": hours_since_last_climb(mountain_activity, now or datetime.now()),
        "limits": limits_for(state, history, finger_flag, board_days),
        "board_map": BOARD_MAP,
        "plan_exercises": [{"id": k, **v} for k, v in plan_exercises.items()],
        "history": history,
    }


def limits_for(
    state: dict[str, Any], history: list[dict[str, Any]], finger_flag: bool, board_days: int
) -> dict[str, Any]:
    """The same numbers assert_fingerboard_safe() enforces, handed to the
    coach so it never has to guess a limit."""
    rule = PHASES[state["phase"]]
    blocked = (
        "finger flag is on" if finger_flag
        else f"already {board_days} board days in the last 7" if board_days >= MAX_BOARD_DAYS_PER_WEEK
        else None
    )
    return {
        "board_allowed_today": blocked is None,
        "blocked_reason": blocked,
        "allowed_holds": sorted(rule.holds),
        "max_total_sets": math.ceil(rule.max_sets / 2) if state["deload_week"] else rule.max_sets,
        "max_seconds_per_set": rule.max_set_seconds,
        "min_rir_target": rule.min_rir,
        "max_added_weight_lb": {
            hold: (best_added_weight_lb(history, hold) + MAX_WEIGHT_STEP_LB) if rule.added_weight else 0
            for hold in sorted(rule.holds)
        },
    }


# --- Guard -------------------------------------------------------------------


def assert_fingerboard_safe(
    exercises: list["ExercisePrescription"],
    catalog: list[dict[str, Any]],
    context: dict[str, Any],
) -> None:
    """Hard limits for this phase, checked before any Hevy write. Raises on
    the first violation; nothing partial is written."""
    plan = resolve_plan_exercises(catalog)
    off_plan = resolve_off_plan_finger_ids(catalog)
    rule = PHASES[context["phase"]]
    board = [ex for ex in exercises if ex.exercise_id in plan]

    for ex in exercises:
        if ex.exercise_id in off_plan:
            raise UnsafeExerciseError(
                f"Claude proposed {off_plan[ex.exercise_id]!r}, a finger exercise outside the "
                "Beastmaker ramp -- only the BM1000 plan exercises may be prescribed"
            )
    if not board:
        return

    def fail(ex: "ExercisePrescription", why: str) -> None:
        raise UnsafeExerciseError(
            f"Fingerboard guard (phase {context['phase']} {rule.name}): "
            f"{ex.exercise_name!r} {why}"
        )

    limits = context["limits"]
    if not limits["board_allowed_today"]:
        fail(board[0], f"prescribed but the board is off today ({limits['blocked_reason']})")

    total_sets = sum(ex.sets for ex in board)
    if total_sets > limits["max_total_sets"]:
        fail(board[0], f"block has {total_sets} sets, limit {limits['max_total_sets']}"
             f"{' (deload week)' if context.get('deload_week') else ''}")

    for ex in board:
        hold = plan[ex.exercise_id]["hold"]
        if hold not in limits["allowed_holds"]:
            fail(ex, f"uses the {hold} hold, not allowed until a later phase")
        if ex.duration_seconds is None or ex.reps is not None:
            fail(ex, "must be prescribed as a timed hang (duration_seconds), not reps")
        if not 0 < ex.duration_seconds <= limits["max_seconds_per_set"]:
            fail(ex, f"duration {ex.duration_seconds}s is outside 1-{limits['max_seconds_per_set']}s per set")
        if ex.rir_target is None or ex.rir_target < limits["min_rir_target"]:
            fail(ex, f"rir_target {ex.rir_target} is harder than this phase allows (min {limits['min_rir_target']:g})")
        weight = ex.weight_lb or 0.0
        if weight < 0:
            fail(ex, "has negative weight; assistance goes in the notes")
        if weight > limits["max_added_weight_lb"][hold]:
            fail(ex, f"adds {weight:g} lb, limit {limits['max_added_weight_lb'][hold]:g} lb this phase")
