"""Generate one lifting session via Anthropic structured outputs.

Uses client.messages.parse(output_format=<pydantic model>) rather than
parsing prose -- verified directly against the installed anthropic==1.2.0
SDK source (anthropic/resources/messages/messages.py, anthropic/lib/_parse/
_response.py) before writing this, not assumed: output_format is merged into
output_config.format automatically, the parsed result comes back on
response.parsed_output, and response.stop_reason/.usage still work the same
as a normal Message since ParsedMessage subclasses it.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import anthropic
from pydantic import BaseModel, Field, field_validator

from .errors import LiftPlanError
from .prompts import lift_prompt_version, load_lift_prompt

# wger's rir-config endpoint (POST /api/v2/rir-config/) only accepts these
# exact half-step values -- confirmed from a live 400 response: "5.0 is not
# a valid RiR option: [None, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5]". Claude
# has no code-level ceiling on rir_target today, and the prompt's "generous
# RIR" guidance for light/PT sessions is exactly the case that produced 5.0
# in practice -- same "prompt instruction backed by a hard code check"
# posture as lift_safety.py's banned-exercise check.
VALID_RIR_TARGETS = {None, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5}


class ExercisePrescriptionSchema(BaseModel):
    exercise_id: int
    exercise_name: str
    slot_order: int
    superset_group: int | None = None
    sets: int
    reps: int | None = None
    weight_kg: float | None = None
    rir_target: float | None = None
    rest_seconds: int | None = None
    notes: str | None = None

    @field_validator("rir_target")
    @classmethod
    def _rir_target_must_be_wger_valid(cls, v: float | None) -> float | None:
        if v not in VALID_RIR_TARGETS:
            raise ValueError(
                f"rir_target={v!r} is not a value wger's rir-config endpoint accepts "
                f"(valid: {sorted(t for t in VALID_RIR_TARGETS if t is not None)}, or null)"
            )
        return v


class SessionPlanSchema(BaseModel):
    session_date: str
    rationale: str
    flags_considered: list[str] = Field(default_factory=list)
    exercises: list[ExercisePrescriptionSchema]
    summary_text: str


# Plain dataclasses used everywhere downstream (wger_client.py, emailer.py,
# lift_main.py, lift_safety.py) instead of the pydantic schema types above,
# so the pydantic dependency stays scoped to this one module's job: validating
# Claude's response. Field names deliberately mirror the schema 1:1.
@dataclass
class ExercisePrescription:
    exercise_id: int
    exercise_name: str
    slot_order: int
    superset_group: int | None
    sets: int
    reps: int | None
    weight_kg: float | None
    rir_target: float | None
    rest_seconds: int | None
    notes: str | None


@dataclass
class SessionPlanResponse:
    session_date: str
    rationale: str
    summary_text: str
    flags_considered: list[str] = field(default_factory=list)
    exercises: list[ExercisePrescription] = field(default_factory=list)


def _to_response(schema: SessionPlanSchema) -> SessionPlanResponse:
    return SessionPlanResponse(
        session_date=schema.session_date,
        rationale=schema.rationale,
        summary_text=schema.summary_text,
        flags_considered=list(schema.flags_considered),
        exercises=[ExercisePrescription(**ex.model_dump()) for ex in schema.exercises],
    )


def generate_lift_session(
    payload: dict[str, Any],
    api_key: str,
    model: str,
    max_output_tokens: int,
) -> tuple[SessionPlanResponse, dict[str, Any]]:
    """One Anthropic call, structured JSON output validated against
    SessionPlanSchema. Same stop_reason==max_tokens truncation guard as
    coach.py's generate_coach_report -- raises LiftPlanError (not CoachError),
    so the two pipelines' failures stay distinguishable in alert emails and
    in what fails isolated from what (see run-lift-session.sh's own lock and
    Actions concurrency group).
    """
    client = anthropic.Anthropic(api_key=api_key)
    system = load_lift_prompt()
    pver = lift_prompt_version()

    user_json = json.dumps(payload, default=str, ensure_ascii=False)
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_json}]

    try:
        response = client.messages.parse(
            model=model,
            max_tokens=max_output_tokens,
            system=system,
            messages=messages,
            output_format=SessionPlanSchema,
        )
    except Exception as exc:
        raise LiftPlanError(f"Anthropic API call failed or response failed schema validation: {exc}") from exc

    if response.stop_reason == "max_tokens":
        out = response.usage.output_tokens if response.usage else "?"
        raise LiftPlanError(
            f"Lift session truncated: hit max_tokens ({max_output_tokens:,}) before "
            f"the model finished. model={model} output_tokens={out}. "
            "Raise MAX_OUTPUT_TOKENS or trim the payload; do not write a partial plan."
        )

    parsed = response.parsed_output
    if parsed is None:
        raise LiftPlanError("Claude's response did not match the expected session-plan schema")

    usage = response.usage
    model_meta = {
        "model": model,
        "input_tokens": usage.input_tokens if usage else 0,
        "output_tokens": usage.output_tokens if usage else 0,
        "prompt_version": pver,
    }
    return _to_response(parsed), model_meta
