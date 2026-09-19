"""Entrypoint for one on-demand lift-session generation.

Invoked via `docker run --entrypoint python garmin-coaching-report:local -m
coaching_report.lift_main`, triggered by run-lift-session.sh -- session-by-
session, no fixed cadence, unlike main.py's weekly cron. Does not import or
call anything from main.py/coach.py; the two pipelines are independent all
the way down (separate lock files, separate GitHub Actions concurrency
groups, separate alert-email subjects) so a wger outage or a lift-session bug
can never affect the mountain report and vice versa.
"""

import os
import sys
import traceback
from datetime import date

from .config import load_app_config
from .emailer import save_lift_outputs, send_alert_email, send_lift_summary_email
from .errors import (
    AuthExpiredError,
    CoachingReportError,
    EmailError,
    UnknownExerciseError,
    UnsafeExerciseError,
)
from .garmin_auth import connect_with_tokens
from .lift_coach import generate_lift_session
from .lift_collector import build_lift_payload
from .lift_safety import assert_session_plan_safe, resolve_banned_exercise_ids
from .wger_client import WgerClient


def main() -> int:
    try:
        config = load_app_config()
    except ValueError as exc:
        print(f"[lift-session] Configuration error: {exc}", file=sys.stderr)
        return 1

    if not config.wger_url or not config.wger_api_token:
        print(
            "[lift-session] WGER_URL and WGER_API_TOKEN are required "
            "(set them in garmin-coaching-report/.env)",
            file=sys.stderr,
        )
        return 1

    shoulder_flag = os.environ.get("LIFT_SHOULDER_FLAG", "").strip().lower() in ("1", "true", "yes")
    note = os.environ.get("LIFT_NOTE", "").strip()
    dry_run = os.environ.get("DRY_RUN", "").strip().lower() in ("1", "true", "yes")
    session_date = date.today()

    try:
        garmin_client = connect_with_tokens(config.garmin)
    except AuthExpiredError as exc:
        print(f"[lift-session] {exc}", file=sys.stderr)
        _try_alert(config, f"Lift Session — Garmin Authentication Required\n\n{exc}")
        return 1

    try:
        wger_client = WgerClient(config.wger_url, config.wger_api_token)
        catalog = wger_client.get_exercise_catalog()
        catalog_by_id = {ex["id"]: ex for ex in catalog}
        banned_ids = resolve_banned_exercise_ids(catalog)

        print(
            f"[lift-session] catalog: {len(catalog)} strength exercises, "
            f"{len(banned_ids)} banned by the safety guard",
            file=sys.stderr,
        )
        for ex_id, name in sorted(banned_ids.items(), key=lambda kv: kv[1]):
            print(f"[lift-session]   banned: {name} (id={ex_id})", file=sys.stderr)

        payload = build_lift_payload(
            garmin_client, wger_client, config, catalog, shoulder_flag, note, session_date
        )
        print(
            f"[lift-session] {session_date.isoformat()} — "
            f"{len(payload['wger_recent_sessions'])} recent wger sessions, "
            f"{len(payload['recent_mountain_activity'])} mountain-sports activities this week, "
            f"shoulder_flag={shoulder_flag} note={note!r}",
            file=sys.stderr,
        )

        if dry_run:
            print(
                "[lift-session] DRY_RUN: payload + safety-guard catalog validated; "
                "skipping Claude call and wger write",
                file=sys.stderr,
            )
            return 0

        plan, model_meta = generate_lift_session(
            payload,
            api_key=config.anthropic_api_key,
            model=config.anthropic_model,
            max_output_tokens=config.max_output_tokens,
        )

        # Defense-in-depth: re-check Claude's actual output against the live
        # catalog and the denylist, strictly before any wger write. On a
        # violation this raises and nothing below runs -- no partial write,
        # no silent substitution.
        assert_session_plan_safe(plan.exercises, catalog_by_id, banned_ids)

        routine_id = wger_client.create_session(plan)

        save_lift_outputs(config, session_date, plan, model_meta, routine_id)
        send_lift_summary_email(config, session_date, plan)
        print(f"[lift-session] wrote wger routine id={routine_id}", file=sys.stderr)
        return 0

    except (UnsafeExerciseError, UnknownExerciseError) as exc:
        print(f"[lift-session] {exc}", file=sys.stderr)
        _try_alert(config, f"Lift Session — Unsafe Exercise Blocked\n\n{exc}")
        return 1
    except CoachingReportError as exc:
        # Covers WgerError, LiftPlanError, and anything else in this
        # pipeline's typed-error hierarchy not already handled above.
        print(f"[lift-session] {exc}", file=sys.stderr)
        _try_alert(config, f"Lift session failed: {exc}")
        return 1
    except Exception as exc:
        print(f"[lift-session] Unexpected error: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        _try_alert(config, f"Lift session failed unexpectedly:\n\n{exc}")
        return 1


def _try_alert(config, body: str) -> None:
    try:
        send_alert_email(config, "Lift Session — Error", body)
    except EmailError:
        pass


if __name__ == "__main__":
    sys.exit(main())
