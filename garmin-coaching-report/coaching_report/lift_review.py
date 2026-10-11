"""Checks on a generated lift session that aren't safety: can the basement
make every load, does it train arms, does every exercise say what goal it
serves and why, and is every stated priority actually trained (climbing
means a pull-up, chin-up or lock-off, not just a pulldown).

The 2026-10-07 session came back with Monday's lifts, a 27.5 lb dumbbell
that doesn't exist, and one curl as the only arm work. Repeating a lift is
fine when it's still the most effective choice for a goal (the athlete's
call, ADR 0006), so there is no repeat cap; the coach has to justify it in
`why` instead. A problem here doesn't discard the session: lift_main hands
the list back to the coach for one revision, and whatever is still wrong
after that is shown in flags_considered.

Two checks are stricter. A name that doesn't match the Hevy template behind
its exercise_id would make the plan say one exercise while Hevy shows (and
logs) another, so lift_main refuses to write it if the revision doesn't fix
it. Fingerboard sessions also get brevity checks (2026-10-11: the athlete
found the board notes too long to follow on the board).
"""

from __future__ import annotations

import dataclasses
import re
from typing import TYPE_CHECKING, Any

from .lift_equipment import load_kind, load_problems

if TYPE_CHECKING:
    from .lift_coach import ExercisePrescription

STRENGTH_SESSIONS = ("heavy_1h", "light_30m")
# A barbell lift at or above this working weight needs warm-up sets (he asked
# for them; going cold into 185 lb was rough).
WARMUP_FROM_LB = 95.0
# One line on a phone in Hevy. The RIR target is appended after this.
MAX_BOARD_NOTE_CHARS = 140
MAX_BOARD_SUMMARY_CHARS = 500
VALID_GOALS = {"climbing", "mtb", "snowboard", "physique", "core", "shoulder_health"}


def progression_problems(
    exercises: list["ExercisePrescription"], history: list[dict[str, Any]]
) -> list[str]:
    """No added load on a lift whose last top-weight sets reached RPE 9.5-10.
    (The 2026-10-07 preview raised hammer curls to 35 lb *because* 30 lb hit
    RPE 10.)"""
    problems = []
    for ex in exercises:
        if ex.weight_lb is None:
            continue
        last = next(
            (e for s in reversed(history) for e in s["exercises"] if e.get("exercise_id") == ex.exercise_id),
            None,
        )
        working = [st for st in (last or {}).get("sets", []) if st["set_type"] != "warmup" and st["weight_lb"]]
        if not working:
            continue
        top = max(st["weight_lb"] for st in working)
        hardest = max((st["rpe"] or 0) for st in working if st["weight_lb"] == top)
        if hardest >= 9.5 and ex.weight_lb > top:
            problems.append(
                f"{ex.exercise_name}: last time {top:g} lb reached RPE {hardest:g}, so don't add load "
                f"({ex.weight_lb:g} lb); hold {top:g} lb or go lighter until it's RPE 8.5 or easier"
            )
    return problems


def name_problems(
    exercises: list["ExercisePrescription"], catalog_by_id: dict[str, dict[str, Any]]
) -> list[str]:
    """Hevy shows (and logs) the template behind exercise_id, whatever name
    the coach wrote next to it."""
    return [
        f"{ex.exercise_name!r} has exercise_id {ex.exercise_id}, which Hevy shows as "
        f"{catalog_by_id[ex.exercise_id]['name']!r}; use the id of the exercise you mean "
        "and its exact catalog name"
        for ex in exercises
        if ex.exercise_id in catalog_by_id and catalog_by_id[ex.exercise_id]["name"] != ex.exercise_name
    ]


def fingerboard_problems(
    exercises: list["ExercisePrescription"], summary_text: str, warmup_id: str | None
) -> list[str]:
    problems = []
    if warmup_id and not any(ex.exercise_id == warmup_id for ex in exercises):
        problems.append("no BM1000 Warm-up entry; the warm-up is its own exercise with timed warm-up sets")
    for ex in exercises:
        if len(ex.notes or "") > MAX_BOARD_NOTE_CHARS:
            problems.append(
                f"notes for {ex.exercise_name} are {len(ex.notes)} characters; keep them to one line "
                f"under {MAX_BOARD_NOTE_CHARS} (the sets carry the structure, the notes only the cue)"
            )
    if len(summary_text) > MAX_BOARD_SUMMARY_CHARS:
        problems.append(
            f"summary_text is {len(summary_text)} characters; keep it under {MAX_BOARD_SUMMARY_CHARS}: "
            "the focus line and one short line per exercise"
        )
    return problems


