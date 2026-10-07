"""Entrypoint for one on-demand lift-session generation, or a standalone
feedback-log submission.

Invoked via `docker run --entrypoint python garmin-coaching-report:local -m
coaching_report.lift_main`, triggered by run-lift-session.sh -- session-by-
session, no fixed cadence, unlike main.py's weekly cron. Does not import or
call anything from main.py/coach.py; the two pipelines are independent all
the way down (separate lock files, separate GitHub Actions concurrency
groups, separate alert-email subjects) so a Hevy outage or a lift-session bug
can never affect the mountain report and vice versa.
"""

import os
import sys
import traceback
from datetime import date

from .config import load_app_config
from .emailer import save_lift_outputs, send_alert_email
from .errors import (
    AuthExpiredError,
    CoachingReportError,
    EmailError,
    FingerboardBlockedError,
    LiftPlanError,
    UnknownExerciseError,
    UnsafeExerciseError,
)
from .garmin_auth import connect_with_tokens
from .lift_coach import generate_lift_session
from .lift_collector import build_fingerboard_payload, build_lift_payload, last_lift_session
from .lift_equipment import home_gym_catalog, snap_free_weights
from .lift_feedback import append_feedback
from .lift_fingerboard import assert_fingerboard_safe, without_board_exercises
from .lift_review import review_plan
from .lift_safety import assert_session_plan_safe, resolve_banned_exercise_ids
from .hevy_client import HevyClient

SESSION_TYPES = ("heavy_1h", "light_30m", "shoulder_pt", "fingerboard")
DEFAULT_SESSION_TYPE = "heavy_1h"


