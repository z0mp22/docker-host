"""Code-level guard behind the shoulder-safety exclude list.

The system prompt (prompts/lift_system.md) tells Claude never to prescribe
these movements, and explains why. This module does not trust that alone --
it independently re-checks every proposed exercise against the live wger
catalog before anything is written, the same "prompt instruction backed by a
hard code check" posture as the mountain report's stop_reason==max_tokens
guard, its window-inversion guard, and EmptyWindowError.

Keyword matching against wger's real exercise names/aliases can't be fully
validated from documentation alone -- a human must review the resolved
banned-id list (printed by lift_main.py in DRY_RUN mode) before any live run
that could actually write to wger. Do not skip that review because this file
exists; it is a second layer, not a replacement for one.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .errors import UnknownExerciseError, UnsafeExerciseError

if TYPE_CHECKING:
    from .lift_coach import ExercisePrescription

# Word-based matching, not naive substring matching -- a substring check for
# "incline press" fails against a real catalog name like "Incline Dumbbell
# Press" (an equipment word sits between "incline" and "press"), and the same
# flaw would miss "Overhead Dumbbell Press" too. Match on whether qualifying
# words are present anywhere in the name instead of requiring them adjacent.
_STANDALONE_BANNED_WORDS = {"dip", "dips"}
_PRESS_QUALIFIER_WORDS = {
    "overhead",
    "military",
    "push",
    "arnold",
    "z",
    "shoulder",
    "bench",
    "incline",
    "decline",
}


def _name_words(name: str) -> set[str]:
    return set(name.lower().replace("-", " ").replace("/", " ").split())


def _name_is_banned(name: str) -> bool:
    words = _name_words(name)
    if words & _STANDALONE_BANNED_WORDS:
        return True
    # "press" alone isn't enough -- leg press, cable press, landmine press
    # are all fine; it's only banned paired with a qualifying word (a
    # pressing pattern that loads the shoulder into a risky range, or a
    # bench-supported variant).
    return "press" in words and bool(words & _PRESS_QUALIFIER_WORDS)


assert not _name_is_banned("Floor Press"), (
    "floor press must never match the exclude list -- it's explicitly allowed"
)
assert _name_is_banned("Incline Dumbbell Press"), (
    "a qualifying word separated from 'press' by equipment words must still be caught"
)
assert not _name_is_banned("Leg Press"), "unrelated 'press' exercises must not be swept in"
assert not _name_is_banned("Landmine Press"), "landmine press is a judgment call, not a hard ban"

# Hand-curated overrides, filled in after reviewing the real catalog (Stage 2
# of the verification plan). IDs here are force-banned/force-allowed
# regardless of what the keyword match above decides -- e.g. a name the
# keywords miss, or a false positive like "Pike Press" that keyword-matches
# "press" but isn't actually load-bearing on the shoulder the same way.
EXTRA_BANNED_EXERCISE_IDS: set[int] = set()
EXTRA_ALLOWED_EXERCISE_IDS: set[int] = set()


def resolve_banned_exercise_ids(catalog: list[dict[str, Any]]) -> dict[int, str]:
    """Recomputed fresh from the live catalog every run -- always in sync,
    never a stale hardcoded id list. Returns {id: name} so callers (and the
    DRY_RUN human-review step) can see exactly what was banned and why."""
    banned = {
        ex["id"]: ex["name"]
        for ex in catalog
        if _name_is_banned(ex["name"]) and ex["id"] not in EXTRA_ALLOWED_EXERCISE_IDS
    }
    for ex in catalog:
        if ex["id"] in EXTRA_BANNED_EXERCISE_IDS:
            banned[ex["id"]] = ex["name"]
    return banned


def assert_session_plan_safe(
    exercises: list["ExercisePrescription"],
    catalog_by_id: dict[int, dict[str, Any]],
    banned_ids: dict[int, str],
) -> None:
    """Run immediately after Claude's response is parsed and strictly before
    any wger write. Raises on the first violation -- the whole generation is
    discarded, nothing partial is written, no substitution is attempted."""
    for ex in exercises:
        catalog_entry = catalog_by_id.get(ex.exercise_id)
        if catalog_entry is None:
            raise UnknownExerciseError(
                f"Claude proposed exercise_id={ex.exercise_id} "
                f"({ex.exercise_name!r}), which is not in the fetched wger catalog"
            )
        if ex.exercise_id in banned_ids:
            raise UnsafeExerciseError(
                f"Claude proposed a banned exercise: {catalog_entry['name']!r} "
                f"(id={ex.exercise_id}) -- matches the shoulder-safety exclude list"
            )
