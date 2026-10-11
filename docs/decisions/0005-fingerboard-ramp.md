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

## Amendment 2026-10-11: one hang per Hevy set, warm-up as its own exercise

Cody found the first board session hard to follow at the board: one 60s
"set" stood for 6 × 10s on / 20s off, and the warm-up and cues were long
paragraphs in the notes. So:

- **Each Hevy set is one hang with its own target time.** Phase 1 is 6 sets
  of 10s per round (rest timer 20s), 2-3 rounds; the note says where the
  2-minute round break is. The limits are `max_rounds × sets_per_round` (18
  hangs in phase 1, halved by round on a deload week). Phases 2 and 3 keep one
  set per round: a 6 × 7s/3s repeater can't be split, and phase 3 is already
  single hangs. History logged before this date reads phase 1 sets as rounds.
- **The warm-up is its own custom exercise, "BM1000 Warm-up"** (type
  `duration`, created 2026-10-11): goal `warmup`, so `hevy_client` writes
  every set as a warm-up set. Jugs, then easy feet-assisted pulls on the plan
  hold. At most 8 sets of 15s, never weighted, off when the board is off; it
  never counts toward the board limit.
- **Text is short and checked.** Notes are one line under 140 characters and
  summary_text is under 500. A longer one, or a session without the warm-up,
  goes back to the coach for one revision (`lift_review.fingerboard_problems`).
  The Coach panel's Fingerboard card draws the session from the new `blocks`
  attribute as one chip per set, grouped into rounds.
- **Exercise names must match their Hevy id** for every session type. Hevy
  shows the template behind the id, so a mismatch would show a different
  exercise from the one the plan names. A mismatch is revised once, then refused.
