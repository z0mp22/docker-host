"""Save reports and send email notifications."""

import dataclasses
import json
import smtplib
import sys
from datetime import date, datetime
from email.mime.text import MIMEText
from pathlib import Path
from typing import TYPE_CHECKING, Any


from .coach import CoachResult
from .config import AppConfig
from .errors import EmailError

if TYPE_CHECKING:
    from .lift_coach import SessionPlanResponse


def last_report_window_end(reports_dir: Path) -> date | None:
    """Latest window_end across {reports_dir}/mountain-sports-coaching-*.meta.json.

    Falls back to the report_date field for meta files written before window
    tracking existed. Returns None if the directory or any usable meta is absent.
    """
    if not reports_dir.is_dir():
        return None
    best: date | None = None
    for meta_file in reports_dir.glob("mountain-sports-coaching-*.meta.json"):
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        stamp = data.get("window_end") or data.get("report_date")
        try:
            parsed = datetime.strptime(stamp, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            continue
        if best is None or parsed > best:
            best = parsed
    return best


def _metadata_footer(result: CoachResult) -> str:
    return f"""
---

## Run metadata

| Metric | Value |
|--------|-------|
| Model | {result.model} |
| Input tokens | {result.input_tokens:,} |
| Output tokens | {result.output_tokens:,} |
| Estimated input tokens | {result.estimated_input_tokens:,} |
| History compression | {result.history_compression} |
| Week compression | {result.week_compression} |
| Fallback model used | {result.used_fallback_model} |
| Cache read tokens | {result.cache_read_tokens:,} |
| Cache write tokens | {result.cache_creation_tokens:,} |
| Prompt version | {result.prompt_version} |
"""


def save_outputs(
    config: AppConfig,
    report_date: date,
    result: CoachResult,
    user_content: dict[str, Any],
    payload: dict[str, Any] | None = None,
    report_markdown: str = "",
) -> Path:
    """Write the markdown archive of the week, metadata JSON, and optional
    debug input JSON. The debrief itself lives in weekly_coach.json."""
    config.report_output_dir.mkdir(parents=True, exist_ok=True)
    stamp = report_date.isoformat()
    base = config.report_output_dir / f"mountain-sports-coaching-{stamp}"

    full_markdown = report_markdown + _metadata_footer(result)
    md_path = base.with_suffix(".md")
    md_path.write_text(full_markdown, encoding="utf-8")

    week_range = (payload or {}).get("week_full", {}).get("range", {})
    meta = {
        "report_date": stamp,
        "window_start": week_range.get("start"),
        "window_end": week_range.get("end"),
        "window_days": week_range.get("days"),
        "model": result.model,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "estimated_input_tokens": result.estimated_input_tokens,
        "history_compression": result.history_compression,
        "week_compression": result.week_compression,
        "used_fallback_model": result.used_fallback_model,
        "cache_read_tokens": result.cache_read_tokens,
        "cache_creation_tokens": result.cache_creation_tokens,
        "prompt_version": result.prompt_version,
        "markdown_path": str(md_path),
    }
    meta_path = base.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    if config.save_debug_input:
        input_path = base.with_suffix(".input.json")
        debug = {
            "user_content_sent_to_claude": user_content,
            "full_garmin_payload": payload,
        }
        input_path.write_text(
            json.dumps(debug, default=str, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    log_line = (
        f"[coaching-report] {stamp} model={result.model} "
        f"in={result.input_tokens} out={result.output_tokens} "
        f"compression={result.history_compression}/{result.week_compression} "
        f"cache_read={result.cache_read_tokens}"
    )
    print(log_line, file=sys.stderr)

    return md_path


PRESCRIPTIONS_LOG = "lift_prescriptions.jsonl"


def save_lift_outputs(
    config: AppConfig,
    session_date: date,
    plan: "SessionPlanResponse",
    model_meta: dict[str, Any],
    routine_id: str | None,
    session_type: str | None = None,
    extra_meta: dict[str, Any] | None = None,
) -> Path:
    """Write the lift-session markdown summary + metadata JSON, refresh the
    fixed-name lift_session_latest.json that run-lift-session.sh copies to the
    Home Assistant config dir for the command_line sensor to read, and append
    the full structured prescription to lift_prescriptions.jsonl.

    That append-only log is the only lasting record of what was prescribed:
    Hevy's single reused routine is overwritten on every generation, so
    lift_collector.py joins logged workouts back to these entries to give the
    coach prescribed-vs-actual."""
    config.report_output_dir.mkdir(parents=True, exist_ok=True)
    stamp = session_date.isoformat()
    # Fingerboard sessions get their own files and their own HA sensor
    # (fingerboard_session_latest.json), so a board session never replaces
    # the lift session shown on the Coach panel.
    prefix = "fingerboard-session" if session_type == "fingerboard" else "lift-session"
    base = config.report_output_dir / f"{prefix}-{stamp}"

    md_path = base.with_suffix(".md")
    md_path.write_text(plan.summary_text, encoding="utf-8")

    meta = {
        "session_date": stamp,
        "generated_at": datetime.now().astimezone().isoformat(),
        "priorities": plan.priorities,
        "rationale": plan.rationale,
        "summary_text": plan.summary_text,
        "exercise_count": len(plan.exercises),
        "flags_considered": plan.flags_considered,
        "session_type": session_type,
        "routine_id": routine_id,
        **model_meta,
        **(extra_meta or {}),
    }
    meta_path = base.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    # Fixed filename (not date-stamped) so the HA sensor always reads the most
    # recent session without needing to know today's date.
    latest_path = config.report_output_dir / f"{prefix.replace('-', '_')}_latest.json"
    latest_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    prescription = {
        "generated_at": meta["generated_at"],
        "session_date": stamp,
        "session_type": session_type,
        "routine_id": routine_id,
        "exercises": [dataclasses.asdict(ex) for ex in plan.exercises],
    }
    with (config.report_output_dir / PRESCRIPTIONS_LOG).open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(prescription) + "\n")

    log_line = (
        f"[lift-session] {stamp} model={model_meta.get('model')} "
        f"exercises={len(plan.exercises)} routine_id={routine_id}"
    )
    print(log_line, file=sys.stderr)

    return md_path


def send_alert_email(config: AppConfig, subject: str, body: str) -> None:
    """Send plain-text alert (auth failure, etc.)."""
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = config.gmail_user
    msg["To"] = config.gmail_user

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=60) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(config.gmail_user, config.gmail_app_password)
            smtp.sendmail(config.gmail_user, [config.gmail_user], msg.as_string())
    except Exception as exc:
        raise EmailError(f"Failed to send alert email: {exc}") from exc
