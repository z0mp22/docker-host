# ADR 0006: Lift sessions that vary, fit the home gym, and a separate fingerboard session

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Cody
- **Tags:** garmin-coaching-report, lift-session, hevy, climbing
- **Amends:** [ADR 0005](0005-fingerboard-ramp.md) (board work no longer lives inside lift sessions)

## Context

The 2026-10-07 heavy session repeated Monday's lifts with new numbers (third
near-identical session in a row) and prescribed a 27.5 lb dumbbell that
doesn't exist. It also missed "Add vanity lifts" in the feedback log, which
Cody had asked for twice, and dropped every lift he had added himself (cable
fly, EZ-bar curl, lateral raise). It never prescribed pull-ups or lock-offs,
which the mountain report names as his climbing weaknesses. Causes: the prompt
made prescribed-vs-actual the main signal (which rewards re-prescribing the
same exercises), there was no equipment inventory, the lift prompt didn't
know the mountain goals or season, and nothing checked any of this.

Cody's answers (2026-10-07): dumbbells 5-40 lb in 5 lb steps; Mikolo power
cage with plate-loaded cable crossover; plates 2x45, 4x25, 2x10, 4x5, 2x2.5;
barbell, EZ bar, landmine, 35 and 45 lb kettlebells; no single-leg work of
any kind; sessions weighted to upper body; free choice of exercises rather
than a fixed split; vanity work researched for arms first, then shoulders and
chest; fingerboard as its own session with its own plan and HA tile.

## Decision

1. **Home-gym catalog** (`lift_equipment.py`). The coach only sees exercises
   the basement can do: machines, Smith, benches, suspension and the like are
   removed by name (Hevy tags pull-ups and cables as "machine" too, so
   equipment tags can't be used). Single-leg exercises are removed the same
   way. Anything outside the catalog is rejected by the existing
   unknown-exercise check.
2. **Plan review** (`lift_review.py`), not a safety guard. It flags loads the
   inventory can't make (dumbbell steps, kettlebells, bar and pin plate maths,
   shared plates in a superset), more than 2 repeats from the last lift
   session (timed holds exempt), legs above 40% of working sets, and missing
   arm work (heavy: biceps and triceps; light: one arm movement). Problems go
   back to the coach for **one revision** in the same conversation. Dumbbell
   and kettlebell loads still impossible after that are moved to the nearest
   owned weight; anything else left is shown in `flags_considered`.
3. **Payload for variety**: a 21-day history window, `last_lift_session`,
   `muscle_sets_last_14d`, `added_by_athlete` per exercise plus
   `athlete_added_exercises`, and the `equipment` inventory.
4. **Prompt**: climbing weaknesses, seasonal leg focus (strength through
   October, endurance from November), an upper-body ratio, a vanity block
   with researched exercise choices and shoulder-safe lateral-raise cues, plus
   a rule on reading feedback tense ("added in X" reports what he did, "add X"
   asks for it).
5. **Fingerboard is its own session** (`session_type: fingerboard`): its own
   prompt (`prompts/fingerboard_system.md`), Hevy routine ("Next Fingerboard
   Session"), output files and `sensor.fingerboard_session_latest`, push
   automation, and a Fingerboard card on the Coach panel that holds the finger
   flag. The phase ramp, limits and `assert_fingerboard_safe` are unchanged.
   If the board is off today, no Claude call runs, and an alert email says
   why. Lift sessions never get board exercises; they get a short
   `fingerboard_summary` so grip work respects a recent board day.

## Consequences

- A heavy session can cost two Claude calls when the first misses a rule.
- The inventory is code. New equipment means editing `HOME_GYM`, the plate
  table and possibly `_NOT_AT_HOME`.
- Upright rows, Y-raises and Turkish get-ups are steered away in the prompt,
  not banned in code; adding them to the shoulder denylist is still open.
