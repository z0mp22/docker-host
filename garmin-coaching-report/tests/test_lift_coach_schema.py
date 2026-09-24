"""Unit tests for the lift-session structured-output schema. No network
calls -- the live Anthropic call itself (client.messages.parse) is exercised
against the real API in the staged verification plan, not here; this layer
only tests that a malformed/incomplete response is rejected before it could
ever reach the safety guard or a Hevy write.
"""

import pytest
from pydantic import ValidationError

from coaching_report.lift_coach import SessionPlanSchema, _to_response

VALID = {
    "session_date": "2026-09-19",
    "rationale": "Pulling volume progressed cleanly last session; shoulder flagged this week so no pressing.",
    "flags_considered": ["shoulder_flag_active"],
    "summary_text": "# Pull day\n- Barbell Row 3x8 @ 135 lb",
    "exercises": [
        {
            "exercise_id": "55E6546F",
            "exercise_name": "Bent Over Row (Barbell)",
            "slot_order": 1,
            "sets": 3,
            "reps": 8,
            "weight_lb": 135.0,
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
    assert plan.exercises[0].exercise_id == "55E6546F"
    assert plan.exercises[0].weight_lb == 135.0
    assert plan.exercises[0].duration_seconds is None
    assert plan.exercises[0].superset_group is None  # optional field defaults correctly


def test_missing_required_field_rejected():
    bad = {k: v for k, v in VALID.items() if k != "exercises"}
    with pytest.raises(ValidationError):
        SessionPlanSchema.model_validate(bad)


def test_wrong_type_rejected():
    bad = {
        **VALID,
        "exercises": [{**VALID["exercises"][0], "exercise_id": ["not", "a", "string"]}],
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


def test_rir_target_above_loggable_max_rejected():
    """Reproduces a real failure: Claude once proposed rir_target=5.0 for
    a generous-RIR light/PT session. Hevy's lowest
    loggable RPE is 6 (= RIR 4), so 5.0 must still be caught at schema-parse
    time, before any Hevy write is attempted."""
    bad = {**VALID, "exercises": [{**VALID["exercises"][0], "rir_target": 5.0}]}
    with pytest.raises(ValidationError):
        SessionPlanSchema.model_validate(bad)


def test_rir_target_off_step_rejected():
    """2.25 maps to no RPE step Hevy can log."""
    bad = {**VALID, "exercises": [{**VALID["exercises"][0], "rir_target": 2.25}]}
    with pytest.raises(ValidationError):
        SessionPlanSchema.model_validate(bad)


def test_rir_target_null_still_allowed():
    """None (no target set) must not be rejected."""
    ok = {**VALID, "exercises": [{**VALID["exercises"][0], "rir_target": None}]}
    schema = SessionPlanSchema.model_validate(ok)
    assert schema.exercises[0].rir_target is None


def test_rir_3_5_rejected_because_hevy_cannot_log_rpe_6_5():
    """Hevy's RPE picker jumps 6 -> 7, so RIR 3.5 could never be compared
    against what the athlete logs."""
    bad = {**VALID, "exercises": [{**VALID["exercises"][0], "rir_target": 3.5}]}
    with pytest.raises(ValidationError):
        SessionPlanSchema.model_validate(bad)


@pytest.mark.parametrize("rir", [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0])
def test_every_loggable_rir_accepted(rir):
    from coaching_report.hevy_client import RIR_TO_RPE

    ok = {**VALID, "exercises": [{**VALID["exercises"][0], "rir_target": rir}]}
    SessionPlanSchema.model_validate(ok)
    assert rir in RIR_TO_RPE  # schema and client mapping must agree


def test_duration_hold_parses():
    hold = {
        **VALID["exercises"][0],
        "exercise_id": "DEADHANG",
        "exercise_name": "Dead Hang",
        "reps": None,
        "weight_lb": None,
        "duration_seconds": 30,
    }
    plan = _to_response(SessionPlanSchema.model_validate({**VALID, "exercises": [hold]}))
    assert plan.exercises[0].duration_seconds == 30
