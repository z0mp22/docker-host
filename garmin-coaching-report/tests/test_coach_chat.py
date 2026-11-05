"""Tests for coach_chat.py: what each mode saves, that a reply lands with
its plan changes, and that retries and failures leave a clean thread."""

import json
from datetime import datetime
from types import SimpleNamespace

import pytest

from coaching_report import coach_chat as cc
from coaching_report import debrief as db
from tests.test_debrief import _state


@pytest.fixture
def env(tmp_path, monkeypatch):
    db.write_state(tmp_path, _state())
    config = SimpleNamespace(report_output_dir=tmp_path, athlete_timezone="America/Denver")
    monkeypatch.setattr(cc, "load_app_config", lambda: config)
    calls = []

    def fake_reply(config, state, msg, now):
        calls.append((state, msg))
        return (
            db.CoachReplySchema(
                reply="Moved the ride to Thursday.",
                plan_changes=[db.PlanChange(date="2099-01-01", kind="rest", title="x", focus="y", if_cooked="z")],
                answered=[db.AnsweredQuestion(id="q1", answer="Halloween, one-off"), db.AnsweredQuestion(id="q9", answer="x")],
            ),
            {"model": "m", "input_tokens": 10, "output_tokens": 5},
        )

    monkeypatch.setattr(cc, "_reply", fake_reply)

    def run(**e):
        for k in ("COACH_MODE", "COACH_TEXT", "COACH_REF", "COACH_VALUE", "COACH_CID"):
            monkeypatch.delenv(k, raising=False)
        for k, v in e.items():
            monkeypatch.setenv(f"COACH_{k.upper()}", v)
        return cc.main()

    return SimpleNamespace(dir=tmp_path, run=run, calls=calls, state=lambda: db.load_state(tmp_path))


def test_message_saves_both_sides_and_logs_feedback(env):
    assert env.run(mode="message", text="  Saturday's   out ", cid="c1") == 0
    t = env.state()["thread"]
    assert [(m["role"], m["text"]) for m in t] == [("athlete", "Saturday's out"), ("coach", "Moved the ride to Thursday.")]
    assert t[1]["re"] == t[0]["id"] and t[0]["cid"] == "c1"
    assert env.state()["last_coach_at"] == t[1]["at"]
    log = [json.loads(x) for x in (env.dir / db.FEEDBACK_LOG).read_text().splitlines()]
    assert log == [{**log[0], "note": "Saturday's out", "source": "coach_chat"}]


def test_answer_records_the_answer(env):
    assert env.run(mode="answer", text="Halloween, one-off", ref="q1", cid="c2") == 0
    s = env.state()
    assert s["answers"]["q1"]["text"] == "Halloween, one-off"
    assert s["thread"][0]["answers"] == "q1"
    assert env.calls[0][1]["answers"] == "q1"


def test_message_about_a_day_marks_it_changed(env):
    assert env.run(mode="message", text="Did a road ride instead", ref="2026-11-03", cid="c3") == 0
    row = env.state()["plan"][0]
    assert (row["status"], row["status_source"], row["status_note"]) == ("changed", "athlete", "Did a road ride instead")


def test_retry_never_duplicates(env):
    env.run(mode="message", text="hi", cid="c4")
    env.run(mode="message", text="hi", cid="c4")
    assert len(env.state()["thread"]) == 2 and len(env.calls) == 1


def test_failed_reply_is_marked_and_retry_clears_it(env, monkeypatch):
    good = cc._reply
    monkeypatch.setattr(cc, "_reply", lambda *a: (_ for _ in ()).throw(RuntimeError("api down")))
    assert env.run(mode="message", text="hi", cid="c5") == 1
    assert env.state()["thread"][0]["reply_failed"] is True
    monkeypatch.setattr(cc, "_reply", good)
    assert env.run(mode="message", text="hi", cid="c5") == 0
    t = env.state()["thread"]
    assert len(t) == 2 and "reply_failed" not in t[0]


def test_day_mark_needs_no_claude(env):
    assert env.run(mode="day", ref="2026-11-03", value="done") == 0
    assert env.state()["plan"][0]["status"] == "done" and env.calls == []
    assert env.run(mode="day", ref="2026-11-03", value="maybe") == 1
    assert env.run(mode="day", ref="1999-01-01", value="done") == 1


def test_check_mode_marks_from_logs(env, monkeypatch):
    monkeypatch.setattr(cc, "_garmin", lambda config: None)
    monkeypatch.setattr(
        cc, "_logs_since",
        lambda *a: ([{"startTimeLocal": "2026-11-03 12:00:00", "activityType": {"typeKey": "indoor_climbing"}, "duration": 3000}], [], []),
    )

    class Now(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 11, 5, 3, 50, tzinfo=tz)

    monkeypatch.setattr(cc, "datetime", Now)
    assert env.run(mode="check") == 0
    plan = env.state()["plan"]
    assert plan[0]["status"] == "done" and plan[1]["status"] == "unknown" and plan[2]["status"] == "planned"


def test_bad_input(env, tmp_path, monkeypatch):
    assert env.run(mode="shout", text="x") == 1
    assert env.run(mode="message", text="   ") == 1
    db.state_path(env.dir).unlink()
    assert env.run(mode="check") == 0  # nothing to check before the first debrief
    assert env.run(mode="message", text="hi") == 1


def test_a_reply_can_close_a_question_the_conversation_answered(env):
    assert env.run(mode="message", text="It was Halloween, nothing more", cid="c7") == 0
    answers = env.state()["answers"]
    assert answers == {"q1": {**answers["q1"], "text": "Halloween, one-off", "via": "conversation"}}  # unknown q9 ignored


def test_a_message_about_a_future_or_unplanned_day_names_it_without_marking_it(env):
    assert env.run(mode="message", text="Saturday's out", ref="2099-01-02", cid="c8") == 0
    msg = env.state()["thread"][0]
    assert msg["about_day"] == "2099-01-02"
    assert all(r["status"] == "planned" for r in env.state()["plan"])
    assert cc._about_day(env.state(), "2099-01-02") == {"date": "2099-01-02", "weekday": "Friday", "planned": None}
