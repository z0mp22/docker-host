"""Entrypoint for weekly mountain sports coaching report."""

import os
import sys
import traceback
from datetime import date, datetime, timedelta
from pathlib import Path

from .coach import generate_coach_report
from .collector import build_payload
from .config import load_app_config
from .emailer import (
    last_report_window_end,
    save_outputs,
    send_alert_email,
    send_report_email,
)
from .errors import AuthExpiredError, CoachError, DataCollectionError, EmailError
from .garmin_auth import connect_with_tokens


def _parse_since(raw: str, report_date: date, reports_dir: Path) -> date | None:
    """SINCE: '' -> None (legacy 7-day); 'last' -> resume after the last report's
    window; 'Nd' -> report_date - N days; 'YYYY-MM-DD' -> explicit date."""
    raw = raw.strip().lower()
    if not raw:
        return None
    if raw == "last":
        last_end = last_report_window_end(reports_dir)
        if last_end is None:
            print(
                "[coaching-report] SINCE=last but no prior report found; "
                "using legacy 7-day window",
                file=sys.stderr,
            )
            return None
        return last_end + timedelta(days=1)
    if raw.endswith("d") and raw[:-1].isdigit():
        return report_date - timedelta(days=int(raw[:-1]))
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        print(
            f"[coaching-report] Invalid SINCE '{raw}', using legacy 7-day window",
            file=sys.stderr,
        )
        return None


def _parse_through(raw: str, report_date: date) -> date | None:
    """THROUGH: '' | 'yesterday' -> None (report_date - 1); 'today' -> report_date;
    'YYYY-MM-DD' -> explicit date."""
    raw = raw.strip().lower()
    if not raw or raw == "yesterday":
        return None
    if raw == "today":
        return report_date
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        print(
            f"[coaching-report] Invalid THROUGH '{raw}', using yesterday",
            file=sys.stderr,
        )
        return None


def main() -> int:
    try:
        config = load_app_config()
    except ValueError as exc:
        print(f"[coaching-report] Configuration error: {exc}", file=sys.stderr)
        return 1

    override = os.environ.get("REPORT_DATE", "").strip()
    try:
        report_date = (
            datetime.strptime(override, "%Y-%m-%d").date() if override else date.today()
        )
    except ValueError:
        print(
            f"[coaching-report] Invalid REPORT_DATE '{override}', using today",
            file=sys.stderr,
        )
        report_date = date.today()

    reports_dir = config.report_output_dir
    since = _parse_since(os.environ.get("SINCE", ""), report_date, reports_dir)
    through = _parse_through(os.environ.get("THROUGH", ""), report_date)
    dry_run = os.environ.get("DRY_RUN", "").strip().lower() in ("1", "true", "yes")

    try:
        client = connect_with_tokens(config.garmin)
    except AuthExpiredError as exc:
        print(f"[coaching-report] {exc}", file=sys.stderr)
        try:
            send_alert_email(
                config,
                "Garmin Coaching Report — Authentication Required",
                f"The weekly coaching report could not run.\n\n{exc}",
            )
        except EmailError as mail_exc:
            print(f"[coaching-report] Could not send alert: {mail_exc}", file=sys.stderr)
        return 1

    try:
        payload = build_payload(
            client, config, report_date, since=since, through=through
        )

        wr = payload["week_full"]["range"]
        n_acts = len(payload["week_full"].get("activity_details", []))
        n_days = len(payload["week_full"].get("daily_health", []))
        n_hist = len(payload.get("history_summaries", []))
        print(
            f"[coaching-report] window {wr['start']}..{wr['end']} "
            f"({wr.get('days', n_days)} days) — {n_acts} activities, "
            f"{n_days} daily-health days, {n_hist} history entries",
            file=sys.stderr,
        )

        if dry_run:
            print(
                "[coaching-report] DRY_RUN: window validated; skipping Claude + email",
                file=sys.stderr,
            )
            return 0

        result, user_content = generate_coach_report(
            payload,
            api_key=config.anthropic_api_key,
            model=config.anthropic_model,
            fallback_model=config.anthropic_fallback_model,
            max_input_tokens=config.max_input_tokens,
            max_output_tokens=config.max_output_tokens,
            enable_prompt_cache=config.enable_prompt_cache,
        )
        md_path = save_outputs(config, report_date, result, user_content, payload)
        full_md = md_path.read_text(encoding="utf-8")
        send_report_email(config, report_date, full_md)
        print(f"[coaching-report] Report saved to {md_path}", file=sys.stderr)
        return 0

    except (DataCollectionError, CoachError, EmailError) as exc:
        print(f"[coaching-report] {exc}", file=sys.stderr)
        if not dry_run:
            _try_alert(config, f"Coaching report failed: {exc}")
        return 1
    except Exception as exc:
        print(f"[coaching-report] Unexpected error: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        if not dry_run:
            _try_alert(config, f"Coaching report failed unexpectedly:\n\n{exc}")
        return 1


def _try_alert(config, body: str) -> None:
    try:
        send_alert_email(config, "Garmin Coaching Report — Error", body)
    except EmailError:
        pass


if __name__ == "__main__":
    sys.exit(main())
