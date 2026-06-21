"""Generate coaching report via Anthropic API."""

import json
from dataclasses import dataclass
from typing import Any, Literal

import anthropic

from .collector import monthly_sport_aggregates, strip_large_fields
from .errors import CoachError
from .prompts import load_system_prompt, prompt_version

CompressionLevel = Literal["none", "stripped", "monthly_aggregates"]


@dataclass
class CoachResult:
    report_markdown: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_input_tokens: int
    history_compression: CompressionLevel
    prompt_version: str


def _prepare_user_content(
    payload: dict[str, Any], compression: CompressionLevel
) -> dict[str, Any]:
    week_full = payload["week_full"]
    history = payload["history_summaries"]

    if compression == "none":
        history_out: Any = history
    elif compression == "stripped":
        history_out = [strip_large_fields(a) for a in history]
    else:
        history_out = monthly_sport_aggregates(history)

    return {
        "report_date": payload["report_date"],
        "week_full": week_full,
        "history_summaries": history_out,
        "history_range": payload["history_range"],
        "history_compression_applied": compression,
    }


def _estimate_tokens(client: anthropic.Anthropic, model: str, system: str, user_json: str) -> int:
    try:
        return client.messages.count_tokens(
            model=model,
            system=system,
            messages=[{"role": "user", "content": user_json}],
        ).input_tokens
    except Exception:
        return len(user_json) // 4


def generate_coach_report(
    payload: dict[str, Any],
    api_key: str,
    model: str,
    max_input_tokens: int,
) -> tuple[CoachResult, dict[str, Any]]:
    """
    Call Claude with full week data and progressively compressed history.

    Returns CoachResult and the final user content dict (for debug JSON save).
    """
    client = anthropic.Anthropic(api_key=api_key)
    system = load_system_prompt()
    pver = prompt_version()

    compression_order: list[CompressionLevel] = ["none", "stripped", "monthly_aggregates"]
    user_content: dict[str, Any] = {}
    user_json = ""
    estimated = 0
    compression_used: CompressionLevel = "none"

    for level in compression_order:
        user_content = _prepare_user_content(payload, level)
        user_json = json.dumps(user_content, default=str, ensure_ascii=False)
        estimated = _estimate_tokens(client, model, system, user_json)
        compression_used = level
        if estimated <= max_input_tokens:
            break

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
        history_compression=compression_used,
        prompt_version=pver,
    )
    return result, user_content
