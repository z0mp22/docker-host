"""Entrypoint for weekly mountain sports coaching report."""

import sys
import traceback
from datetime import date

from .coach import generate_coach_report
from .collector import build_payload
from .config import load_app_config
from .emailer import save_outputs, send_alert_email, send_report_email
from .errors import AuthExpiredError, CoachError, DataCollectionError, EmailError
from .garmin_auth import connect_with_tokens


def main() -> int:
    try:
        config = load_app_config()
    except ValueError as exc:
        print(f"[coaching-report] Configuration error: {exc}", file=sys.stderr)
        return 1

    report_date = date.today()

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
        payload = build_payload(client, report_date)
        result, user_content = generate_coach_report(
            payload,
            api_key=config.anthropic_api_key,
            model=config.anthropic_model,
            max_input_tokens=config.max_input_tokens,
        )
        md_path = save_outputs(config, report_date, result, user_content, payload)
        full_md = md_path.read_text(encoding="utf-8")
        send_report_email(config, report_date, full_md)
        print(f"[coaching-report] Report saved to {md_path}", file=sys.stderr)
        return 0

    except (DataCollectionError, CoachError, EmailError) as exc:
        print(f"[coaching-report] {exc}", file=sys.stderr)
        _try_alert(config, f"Coaching report failed: {exc}")
        return 1
    except Exception as exc:
        print(f"[coaching-report] Unexpected error: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        _try_alert(config, f"Coaching report failed unexpectedly:\n\n{exc}")
        return 1


def _try_alert(config, body: str) -> None:
    try:
        send_alert_email(config, "Garmin Coaching Report — Error", body)
    except EmailError:
        pass


if __name__ == "__main__":
    sys.exit(main())
