# ADR 0003: Lift coach moves from self-hosted wger to Hevy

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Cody
- **Tags:** garmin-coaching-report, lift-session, hevy, wger

## Context

The autoregulated lift coach (`garmin-coaching-report/coaching_report/lift_*`,
triggered by the `Run Lift Session` workflow from HA) was built on 2026-09-19
against a self-hosted wger stack (Postgres + PowerSync + nginx + Watchtower).
It worked, but wger's mobile app is unpleasant to log in and the project
looks to be going stale. Hevy was the runner-up when wger was picked: a
polished app, with a public REST API for Hevy Pro accounts (annual plan
≈ $2/mo).

## Decision

1. **Hevy replaces wger** as the app the coach writes to and reads from.
   The goals, the three session types, the shoulder flag, the feedback log,
   the code-level safety guard and dry runs are unchanged.
2. **One reused routine**, `Next Lift Session` (`HEVY_ROUTINE_TITLE`). It's
   found by title and overwritten on every generation. Hevy's API has no
   routine delete, so one routine per session would pile up.
3. **Prescriptions are snapshotted locally.** Overwriting loses history, so
   every generation appends its structured plan to
   `/docker/garmin-coaching-report/reports/lift_prescriptions.jsonl`.
   `lift_collector.py` joins each logged workout back to the latest
   snapshot written before it started, to give the coach prescribed vs
   actual.
4. **Units and effort:** the coach picks weights in lb (`weight_lb`), and
   the client converts to Hevy's kg-only API. RIR targets are limited to the
   values that map to Hevy's RPE picker (RIR 0–3 in 0.5 steps, plus 4) and
   are written into the exercise notes, because Hevy routines have no
   target-RPE field. Logged RPE is read back as RIR = 10 − RPE.
5. **Mountain report:** `strength_training_log` is now sourced from Hevy.
   It stays best-effort: an outage or a lapsed Pro subscription drops the
   section instead of failing the report.
6. **wger is parked, not removed.** `deploy.sh:deploy_wger` stops the stack
   unless `WGER_ENABLED=1`, and the PowerSync compaction cron is removed.
   Containers, `/docker/wger/*` data (Postgres ≈ 128 MB), `wger/` compose
   config and the `WGER_*` lines in the host `.env` are all kept.

## Failback to wger

1. `git revert` the Hevy migration commit(s), or restore the lift-coach
   files from tag `lift-wger-final`.
2. Deploy with `WGER_ENABLED=1` (export it in the deploy workflow env, or
   run `WGER_ENABLED=1 scripts/deploy.sh` on the host).
   `cd /docker/wger && docker compose start` alone brings the old data back
   up immediately.

## Consequences

- Hevy's API is labelled "use at your own risk" and may change. Errors
  surface as `HevyError` alerts for lift sessions and as a missing section
  in the mountain report.
- The athlete should keep Hevy in **lb**, turn on **RPE** logging, and
  start workouts from the `Next Lift Session` routine. Workouts logged
  freestyle still count but have no prescription to compare against.
- The shoulder-safety denylist was re-verified against Hevy's catalog.
  53 of 452 templates are banned, including new word rules for
  snatch/jerk/thruster and five hand-pinned template ids.