def main() -> int:
    try:
        config = load_app_config()
    except ValueError as exc:
        print(f"[lift-session] Configuration error: {exc}", file=sys.stderr)
        return 1

    feedback_only = os.environ.get("LIFT_FEEDBACK_ONLY", "").strip().lower() in ("1", "true", "yes")
    feedback_text = os.environ.get("LIFT_FEEDBACK_TEXT", "").strip()

    if feedback_only:
        # No Garmin/Hevy/Claude needed at all -- just append to the
        # persistent log so future generations see it as standing context.
        if not feedback_text:
            print("[lift-session] LIFT_FEEDBACK_ONLY set but LIFT_FEEDBACK_TEXT is empty", file=sys.stderr)
            return 1
        append_feedback(config.report_output_dir, feedback_text)
        print(f"[lift-session] feedback logged: {feedback_text!r}", file=sys.stderr)
        return 0

    if not config.hevy_api_key:
        print(
            "[lift-session] HEVY_API_KEY is required "
            "(set it in garmin-coaching-report/.env)",
            file=sys.stderr,
        )
        return 1

    session_type = os.environ.get("LIFT_SESSION_TYPE", "").strip() or DEFAULT_SESSION_TYPE
    if session_type not in SESSION_TYPES:
        print(
            f"[lift-session] Invalid LIFT_SESSION_TYPE {session_type!r}, "
            f"must be one of {SESSION_TYPES}; using {DEFAULT_SESSION_TYPE}",
            file=sys.stderr,
        )
        session_type = DEFAULT_SESSION_TYPE
    shoulder_flag = os.environ.get("LIFT_SHOULDER_FLAG", "").strip().lower() in ("1", "true", "yes")
    finger_flag = os.environ.get("LIFT_FINGER_FLAG", "").strip().lower() in ("1", "true", "yes")
    dry_run = os.environ.get("DRY_RUN", "").strip().lower() in ("1", "true", "yes")
    session_date = date.today()

    try:
        garmin_client = connect_with_tokens(config.garmin)
    except AuthExpiredError as exc:
        print(f"[lift-session] {exc}", file=sys.stderr)
        _try_alert(config, f"Lift Session — Garmin Authentication Required\n\n{exc}")
        return 1

    try:
        hevy_client = HevyClient(config.hevy_api_key)
        full_catalog = hevy_client.get_exercise_catalog()
        banned_ids = resolve_banned_exercise_ids(full_catalog)

        print(
            f"[lift-session] catalog: {len(full_catalog)} strength exercises, "
            f"{len(banned_ids)} banned by the safety guard",
            file=sys.stderr,
        )
        for ex_id, name in sorted(banned_ids.items(), key=lambda kv: kv[1]):
            print(f"[lift-session]   banned: {name} (id={ex_id})", file=sys.stderr)

        if session_type == "fingerboard":
            return _run_fingerboard(
                config, garmin_client, hevy_client, full_catalog, banned_ids,
                shoulder_flag, finger_flag, session_date, dry_run,
            )

        lift_catalog, dropped = home_gym_catalog(without_board_exercises(full_catalog))
        catalog_by_id = {ex["id"]: ex for ex in lift_catalog}
        print(
            f"[lift-session] home gym: {len(lift_catalog)} exercises usable, {len(dropped)} dropped "
            f"({sum(1 for r in dropped.values() if r == 'single-leg')} single-leg)",
            file=sys.stderr,
        )

        payload = build_lift_payload(
            garmin_client, hevy_client, config, lift_catalog, session_type, shoulder_flag, session_date,
            finger_flag=finger_flag, full_catalog=full_catalog,
        )
        last = last_lift_session(payload["recent_lift_sessions"])
        last_ids = [ex["exercise_id"] for ex in last["exercises"]] if last else []
        print(
            f"[lift-session] {session_date.isoformat()} type={session_type} — "
            f"{len(payload['recent_lift_sessions'])} recent Hevy workouts, "
            f"{len(payload['recent_mountain_activity'])} mountain-sports activities this week, "
            f"{len(payload['recent_feedback'])} feedback log entries, "
            f"{len(payload['athlete_added_exercises'])} athlete-added exercises, "
            f"last lift session {last['date'] if last else 'none'}, "
            f"shoulder_flag={shoulder_flag}, finger_flag={finger_flag}",
            file=sys.stderr,
        )

        if dry_run:
            print(
                "[lift-session] DRY_RUN: payload + safety-guard catalog validated; "
                "skipping Claude call and Hevy write",
                file=sys.stderr,
            )
            return 0

        plan, model_meta = _generate(config, payload)
        # Defense-in-depth: re-check Claude's actual output against the live
        # catalog and the denylist, strictly before any Hevy write. On a
        # violation this raises and nothing below runs -- no partial write,
        # no silent substitution.
        assert_session_plan_safe(plan.exercises, catalog_by_id, banned_ids)

        problems = review_plan(plan.exercises, session_type, catalog_by_id, last_ids)
        if problems:
            for p in problems:
                print(f"[lift-session] review: {p}", file=sys.stderr)
            plan, meta2 = _generate(config, payload, revise=(plan, problems))
            assert_session_plan_safe(plan.exercises, catalog_by_id, banned_ids)
            model_meta = {
                **meta2,
                "input_tokens": model_meta["input_tokens"] + meta2["input_tokens"],
                "output_tokens": model_meta["output_tokens"] + meta2["output_tokens"],
                "revised_for": problems,
            }
            for change in snap_free_weights(plan.exercises, catalog_by_id):
                plan.flags_considered.append(f"Load adjusted after generation: {change}")
            for p in review_plan(plan.exercises, session_type, catalog_by_id, last_ids):
                print(f"[lift-session] review still failing after revision: {p}", file=sys.stderr)
                plan.flags_considered.append(f"Coach check not met: {p}")

        routine_id = hevy_client.upsert_session_routine(
            plan, config.hevy_routine_title, session_type
        )

        # No email for individual sessions (decision: HA + Hevy only --
        # email stays reserved for the weekly mountain report). save_lift_outputs
        # still writes the local .md/.meta.json and lift_session_latest.json,
        # which is what feeds the HA sensor/notification.
        save_lift_outputs(config, session_date, plan, model_meta, routine_id, session_type)
        print(
            f"[lift-session] wrote Hevy routine {config.hevy_routine_title!r} id={routine_id}",
            file=sys.stderr,
        )
        return 0

    except FingerboardBlockedError as exc:
        print(f"[lift-session] {exc}", file=sys.stderr)
        _try_alert(config, f"Fingerboard session not generated\n\n{exc}")
        return 1
    except (UnsafeExerciseError, UnknownExerciseError) as exc:
        print(f"[lift-session] {exc}", file=sys.stderr)
        _try_alert(config, f"Lift Session — Unsafe Exercise Blocked\n\n{exc}")
        return 1
    except CoachingReportError as exc:
        # Covers HevyError, LiftPlanError, and anything else in this
        # pipeline's typed-error hierarchy not already handled above.
        # Failures still alert by email -- HA only learns about successful
        # generations (see automations.yaml), so email is the only signal
        # for a failure unless someone's watching the Actions run itself.
        print(f"[lift-session] {exc}", file=sys.stderr)
        _try_alert(config, f"Lift session failed: {exc}")
        return 1
    except Exception as exc:
        print(f"[lift-session] Unexpected error: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        _try_alert(config, f"Lift session failed unexpectedly:\n\n{exc}")
        return 1


def _generate(config, payload, revise=None):
    return generate_lift_session(
        payload,
        api_key=config.anthropic_api_key,
        model=config.anthropic_model,
        max_output_tokens=config.max_output_tokens,
        revise=revise,
    )


def _run_fingerboard(
    config, garmin_client, hevy_client, full_catalog, banned_ids,
    shoulder_flag, finger_flag, session_date, dry_run,
) -> int:
    """A board-only session, written to its own Hevy routine. Raises
    FingerboardBlockedError (no Claude call at all) when the board is off
    today: finger flag on, or already two board days this week."""
    payload = build_fingerboard_payload(
        garmin_client, hevy_client, config, full_catalog, shoulder_flag, finger_flag, session_date
    )
    fb = payload["fingerboard"]
    print(
        f"[lift-session] fingerboard: phase {fb['phase']} ({fb['phase_name']}), "
        f"ramp week {fb['ramp_week']}, deload={fb['deload_week']}, "
        f"{len(fb['plan_exercises'])} BM1000 exercises in catalog, "
        f"{len(fb['history'])} logged sets in 8 weeks, "
        f"{fb['board_days_last_7d']} board days in last 7, "
        f"hours since climb={fb['hours_since_last_climb']}, "
        f"{len(payload['exercise_catalog'])} exercises usable",
        file=sys.stderr,
    )
    if not fb["limits"]["board_allowed_today"]:
        raise FingerboardBlockedError(
            f"The board is off today: {fb['limits']['blocked_reason']}. Nothing was written to Hevy."
        )
    if dry_run:
        print("[lift-session] DRY_RUN: fingerboard payload validated; skipping Claude call and Hevy write",
              file=sys.stderr)
        return 0

    plan, model_meta = _generate(config, payload)
    catalog_by_id = {ex["id"]: ex for ex in payload["exercise_catalog"]}
    assert_session_plan_safe(plan.exercises, catalog_by_id, banned_ids)
    assert_fingerboard_safe(plan.exercises, full_catalog, fb)
    plan_ids = {ex["id"] for ex in fb["plan_exercises"]}
    if not any(ex.exercise_id in plan_ids for ex in plan.exercises):
        raise LiftPlanError("Fingerboard session came back with no board exercise")
    for change in snap_free_weights(plan.exercises, catalog_by_id):
        plan.flags_considered.append(f"Load adjusted after generation: {change}")

    routine_id = hevy_client.upsert_session_routine(
        plan, config.hevy_fingerboard_routine_title, "fingerboard"
    )
    save_lift_outputs(
        config, session_date, plan, model_meta, routine_id, "fingerboard",
        extra_meta={"fingerboard": {k: fb[k] for k in (
            "phase", "phase_name", "phase_started", "weeks_in_phase", "ramp_week",
            "deload_week", "board_days_last_7d",
        )}},
    )
    print(
        f"[lift-session] wrote Hevy routine {config.hevy_fingerboard_routine_title!r} id={routine_id}",
        file=sys.stderr,
    )
    return 0


def _try_alert(config, body: str) -> None:
    try:
        send_alert_email(config, "Lift Session — Error", body)
    except EmailError:
        pass


if __name__ == "__main__":
    sys.exit(main())
