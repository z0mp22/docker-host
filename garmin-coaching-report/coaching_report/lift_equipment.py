"""The athlete's basement gym: what's there, which Hevy exercises it can
actually do, and which loads it can actually make.

Hevy's catalog is written for a commercial gym (leg press, Smith machine,
pec deck, benches everywhere), and the coach had no inventory, so it could
prescribe a 27.5 lb dumbbell nobody owns. The inventory here is what the
athlete listed on 2026-10-07:

- Mikolo power cage with a pull-up bar and a plate-loaded cable crossover
  (all the cable attachments). Cable weight is the plates on the pin.
- Barbell (assumed 45 lb), EZ bar, landmine mount.
- Plates: 2 x 45, 4 x 25, 2 x 10, 4 x 5, 2 x 2.5 lb (235 lb in all, shared
  by the barbell, the landmine and the cable pins).
- Dumbbells 5-40 lb in 5 lb steps. Kettlebells 35 and 45 lb. Bands.
- No bench, so nothing that needs one.

The athlete also said no single-leg work of any kind. Single-leg and
not-at-home exercises are removed from the catalog the coach sees, so
lift_safety's unknown-exercise check rejects them if one slips through.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .lift_coach import ExercisePrescription

BARBELL_LB = 45.0
PLATES_LB = {45.0: 2, 25.0: 4, 10.0: 2, 5.0: 4, 2.5: 2}
PLATE_TOTAL_LB = sum(w * n for w, n in PLATES_LB.items())
DUMBBELLS_LB = tuple(float(w) for w in range(5, 45, 5))
KETTLEBELLS_LB = (35.0, 45.0)

# Handed to the coach as-is (payload["equipment"]).
HOME_GYM = {
    "rack": "Mikolo power cage with pull-up bar, J-hooks and safeties",
    "cable": (
        "Plate-loaded cable crossover on the cage, two pins, all attachments (rope, "
        "V-grip, straight bar, single handles, ankle strap). Cable weight_lb = plates on the pin."
    ),
    "barbell_lb": BARBELL_LB,
    "other_bars": ["EZ bar", "landmine mount"],
    "plates_lb": {f"{w:g}": n for w, n in PLATES_LB.items()},
    "plate_total_lb": PLATE_TOTAL_LB,
    "dumbbells_lb": list(DUMBBELLS_LB),
    "kettlebells_lb": list(KETTLEBELLS_LB),
    "bands": True,
    "bench": False,
}

# Phrases (matched against the lowercased name) for kit the basement doesn't
# have. Checked against the live catalog 2026-10-07: Hevy tags pull-ups and
# every cable exercise as "machine" too, so equipment can't be used here.
_NOT_AT_HOME = (
    "machine", "smith", "pec deck", "parallel bars", "trap bar", "hyperextension",
    "glute ham raise", "seated calf raise", "iso-lateral", "vertical traction",
    "torso rotation", "wall ball", "ball slams", "box jump", "(assisted)",
    "ring pull up", "ring push up", "ring dips", "chest supported", "seal row",
    "preacher", "incline bench", "incline chest", "incline row", "seated incline",
    "decline", "spider curl", "hip thrust", "pullover", "jm press", "bench",
    "hack squat", "belt squat", "pendulum squat", "squat row", "sissy squat",
    "kipping", "muscle up",
)
_NOT_AT_HOME_EQUIPMENT = {"suspension"}
_SINGLE_LEG = (
    "single leg", "split squat", "lunge", "step up", "pistol", "curtsy",
    "lateral squat", "cossack", "skater", "glute kickback", "standing leg curl",
    "hip abduction (cable)", "hip adduction (cable)", "fire hydrant", "clamshell",
    "lateral leg raise", "rear kick",
)


def _drop_reason(ex: dict[str, Any]) -> str | None:
    name = ex["name"].lower()
    if any(p in name for p in _SINGLE_LEG):
        return "single-leg"
    if ex.get("equipment") in _NOT_AT_HOME_EQUIPMENT or any(p in name for p in _NOT_AT_HOME):
        return "not in the home gym"
    return None


def home_gym_catalog(catalog: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """(kept, {dropped name: reason}) -- kept is what the coach may use."""
    kept, dropped = [], {}
    for ex in catalog:
        reason = _drop_reason(ex)
        if reason:
            dropped[ex["name"]] = reason
        else:
            kept.append(ex)
    return kept, dropped


# --- Loads -------------------------------------------------------------------


def _subset_sums(counts: dict[float, int]) -> set[float]:
    sums = {0.0}
    for weight, n in counts.items():
        sums = {s + weight * k for s in sums for k in range(n + 1)}
    return sums


# Every bar load a symmetric plate pair can make, and every pin load.
BARBELL_LOADS = sorted(BARBELL_LB + 2 * s for s in _subset_sums({w: n // 2 for w, n in PLATES_LB.items()}))
CABLE_LOADS = sorted(s for s in _subset_sums(PLATES_LB) if s > 0)


def load_kind(ex: dict[str, Any]) -> str | None:
    """How a catalog exercise is loaded at home, or None when it isn't
    checked (bodyweight, bands, EZ bar and landmine, whose logged weight
    convention isn't pinned down)."""
    name = ex["name"].lower()
    eq = ex.get("equipment")
    if ex.get("type") != "weight_reps":
        return None
    if eq == "dumbbell":
        return "dumbbell"
    if eq == "kettlebell":
        return "kettlebell"
    if eq == "barbell":
        return None if ("ez bar" in name or "landmine" in name) else "barbell"
    if eq == "machine":
        return "cable"  # every machine left after home_gym_catalog() is the cable crossover
    return None


def _plates_on(kind: str, weight: float) -> float:
    if kind == "barbell":
        return max(weight - BARBELL_LB, 0.0)
    return weight if kind == "cable" else 0.0


def load_problems(
    exercises: list["ExercisePrescription"], catalog_by_id: dict[str, dict[str, Any]]
) -> list[str]:
    """Loads the basement can't make, in words the coach can act on."""
    problems = []
    for ex in exercises:
        entry = catalog_by_id.get(ex.exercise_id)
        if entry is None or ex.weight_lb is None:
            continue
        kind, w = load_kind(entry), float(ex.weight_lb)
        if kind == "dumbbell" and w not in DUMBBELLS_LB:
            problems.append(
                f"{ex.exercise_name} at {w:g} lb: dumbbells are 5 to 40 lb in 5 lb steps only "
                "(at 40 lb, progress with reps, tempo or a harder variation)"
            )
        elif kind == "kettlebell" and w not in KETTLEBELLS_LB:
            problems.append(f"{ex.exercise_name} at {w:g} lb: the kettlebells are 35 and 45 lb only")
        elif kind == "barbell" and w not in BARBELL_LOADS:
            problems.append(
                f"{ex.exercise_name} at {w:g} lb: a 45 lb bar plus matching plate pairs makes "
                f"5 lb steps from 45 to {BARBELL_LOADS[-1]:g} lb"
            )
        elif kind == "cable" and w not in CABLE_LOADS:
            problems.append(
                f"{ex.exercise_name} at {w:g} lb: cable weight is plates on the pin, "
                f"2.5 lb steps up to {PLATE_TOTAL_LB:g} lb"
            )

    # Alternating sets keep both movements loaded at once, and the plates are shared.
    groups: dict[int, list["ExercisePrescription"]] = {}
    for ex in exercises:
        if ex.superset_group is not None:
            groups.setdefault(ex.superset_group, []).append(ex)
    for members in groups.values():
        loaded = []
        for ex in members:
            entry = catalog_by_id.get(ex.exercise_id)
            kind = load_kind(entry) if entry else None
            if kind and ex.weight_lb:
                plates = _plates_on(kind, float(ex.weight_lb))
                if plates:
                    loaded.append((ex.exercise_name, plates))
        total = sum(p for _, p in loaded)
        if len(loaded) > 1 and total > PLATE_TOTAL_LB:
            names = " + ".join(f"{n} ({p:g} lb of plates)" for n, p in loaded)
            problems.append(
                f"superset {names} needs {total:g} lb of plates at once, but there are only "
                f"{PLATE_TOTAL_LB:g} lb: pair one of them with dumbbells, kettlebells, bands or bodyweight"
            )
    return problems


def snap_free_weights(
    exercises: list["ExercisePrescription"], catalog_by_id: dict[str, dict[str, Any]]
) -> list[str]:
    """Last resort after the coach's one revision: move an impossible
    dumbbell or kettlebell load to the nearest one that exists, rounding
    down on a tie. Returns what changed."""
    changed = []
    for ex in exercises:
        entry = catalog_by_id.get(ex.exercise_id)
        if entry is None or ex.weight_lb is None:
            continue
        options = {"dumbbell": DUMBBELLS_LB, "kettlebell": KETTLEBELLS_LB}.get(load_kind(entry) or "")
        if not options or ex.weight_lb in options:
            continue
        new = min(options, key=lambda o: (abs(o - ex.weight_lb), o))
        changed.append(f"{ex.exercise_name}: {ex.weight_lb:g} lb -> {new:g} lb (nearest one you own)")
        ex.weight_lb = new
    return changed


assert 195.0 in BARBELL_LOADS and 280.0 == BARBELL_LOADS[-1]
assert 185.0 in CABLE_LOADS and 27.5 not in DUMBBELLS_LB
