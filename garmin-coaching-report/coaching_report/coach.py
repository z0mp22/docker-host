"""Generate coaching report via Anthropic API."""

import json
from dataclasses import dataclass
from typing import Any, Literal

import anthropic

from .compression import compress_week, monthly_sport_aggregates, strip_large_fields
from .errors import CoachError
from .prompts import load_system_prompt, prompt_version

HistoryLevel = Literal["none", "stripped", "monthly_aggregates"]
WeekLevel = Literal["full", "downsampled", "structured", "compact"]


@dataclass
class CoachResult:
    report_markdown: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_input_tokens: int
    history_compression: HistoryLevel
    week_compression: WeekLevel
    prompt_version: str


def _prepare_user_content(
    payload: dict[str, Any],
    history_level: HistoryLevel,
    week_level: WeekLevel,
) -> dict[str, Any]:
    week_full = compress_week(payload["week_full"], week_level)
    history = payload["history_summaries"]

    if history_level == "none":
        history_out: Any = history
    elif history_level == "stripped":
        history_out = [strip_large_fields(a) for a in history]
    else:
        history_out = monthly_sport_aggregates(history)

    return {
        "report_date": payload["report_date"],
        "week_full": week_full,
        "history_summaries": history_out,
        "history_range": payload["history_range"],
        "history_compression_applied": history_level,
        "week_compression_applied": week_level,
    }


def _estimate_tokens(client: anthropic.Anthropic, model: str, system: str, user_json: str) -> int:
    try:
        return client.messages.count_tokens(
            model=model,
            system=system,
            messages=[{"role": "user", "content": user_json}],
        ).input_tokens
    except Exception:
        return len(user_json) // 3


def generate_coach_report(
    payload: dict[str, Any],
    api_key: str,
    model: str,
    max_input_tokens: int,
) -> tuple[CoachResult, dict[str, Any]]:
    """Call Claude with progressive compression until within token budget."""
    client = anthropic.Anthropic(api_key=api_key)
    system = load_system_prompt()
    pver = prompt_version()

    # History compresses first; week raw GPS is the usual bottleneck.
    compression_steps: list[tuple[HistoryLevel, WeekLevel]] = [
        ("none", "full"),
        ("stripped", "full"),
        ("monthly_aggregates", "full"),
        ("monthly_aggregates", "downsampled"),
        ("monthly_aggregates", "structured"),
        ("monthly_aggregates", "compact"),
    ]

    user_content: dict[str, Any] = {}
    user_json = ""
    estimated = 0
    history_used: HistoryLevel = "none"
    week_used: WeekLevel = "full"

    for history_level, week_level in compression_steps:
        user_content = _prepare_user_content(payload, history_level, week_level)
        user_json = json.dumps(user_content, default=str, ensure_ascii=False)
        estimated = _estimate_tokens(client, model, system, user_json)
        history_used = history_level
        week_used = week_level
        if estimated <= max_input_tokens:
            break

    if estimated > max_input_tokens:
        raise CoachError(
            f"Payload still too large after compression: ~{estimated:,} tokens "
            f"(max {max_input_tokens:,}). history={history_used} week={week_used}"
        )

    try:
        response = client.messages.create(
            model=model,
            max_tokens=8192,
            system=system,
            messages=[{"role": "user", "content": user_json}],
        )
    except Exception as exc:
        raise CoachError(f"Anthropic API call failed: {exc}") from exc

    text_blocks = [b.text for b in response.content if b.type == "text"]
    report_body = "\n".join(text_blocks).strip()

    usage = response.usage
    input_tokens = usage.input_tokens if usage else estimated
    output_tokens = usage.output_tokens if usage else 0

    result = CoachResult(
        report_markdown=report_body,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_input_tokens=estimated,
        history_compression=history_used,
        week_compression=week_used,
        prompt_version=pver,
    )
    return result, user_content
