"""Checks on a generated lift session that aren't safety: does it vary
from last time, can the basement make every load, is it upper-body weighted,
and does it train arms.

The 2026-10-07 session came back with the same five lifts as Monday's,
a 27.5 lb dumbbell that doesn't exist, and one curl as the only arm work.
The prompt already said sessions should differ, so the rules are now checked
here too. Unlike lift_safety, a problem here doesn't discard the session:
lift_main hands the list back to the coach for one revision, and whatever
is still wrong after that is shown in flags_considered.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .lift_equipment import load_problems

if TYPE_CHECKING:
    from .lift_coach import ExercisePrescription

# Exercises from the previous lift session that may come back: the main lift
# being progressed plus one more. Timed holds (dead hang, plank) don't count.
MAX_REPEATS = 2
# Leg share of working sets, above which the session isn't upper-body weighted.
MAX_LEG_SHARE = 0.4
LEG_MUSCLES = {"quadriceps", "hamstrings", "glutes", "calves", "abductors", "adductors", "lower_back"}
STRENGTH_SESSIONS = ("heavy_1h", "light_30m")


def _counted(ex: "ExercisePrescription", entry: dict[str, Any] | None) -> bool:
    return entry is not None and ex.duration_seconds is None and entry.get("type") != "duration"


def review_plan(
    exercises: list["ExercisePrescription"],
    session_type: str,
    catalog_by_id: dict[str, dict[str, Any]],
    last_lift_exercise_ids: list[str],
) -> list[str]:
    problems = load_problems(exercises, catalog_by_id)
    if session_type not in STRENGTH_SESSIONS:
        return problems

    counted = [(ex, catalog_by_id[ex.exercise_id]) for ex in exercises
               if _counted(ex, catalog_by_id.get(ex.exercise_id))]

    previous = set(last_lift_exercise_ids)
    repeats = [ex.exercise_name for ex, _ in counted if ex.exercise_id in previous]
    if len(repeats) > MAX_REPEATS:
        problems.append(
            f"{len(repeats)} exercises repeat the last lift session ({', '.join(repeats)}); "
            f"keep at most {MAX_REPEATS} (the main lift you're progressing plus one) and swap the "
            "rest for different movements that train the same goal"
        )

    total_sets = sum(ex.sets for ex, _ in counted)
    leg_sets = sum(ex.sets for ex, entry in counted if entry.get("muscle") in LEG_MUSCLES)
    if total_sets and leg_sets / total_sets > MAX_LEG_SHARE:
        problems.append(
            f"legs are {leg_sets} of {total_sets} working sets; the athlete wants sessions "
            f"weighted to upper body (legs at most {MAX_LEG_SHARE:.0%} of working sets)"
        )

    muscles = {entry.get("muscle") for _, entry in counted}
    if session_type == "heavy_1h":
        missing = [m for m in ("biceps", "triceps") if m not in muscles]
        if missing:
            problems.append(
                f"no {' or '.join(missing)} exercise; every heavy session trains both biceps and "
                "triceps (arms are the athlete's top vanity goal)"
            )
    elif not muscles & {"biceps", "triceps"}:
        problems.append("no arm exercise; even a light session includes one biceps or triceps movement")
    return problems
