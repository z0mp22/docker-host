# ADR 0012: Fingerboard sessions from rules, not Claude

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Cody
- **Tags:** garmin-coaching-report, lift-session, fingerboard, hevy

## Context

Since ADR 0006 a fingerboard session was one Claude call (sometimes two, when
the review sent it back) with a 70-line prompt. Nearly all of that prompt was
rules the code already enforced: the phase sets the hold, hang time, rest and
effort; `limits_for()` sets the caps; the warm-up never changes. Claude was
left choosing feet assist and set count, from a hang history that carries no
RPE (Hevy doesn't record RPE on timed sets). A run cost about 25k input
tokens for a session that should come out the same every time from the same
inputs.

## Decision

`coaching_report/lift_fingerboard_plan.py` plans the session. Each phase has a
ladder of steps, easiest first, and each step changes one thing (feet assist,
rounds, hold, or added weight). Phase 1: feet heavy 2 rounds, light 2, light
3, off 2, off 3.

- Two easy sessions in a row at one step: up one. An easy session is every
  set done at full time, no logged RPE above 7, and no "hard" in that day's
  feedback.
- A hard or unfinished session, finger/elbow/wrist pain in the feedback log,
  or more than 14 days off the board: back one.
- Otherwise, or when the last session isn't logged yet: the same step.
- Today-only cuts that don't move the ladder (saved as `reduced`, not counted
  toward stepping up): a deload week halves the rounds; a hard climb in the
  last 24 h, or Tue/Thu before 1 pm (the lunch climb), drops to the phase's
  lowest rounds; the shoulder flag puts more weight on the feet.
- Each saved session stores its `progression` in
  `fingerboard-session-<date>.meta.json`, and the next plan reads it back.
- The phase still moves only when Cody confirms a gate. The rules flag "phase
  N gate looks met" the same way the prompt did.

The plan goes through the same `assert_fingerboard_safe`, catalog safety and
review checks as before. A failure there is a bug in the rules and writes
nothing. `DRY_RUN` now prints the plan instead of skipping it.

## Consequences

- No Anthropic call or prompt for board sessions; `prompts/fingerboard_system.md` is gone.
- The same history always gives the same session, and the reason for a
  change is one sentence in the rationale (which is also the phone push).
- The ladder is the coach now. A change to how the ramp progresses is a code
  change in `LADDERS` / `choose_step`, with tests.
