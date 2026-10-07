# ADR 0006: Goal-first lift sessions for the home gym, and a separate fingerboard session

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

Cody's answers (2026-10-07):
- Equipment: dumbbells 5-40 lb in 5 lb steps; Mikolo power cage with a plate-loaded cable crossover and every attachment; plates 2x45, 4x25, 2x10, 4x5, 2x2.5; barbell, EZ bar, landmine, 35 and 45 lb kettlebells; an adjustable bench (never for pressing); bands for PT and pull-up assistance.
- Pull-ups are still band-assisted.
- No single-leg work of any kind.
- Exercise choice is free; the coach decides whether to repeat, but must justify it.
- Priority is seasonal, with arms every session.
- How often he lifts varies.
- Cable upright rows and Y-raises are part of his shoulder PT and stay allowed.

A first version forced variety (at most 2 repeats). In a live preview the coach then shopped the equipment list instead of choosing the best lift for each goal, so that rule was dropped before shipping.

## Decision

1. **Goal-first selection.** The coach lists today's `priorities`: 2-4 goals in order, from a code-computed `season_focus`, `muscle_last_trained`, `muscle_sets_last_14d`, recovery, and whether he climbs later today. It then picks the most effective exercise per priority. Every exercise carries `goal` and `why`, including why it was kept or replaced. Equipment is a constraint, not a menu, and missing history is never a reason to skip the best exercise.
2. **Home-gym catalog** (`lift_equipment.py`). The coach only sees exercises the basement allows. Machines, Smith, suspension and the ab wheel are removed by name, because Hevy tags pull-ups and cables as "machine" too. Single-leg exercises are removed the same way. Anything outside the catalog is rejected by the existing unknown-exercise check.
3. **Plan review** (`lift_review.py`). This is not a safety guard. It flags:
   - loads the inventory can't make (dumbbell steps, kettlebells, bar and pin plate maths, plates shared in a superset);
   - added load after an RPE 9.5-10 set;
   - a missing goal or why;
   - a priority with no exercise serving it;
   - climbing as a priority without a pull-up, chin-up or lock-off;
   - missing arm work.

   Problems go back to the coach for **one revision** in the same conversation. Impossible dumbbell or kettlebell loads left after that are moved to the nearest one he owns; anything else is shown in `flags_considered`.
4. **Payload additions**: a 21-day history, `last_lift_session`, `muscle_sets_last_14d`, `muscle_last_trained`, `season_focus`, `added_by_athlete` plus `athlete_added_exercises`, and `equipment`.
5. **Fingerboard is its own session** (`session_type: fingerboard`). It has its own prompt (`prompts/fingerboard_system.md`), Hevy routine ("Next Fingerboard Session"), output files, `sensor.fingerboard_session_latest`, push automation, and a Fingerboard card on the Coach panel that holds the finger flag. The phase ramp, limits and `assert_fingerboard_safe` are unchanged. If the board is off today, no Claude call runs and an alert email says why. Lift sessions never get board exercises; a short `fingerboard_summary` lets grip work respect a recent board day.

## Consequences

- A heavy session can cost two Claude calls when the first misses a rule.
- The inventory is code. New equipment means editing `HOME_GYM`, the plate
  table and possibly `_NOT_AT_HOME`.
- Cable upright rows and Y-raises are deliberately allowed (shoulder PT).
- The Coach panel shows the priorities under "Why this session".
