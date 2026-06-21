"""Generate coaching report via Anthropic API."""

import json
from dataclasses import dataclass
from typing import Any, Literal

import anthropic

from .compression import (
    compress_week,
    monthly_sport_aggregates,
    strip_large_fields,
    weekly_sport_aggregates,
)
from .errors import CoachError
from .prompts import load_system_prompt, prompt_version

HistoryLevel = Literal["weekly_aggregates", "stripped", "monthly_aggregates"]
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
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0
    used_fallback_model: bool = False


def _prepare_user_content(
    payload: dict[str, Any],
    history_level: HistoryLevel,
    week_level: WeekLevel,
) -> dict[str, Any]:
    week_full = compress_week(payload["week_full"], week_level)
    history = payload["history_summaries"]

    if history_level == "weekly_aggregates":
        history_out: Any = weekly_sport_aggregates(history)
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


def _system_param(system: str, enable_cache: bool) -> str | list[dict[str, Any]]:
    if not enable_cache:
        return system
    return [
        {
            "type": "text",
            "text": system,
            "cache_control": {"type": "ephemeral"},
        }
    ]


def _estimate_tokens(
    client: anthropic.Anthropic,
    model: str,
    system: str | list[dict[str, Any]],
    user_json: str,
) -> int:
    try:
        return client.messages.count_tokens(
            model=model,
            system=system,
            messages=[{"role": "user", "content": user_json}],
        ).input_tokens
    except Exception:
        return len(user_json) // 3


def _call_model(
    client: anthropic.Anthropic,
    model: str,
    system: str | list[dict[str, Any]],
    user_json: str,
    max_output_tokens: int,
) -> anthropic.types.Message:
    return client.messages.create(
        model=model,
        max_tokens=max_output_tokens,
        system=system,
        messages=[{"role": "user", "content": user_json}],
    )


def generate_coach_report(
    payload: dict[str, Any],
    api_key: str,
    model: str,
    fallback_model: str,
    max_input_tokens: int,
    max_output_tokens: int,
    enable_prompt_cache: bool = True,
) -> tuple[CoachResult, dict[str, Any]]:
    """
    Call Claude with budget-aware defaults: weekly history + compact week on Sonnet,
    Haiku fallback if still over token budget.
    """
    client = anthropic.Anthropic(api_key=api_key)
    system_text = load_system_prompt()
    system = _system_param(system_text, enable_prompt_cache)
    pver = prompt_version()

    compression_steps: list[tuple[HistoryLevel, WeekLevel]] = [
        ("weekly_aggregates", "compact"),
        ("monthly_aggregates", "compact"),
    ]

    models = [model]
    if fallback_model and fallback_model != model:
        models.append(fallback_model)

    user_content: dict[str, Any] = {}
    user_json = ""
    estimated = 0
    history_used: HistoryLevel = "weekly_aggregates"
    week_used: WeekLevel = "compact"
    chosen_model = model
    used_fallback = False

    for idx, chosen_model in enumerate(models):
        if idx > 0:
            used_fallback = True
        for history_level, week_level in compression_steps:
            user_content = _prepare_user_content(payload, history_level, week_level)
            user_json = json.dumps(user_content, default=str, ensure_ascii=False)
            estimated = _estimate_tokens(client, chosen_model, system, user_json)
            history_used = history_level
            week_used = week_level
            if estimated <= max_input_tokens:
                break
        else:
            continue
        break
    else:
        raise CoachError(
            f"Payload still too large after compression: ~{estimated:,} tokens "
            f"(max {max_input_tokens:,}). history={history_used} week={week_used} "
            f"models tried={models}"
        )

    try:
        response = _call_model(
            client, chosen_model, system, user_json, max_output_tokens
        )
    except Exception as exc:
        raise CoachError(f"Anthropic API call failed: {exc}") from exc

    text_blocks = [b.text for b in response.content if b.type == "text"]
    report_body = "\n".join(text_blocks).strip()

    usage = response.usage
    input_tokens = usage.input_tokens if usage else estimated
    output_tokens = usage.output_tokens if usage else 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0

    result = CoachResult(
        report_markdown=report_body,
        model=chosen_model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_input_tokens=estimated,
        history_compression=history_used,
        week_compression=week_used,
        prompt_version=pver,
        cache_read_tokens=cache_read,
        cache_creation_tokens=cache_creation,
        used_fallback_model=used_fallback,
    )
    return result, user_content
