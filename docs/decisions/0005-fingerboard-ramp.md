# ADR 0005: Fingerboard ramp inside the lift coach

- **Status:** Accepted, amended by [ADR 0006](0006-lift-coach-variety-home-gym-separate-fingerboard.md) (board work is now its own session)
- **Date:** 2026-10-05
- **Deciders:** Cody
- **Tags:** garmin-coaching-report, lift-session, hevy, climbing

## Context

Cody started doing the coach's Dead Hangs on a Beastmaker 1000 and wanted
fingerboard training in Hevy, with a long, gradual ramp-up. Interview answers
(2026-10-05): has dabbled but never followed a program, no finger or elbow
injuries, climbs about V3 / 5.10, goal is durable fingers rather than a
grade, can unload with feet on a chair and add weight with a belt, hangs are
fine for the left shoulder only with the shoulders engaged, and board work
should live inside the lift sessions.

## Decision

1. **Holds are named by board location, never by depth.** Beastmaker
   doesn't publish depths, and measured numbers disagree. The map in
   `lift_fingerboard.BOARD_MAP` follows Cody's numbered Beastmaker 1000
   chart (#1-#9), checked against Beastmaker's hold list and product photo.
   The plan uses #3 (Middle Row Outside) and #7 (Bottom Row Outside).
2. **One custom Hevy exercise per hold and grip** (`weight_duration`, created
   via `POST /v1/exercise_templates`): "BM1000 Middle Row Outside" and
   "BM1000 Bottom Row Outside", each as Half Crimp and Open Hand. They're
   resolved by exact title. Any other hangboard/fingerboard/campus exercise is
   never prescribable.
3. **Phases are gated by the athlete, not the coach.** Phase 1 tissue prep
   (Middle Row Outside, feet-assisted 10s on / 20s off cycles), phase 2
   repeaters (7s on / 3s off), phase 3 10s hangs with added weight. The
   current phase lives in `reports/fingerboard_state.json`. The coach only
   flags "gate looks met", and the file is changed by hand once Cody confirms.
4. **Hard limits are enforced in code** (`assert_fingerboard_safe`), as the
   shoulder denylist is: holds per phase, total board sets (halved every 4th
   ramp week), seconds per set, minimum RIR, added weight only in phase 3 and
   at most 2.5 lb over the best logged, at most 2 board days in 7, and none
   while the finger flag is on. The same numbers go to the coach as
   `fingerboard.limits`, so a violation is a coach bug, not a guess.
5. **Finger flag** (`input_boolean.lift_finger_flag`, Coach panel toggle)
   works like the shoulder flag: multi-day, cleared by hand.
6. **All hangs are active.** The prompt bans "passive/decompression" cues.

## Consequences

- A guard violation discards the whole session (no silent fix-ups), the
  same as the shoulder guard.
- Feet assistance can't be quantified in Hevy (no assisted-duration type), so
  it lives in the exercise notes as feet heavy / light / off.
- The mountain report is untouched. It already sees board sets through the
  Hevy strength log.
