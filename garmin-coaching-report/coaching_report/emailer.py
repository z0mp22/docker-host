"""Save reports and send email notifications."""

import json
import smtplib
import sys
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

import markdown

from .coach import CoachResult
from .config import AppConfig
from .errors import EmailError


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
| Prompt version | {result.prompt_version} |
"""


def _html_wrapper(body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #222; max-width: 720px; margin: 2em auto; padding: 0 1em; }}
  h1, h2, h3 {{ color: #1a1a1a; }}
  table {{ border-collapse: collapse; margin: 1em 0; }}
  th, td {{ border: 1px solid #ccc; padding: 0.4em 0.8em; text-align: left; }}
  th {{ background: #f5f5f5; }}
  code {{ background: #f4f4f4; padding: 0.1em 0.3em; border-radius: 3px; }}
</style>
</head>
<body>
{body_html}
</body>
</html>"""


def save_outputs(
    config: AppConfig,
    report_date: date,
    result: CoachResult,
    user_content: dict[str, Any],
    payload: dict[str, Any] | None = None,
) -> Path:
    """Write markdown report, metadata JSON, and optional debug input JSON."""
    config.report_output_dir.mkdir(parents=True, exist_ok=True)
    stamp = report_date.isoformat()
    base = config.report_output_dir / f"mountain-sports-coaching-{stamp}"

    full_markdown = result.report_markdown + _metadata_footer(result)
    md_path = base.with_suffix(".md")
    md_path.write_text(full_markdown, encoding="utf-8")

    meta = {
        "report_date": stamp,
        "model": result.model,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "estimated_input_tokens": result.estimated_input_tokens,
        "history_compression": result.history_compression,
        "week_compression": result.week_compression,
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
        f"compression={result.history_compression}/{result.week_compression}"
    )
    print(log_line, file=sys.stderr)

    return md_path


def send_report_email(config: AppConfig, report_date: date, markdown_content: str) -> None:
    subject = f"Mountain Sports Coaching Report — {report_date.isoformat()}"
    html_body = _html_wrapper(markdown.markdown(markdown_content, extensions=["tables"]))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config.gmail_user
    msg["To"] = config.gmail_user
    msg.attach(MIMEText(markdown_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=60) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(config.gmail_user, config.gmail_app_password)
            smtp.sendmail(config.gmail_user, [config.gmail_user], msg.as_string())
    except Exception as exc:
        raise EmailError(f"Failed to send report email: {exc}") from exc


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
