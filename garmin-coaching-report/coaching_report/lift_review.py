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

Barbell hinges (deadlifts, rack pulls, RDLs, good mornings) have limits for
his back (ADR 0011): a ceiling of 1.5x bodyweight, every working set at RIR 2
or more, 3-6 reps on floor and pin pulls, and no added load after a top set
harder than RPE 8. Those go to the revision like any other problem, and then
enforce_hinge_limits() clamps whatever the revision left, so a session can
never go out over them.
"""

from __future__ import annotations

import dataclasses
import math
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
# Barbell hinges and his back (ADR 0011, 2026-10-25). Disc injuries come from
# loaded spinal flexion under fatigue, so effort and reps are limited, not
# just load. None of his goals needs a deadlift past about 1.5x bodyweight.
HINGE_CEILING_X_BODYWEIGHT = 1.5
DEFAULT_BODYWEIGHT_LB = 180.0  # the profile in prompts/lift_system.md; Hevy bodyweight is often empty
HINGE_MIN_RIR = 2.0
HINGE_PROGRESS_MAX_RPE = 8.0  # a top set harder than this holds the load next time
HINGE_REPS = {"pull": (3, 6), "hinge": (3, 10)}


def _last_working_sets(exercise_id: str, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    last = next(
        (e for s in reversed(history) for e in s["exercises"] if e.get("exercise_id") == exercise_id),
        None,
    )
    return [st for st in (last or {}).get("sets", []) if st["set_type"] != "warmup" and st["weight_lb"]]


def _top_set(working: list[dict[str, Any]]) -> tuple[float, float]:
    """(top weight, hardest RPE at that weight; 0 when unrated)."""
    top = max(st["weight_lb"] for st in working)
    return top, max((st["rpe"] or 0) for st in working if st["weight_lb"] == top)


def hinge_kind(entry: dict[str, Any] | None) -> str | None:
    """'pull' for floor and pin pulls (deadlift, sumo, rack pull), 'hinge'
    for the other barbell hinges (RDL, straight-leg deadlift, good morning),
    None for everything else."""
    if not entry or load_kind(entry) != "barbell":
        return None
    name = entry["name"].lower()
    if "high pull" in name or not any(k in name for k in ("deadlift", "rack pull", "good morning")):
        return None
    return "hinge" if any(k in name for k in ("romanian", "straight leg", "stiff leg", "good morning")) else "pull"


def hinge_limits(bodyweight_history: list[dict[str, Any]]) -> dict[str, Any]:
    """The payload's `hinge_limits`: today's ceiling from the latest Hevy
    bodyweight, or the profile's 180 lb when he hasn't logged one."""
    bodyweight = bodyweight_history[-1]["weight_lb"] if bodyweight_history else DEFAULT_BODYWEIGHT_LB
    return {
        "ceiling_lb": math.floor(bodyweight * HINGE_CEILING_X_BODYWEIGHT / 5) * 5,
        "bodyweight_lb": round(bodyweight, 1),
        "bodyweight_source": "hevy" if bodyweight_history else "profile",
        "min_rir": HINGE_MIN_RIR,
        "reps": {"floor_and_pin_pulls": list(HINGE_REPS["pull"]), "rdl_and_good_morning": list(HINGE_REPS["hinge"])},
        "hold_load_after_rpe_above": HINGE_PROGRESS_MAX_RPE,
    }


def _hinge_max_lb(ex: "ExercisePrescription", ceiling: float, history: list[dict[str, Any]]) -> tuple[float, str]:
    """The heaviest working weight allowed today, and why."""
    working = _last_working_sets(ex.exercise_id, history)
    if working:
        top, hardest = _top_set(working)
        if hardest > HINGE_PROGRESS_MAX_RPE and top < ceiling:
            return top, f"last time {top:g} lb reached RPE {hardest:g}, so hold it until it's RPE 8 or easier"
    return ceiling, f"the ceiling is {ceiling:g} lb ({HINGE_CEILING_X_BODYWEIGHT:g}x bodyweight)"


def hinge_problems(
    exercises: list["ExercisePrescription"],
    catalog_by_id: dict[str, dict[str, Any]],
    limits: dict[str, Any],
    history: list[dict[str, Any]] = (),
) -> list[str]:
    problems = []
    for ex in exercises:
        kind = hinge_kind(catalog_by_id.get(ex.exercise_id))
        if kind is None:
            continue
        if ex.weight_lb is not None:
            max_lb, reason = _hinge_max_lb(ex, limits["ceiling_lb"], history)
            if ex.weight_lb > max_lb:
                problems.append(
                    f"{ex.exercise_name} at {ex.weight_lb:g} lb is too heavy: {reason}; at the cap, "
                    "progress reps within the range and move extra hinge volume to RDLs or cable pull-throughs"
                )
        if ex.rir_target is None or ex.rir_target < HINGE_MIN_RIR:
            problems.append(
                f"{ex.exercise_name} has rir_target {ex.rir_target}; barbell hinges keep 2 or more reps in reserve"
            )
        low, high = HINGE_REPS[kind]
        if ex.reps is not None and not low <= ex.reps <= high:
            problems.append(
                f"{ex.exercise_name} at {ex.reps} reps; {'floor and pin pulls' if kind == 'pull' else 'this hinge'} "
                f"stays at {low}-{high} reps (no singles or doubles, no long fatiguing sets)"
            )
    return problems


def enforce_hinge_limits(
    exercises: list["ExercisePrescription"],
    catalog_by_id: dict[str, dict[str, Any]],
    limits: dict[str, Any],
    history: list[dict[str, Any]] = (),
) -> list[str]:
    """Clamp barbell hinges to their limits after the revision. Returns what
    changed."""
    changed = []
    for ex in exercises:
        kind = hinge_kind(catalog_by_id.get(ex.exercise_id))
        if kind is None:
            continue
        if ex.weight_lb is not None:
            max_lb, _ = _hinge_max_lb(ex, limits["ceiling_lb"], history)
            if ex.weight_lb > max_lb:
                changed.append(f"{ex.exercise_name}: {ex.weight_lb:g} lb -> {max_lb:g} lb (back-safety limit)")
                ex.weight_lb = max_lb
                ex.warmup_sets = [w for w in ex.warmup_sets or [] if (w.get("weight_lb") or 0) < max_lb]
        if ex.rir_target is None or ex.rir_target < HINGE_MIN_RIR:
            changed.append(f"{ex.exercise_name}: RIR {ex.rir_target} -> {HINGE_MIN_RIR:g} (back-safety limit)")
            ex.rir_target = HINGE_MIN_RIR
        low, high = HINGE_REPS[kind]
        if ex.reps is not None and not low <= ex.reps <= high:
            new = min(max(ex.reps, low), high)
            changed.append(f"{ex.exercise_name}: {ex.reps} -> {new} reps (back-safety limit)")
            ex.reps = new
    return changed


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
        working = _last_working_sets(ex.exercise_id, history)
        if not working:
            continue
        top, hardest = _top_set(working)
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
    bodyweight_history: list[dict[str, Any]] = (),
) -> list[str]:
    """`history` is the payload's recent_lift_sessions (oldest first)."""
    problems = (
        name_problems(exercises, catalog_by_id)
        + load_problems(exercises, catalog_by_id)
        + warmup_problems(exercises, catalog_by_id)
        + progression_problems(exercises, history)
        + hinge_problems(exercises, catalog_by_id, hinge_limits(bodyweight_history), history)
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
