"""Persistent, accumulating athlete feedback for the lift-session coach.

Home Assistant's input_text is a single overwritable value (255-char cap) --
not a log. This module is the actual persistence: each submission appends a
timestamped entry to a JSONL file in REPORT_OUTPUT_DIR, and every future
generation includes the most recent entries as standing context (likes,
dislikes, ongoing health flags, how a session felt) rather than only
whatever was typed for that one call.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

_FEEDBACK_LOG_NAME = "lift_feedback_log.jsonl"


def _log_path(report_output_dir: Path) -> Path:
    return report_output_dir / _FEEDBACK_LOG_NAME


def append_feedback(report_output_dir: Path, text: str) -> None:
    report_output_dir.mkdir(parents=True, exist_ok=True)
    entry = {"date": datetime.now().astimezone().isoformat(), "note": text}
    with _log_path(report_output_dir).open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def load_recent_feedback(report_output_dir: Path, limit: int = 15) -> list[dict[str, Any]]:
    """Most recent `limit` entries, oldest first (natural reading order).
    Malformed lines are skipped rather than raised -- one bad line must never
    block a real generation from reading the rest of the log."""
    path = _log_path(report_output_dir)
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    entries: list[dict[str, Any]] = []
    for line in lines[-limit:]:
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries
