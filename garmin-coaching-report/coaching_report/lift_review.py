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
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from .lift_equipment import load_problems

if TYPE_CHECKING:
    from .lift_coach import ExercisePrescription

STRENGTH_SESSIONS = ("heavy_1h", "light_30m")
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
    problems = load_problems(exercises, catalog_by_id) + progression_problems(exercises, history)
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
