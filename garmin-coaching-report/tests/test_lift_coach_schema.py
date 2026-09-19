"""Unit tests for the lift-session structured-output schema. No network
calls -- the live Anthropic call itself (client.messages.parse) is exercised
against the real API in the staged verification plan, not here; this layer
only tests that a malformed/incomplete response is rejected before it could
ever reach the safety guard or a wger write.
"""

import pytest
from pydantic import ValidationError

from coaching_report.lift_coach import SessionPlanSchema, _to_response

VALID = {
    "session_date": "2026-09-19",
    "rationale": "Pulling volume progressed cleanly last session; shoulder flagged this week so no pressing.",
    "flags_considered": ["shoulder_flag_active"],
    "summary_text": "# Pull day\n- Barbell Row 3x8 @ 60kg",
    "exercises": [
        {
            "exercise_id": 10,
            "exercise_name": "Barbell Row",
            "slot_order": 1,
            "sets": 3,
            "reps": 8,
            "weight_kg": 60.0,
            "rir_target": 2.0,
            "rest_seconds": 90,
        }
    ],
}


def test_valid_plan_parses_into_dataclasses():
    schema = SessionPlanSchema.model_validate(VALID)
    plan = _to_response(schema)
    assert plan.session_date == "2026-09-19"
    assert plan.flags_considered == ["shoulder_flag_active"]
    assert len(plan.exercises) == 1
    assert plan.exercises[0].exercise_id == 10
    assert plan.exercises[0].superset_group is None  # optional field defaults correctly


def test_missing_required_field_rejected():
    bad = {k: v for k, v in VALID.items() if k != "exercises"}
    with pytest.raises(ValidationError):
        SessionPlanSchema.model_validate(bad)


def test_wrong_type_rejected():
    bad = {
        **VALID,
        "exercises": [{**VALID["exercises"][0], "exercise_id": "not-a-number"}],
    }
    with pytest.raises(ValidationError):
        SessionPlanSchema.model_validate(bad)


def test_unknown_extra_field_on_exercise_does_not_silently_pass_through():
    """Pydantic's default is to ignore unknown fields, not reject them -- this
    test documents that choice explicitly rather than leaving it implicit."""
    extra = {**VALID, "exercises": [{**VALID["exercises"][0], "made_up_field": "x"}]}
    schema = SessionPlanSchema.model_validate(extra)  # does not raise
    assert not hasattr(schema.exercises[0], "made_up_field")


def test_empty_exercise_list_is_schema_valid():
    """The schema itself doesn't forbid zero exercises -- Claude returning an
    empty session would be a prompt-following problem, not something this
    layer guards against. Documented here so it isn't assumed to be covered."""
    schema = SessionPlanSchema.model_validate({**VALID, "exercises": []})
    assert schema.exercises == []