def warmup_problems(
    exercises: list["ExercisePrescription"], catalog_by_id: dict[str, dict[str, Any]]
) -> list[str]:
    """Warm-up sets are real Hevy sets: makeable loads, lighter than the
    working weight, only on rep exercises, and present on heavy barbell lifts."""
    problems = []
    for ex in exercises:
        warmups = ex.warmup_sets or []
        entry = catalog_by_id.get(ex.exercise_id)
        if warmups and ex.duration_seconds is not None:
            problems.append(f"{ex.exercise_name} is timed; warmup_sets are for rep exercises only")
            continue
        for w in warmups:
            if ex.weight_lb is not None and w.get("weight_lb") is not None and w["weight_lb"] >= ex.weight_lb:
                problems.append(
                    f"{ex.exercise_name} warm-up at {w['weight_lb']:g} lb isn't lighter than the "
                    f"{ex.weight_lb:g} lb working sets"
                )
        problems += load_problems(
            [
                dataclasses.replace(ex, exercise_name=f"{ex.exercise_name} warm-up", weight_lb=w["weight_lb"], superset_group=None)
                for w in warmups
                if w.get("weight_lb") is not None
            ],
            catalog_by_id,
        )
        if (
            entry
            and load_kind(entry) == "barbell"
            and (ex.weight_lb or 0) >= WARMUP_FROM_LB
            and not warmups
        ):
            problems.append(
                f"{ex.exercise_name} at {ex.weight_lb:g} lb has no warmup_sets; heavy compound lifts "
                "get a ramp (e.g. bar x 8, then 2-3 lighter sets)"
            )
    return problems


def _is_bodyweight_pull(name: str) -> bool:
    n = name.lower()
    return ("pull up" in n or "chin up" in n or "lock" in n) and "scapular" not in n


def review_plan(
    exercises: list["ExercisePrescription"],
    session_type: str,
    catalog_by_id: dict[str, dict[str, Any]],
    priorities: list[str] = (),
    history: list[dict[str, Any]] = (),
) -> list[str]:
    """`history` is the payload's recent_lift_sessions (oldest first)."""
    problems = (
        name_problems(exercises, catalog_by_id)
        + load_problems(exercises, catalog_by_id)
        + warmup_problems(exercises, catalog_by_id)
        + progression_problems(exercises, history)
    )
    unexplained = [ex.exercise_name for ex in exercises if not ex.goal or not (ex.why or "").strip()]
    if unexplained:
        problems.append(f"no goal or why given for: {', '.join(unexplained)}")
    if session_type not in STRENGTH_SESSIONS:
        return problems

    goals = {ex.goal for ex in exercises}
    for priority in priorities:
        named = {g.strip().lower().replace(" ", "_") for g in re.split(r"[/,+&]", priority.split(":", 1)[0])}
        if named & VALID_GOALS and not named & goals:
            problems.append(f"priority {priority.split(':', 1)[0].strip()!r} has no exercise with that goal")
    if any(p.lower().lstrip().startswith("climbing") for p in priorities) and not any(
        _is_bodyweight_pull(ex.exercise_name) for ex in exercises
    ):
        problems.append(
            "climbing is a priority but there is no pull-up or chin-up (band-assisted is fine) or "
            "lock-off; those are his named climbing weaknesses and a pulldown doesn't replace them"
        )

    muscles = {
        catalog_by_id[ex.exercise_id].get("muscle")
        for ex in exercises
        if ex.exercise_id in catalog_by_id and ex.duration_seconds is None
    }
    if session_type == "heavy_1h":
        missing = [m for m in ("biceps", "triceps") if m not in muscles]
        if missing:
            problems.append(
                f"no {' or '.join(missing)} exercise; every heavy session trains both biceps and "
                "triceps (arms are the athlete's top physique goal)"
            )
    elif not muscles & {"biceps", "triceps"}:
        problems.append("no arm exercise; even a light session includes one biceps or triceps movement")
    return problems
