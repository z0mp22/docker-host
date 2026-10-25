# ADR 0011: Back-safety limits on deadlifts and other barbell hinges

- **Status:** Accepted
- **Date:** 2026-10-25
- **Deciders:** Cody
- **Tags:** garmin-coaching-report, lift-session, hevy

## Context

Cody (42, desk job) was worried about adding weight to his deadlift every
year: friends his age are having disc problems and have given up deadlifts.
The disc injuries that come from deadlifting are mostly from loaded spinal
flexion under fatigue: max singles, grinding reps, and long sets where the
back rounds a little more each rep. Load matters, but effort and reps matter
as much. None of his goals (climbing, MTB, snowboard, physique) needs a
deadlift past about 1.5x bodyweight. At the time he was pulling 205 lb x 5
at about 180 lb bodyweight.

The coach already refused to add load after an RPE 9.5+ set. That catches a
grinder only after it has happened.

## Decision

For every barbell hinge (Deadlift, Sumo Deadlift, Rack Pull, Romanian
Deadlift, Straight Leg Deadlift, Good Morning; not Deadlift High Pull):

- Ceiling: 1.5x the latest Hevy bodyweight, rounded down to 5 lb. If no
  bodyweight is logged, the 180 lb profile is used (270 lb).
- Every working set at RIR 2 or more.
- 3-6 reps for floor and pin pulls, 3-10 for RDLs, straight-leg deadlifts
  and good mornings.
- No added load after a top set harder than RPE 8 (unrated sets don't block).
- Near the ceiling, the coach progresses reps and moves extra volume to RDLs,
  pin pulls and cable pull-throughs (prompt guidance only).

The payload carries `hinge_limits`, and `prompts/lift_system.md` explains
why the limits exist. `lift_review.hinge_problems` sends any violation to the
one revision call. After that, `enforce_hinge_limits` clamps whatever is
left: load is cut to the limit, warm-ups at or above it are dropped, RIR is
raised to 2 and reps are moved into range. Each change is noted in
flags_considered. The session is still written to Hevy rather than thrown
away, because every fix makes it more conservative.

## Consequences

- Deadlift progress at 180 lb stops at 270 lb. The bar's 280 lb plate limit
  was the only cap before.
- If Cody logs a bodyweight in Hevy, the ceiling follows it.
- When a clamp happens, summary_text can still show the pre-clamp number.
  Hevy and flags_considered show the real one. This is the same limitation
  as `snap_free_weights`.
- Live preview on 2026-10-25 (snow-season focus, deadlift requested):
  Deadlift 4x5 @ 210 lb, RIR 2, with the stop cue in the notes. No revision
  or clamp was needed.
