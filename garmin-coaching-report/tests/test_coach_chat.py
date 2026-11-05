"""Tests for coach_chat.py: what each mode saves, that a reply lands with
its plan changes, and that retries and failures leave a clean thread."""

import json
from datetime import date, datetime
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
    # The week-balance review has its own tests below; here every reply passes it.
    monkeypatch.setattr(cc, "balance_problems", lambda *a, **k: [])

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


def _sync_env(env, monkeypatch, acts, hour=15, day=(2026, 11, 4)):
    monkeypatch.setattr(cc, "_garmin", lambda config: object())
    monkeypatch.setattr(cc, "_logs_since", lambda *a, **k: (acts, [], []))

    class Now(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(*day, hour, 0, tzinfo=tz)

    monkeypatch.setattr(cc, "datetime", Now)


def _act(day, type_key, minutes):
    return {"startTimeLocal": f"{day} 12:00:00", "activityType": {"typeKey": type_key}, "duration": minutes * 60}


def test_sync_checks_in_once_when_a_session_changed(env, monkeypatch):
    _sync_env(env, monkeypatch, [_act("2026-11-04", "e_bike_fitness", 60)])  # Wed was a lift
    assert env.run(mode="sync") == 0
    s = env.state()
    assert s["plan"][1]["status"] == "changed" and s["logged_days"]["2026-11-04"]["short"] == "Cardio"
    coach = [m for m in s["thread"] if m.get("checkin")]
    assert len(coach) == 1 and coach[0]["about_day"] == "2026-11-04" and coach[0]["checkin_date"] == "2026-11-04"
    assert env.calls[0][1]["checkin"][0]["logged"] == "E-bike 60 min"
    assert s["last_coach_at"] == coach[0]["at"]
    assert env.run(mode="sync") == 0  # same activity: not looked at again
    assert len(env.calls) == 1


def test_sync_says_nothing_when_the_day_went_to_plan_or_at_night(env, monkeypatch):
    _sync_env(env, monkeypatch, [_act("2026-11-04", "strength_training", 60)])
    assert env.run(mode="sync") == 0
    assert env.calls == [] and env.state()["plan"][1]["status"] == "done"
    _sync_env(env, monkeypatch, [_act("2026-11-04", "e_bike_fitness", 60)], hour=22)
    assert env.run(mode="sync") == 0
    assert env.calls == []  # quiet hours; looked at in the morning


def test_sync_empty_reply_posts_nothing_but_notes_the_event(env, monkeypatch):
    monkeypatch.setattr(cc, "_reply", lambda *a: (db.CoachReplySchema(reply="  "), {"model": "m", "input_tokens": 1, "output_tokens": 1}))
    _sync_env(env, monkeypatch, [_act("2026-11-04", "e_bike_fitness", 60)])
    assert env.run(mode="sync") == 0
    s = env.state()
    assert s["thread"] == [] and s["noticed"] and s.get("last_coach_at") is None


def test_sync_without_garmin_changes_nothing(env, monkeypatch):
    monkeypatch.setattr(cc, "_garmin", lambda config: None)
    before = env.state()
    assert env.run(mode="sync") == 1
    assert env.state() == before


def test_sync_sends_nothing_when_the_coach_says_it_isnt_worth_saying(env, monkeypatch):
    monkeypatch.setattr(cc, "_reply", lambda *a: (db.CoachReplySchema(reply="Nothing changes.", worth_saying=False), {"model": "m", "input_tokens": 1, "output_tokens": 1}))
    _sync_env(env, monkeypatch, [_act("2026-11-04", "e_bike_fitness", 60)])
    assert env.run(mode="sync") == 0
    assert env.state()["thread"] == [] and env.state()["noticed"]


def test_replan_sends_the_button_text_and_flags_it(env, monkeypatch):
    seen = []

    def fake(config, state, msg, now):
        seen.append(msg)
        return db.CoachReplySchema(
            reply="Lift moves to Monday.",
            plan_changes=[db.PlanChange(date=now.date().isoformat(), kind="lift", lift_type="heavy_1h", title="Pull-up test",
                                        focus="f", how=["Warm up", "Pull-ups"], why="w", goals=["physique"], if_cooked="c")],
            week_note="Two climbs, one lift, one ride.",
        ), {"model": "m", "input_tokens": 1, "output_tokens": 1}

    monkeypatch.setattr(cc, "_reply", fake)
    assert env.run(mode="replan", cid="r1") == 0
    s = env.state()
    assert seen[0]["replan"] is True and seen[0]["text"] == cc.REPLAN_TEXT
    assert s["thread"][0]["replan"] is True and s["week_note"] == "Two climbs, one lift, one ride."
    added = [r for r in s["plan"] if r.get("how") == ["Warm up", "Pull-ups"]]
    assert len(added) == 1 and added[0]["goals"] == ["physique"]


def test_week_note_only_changes_with_the_plan(env, monkeypatch):
    monkeypatch.setattr(cc, "_reply", lambda *a: (db.CoachReplySchema(reply="ok", week_note="New shape"), {"model": "m", "input_tokens": 1, "output_tokens": 1}))
    assert env.run(mode="message", text="thanks", cid="c9") == 0
    assert env.state().get("week_note") is None


def test_a_plan_change_that_drops_lifting_goes_back_once(env, monkeypatch):
    replies = []

    def fake(config, state, msg, now):
        replies.append(msg.get("revise"))
        kind = "lift" if msg.get("revise") else "light"
        return db.CoachReplySchema(
            reply="ok", plan_changes=[db.PlanChange(date=now.date().isoformat(), kind=kind, title="t", focus="f", if_cooked="c")],
        ), {"model": "m", "input_tokens": 10, "output_tokens": 5}

    monkeypatch.setattr(cc, "_reply", fake)
    monkeypatch.setattr(cc, "balance_problems", lambda state, today: [] if any(r["kind"] == "lift" and r["date"] == today.isoformat() for r in state["plan"]) else ["No lift"])
    assert env.run(mode="message", text="Saturday's out", cid="c10") == 0
    assert replies[0] is None and replies[1]["problems"] == ["No lift"]
    coach = env.state()["thread"][-1]
    assert coach["revised_for"] == ["No lift"] and coach["input_tokens"] == 20
    assert any(r["kind"] == "lift" for r in env.state()["plan"])


def test_balance_problems_name_what_is_missing():
    from tests.test_debrief import _state
    s = _state()  # Tue climb, Wed lift, Thu open light day; nothing else planned
    probs = db.balance_problems(s, date(2026, 11, 4))
    assert any(p.startswith("No ride or spin") for p in probs)
    assert not any(p.startswith("No lift") for p in probs)
    assert any("he wants six training days" in p for p in probs)  # Thu-Mon have nothing planned
    s["plan"][1]["kind"] = "light"
    assert any(p.startswith("No lift") for p in db.balance_problems(s, date(2026, 11, 4)))


def test_ease_swaps_in_the_easy_version_and_keeps_the_original(env):
    with db.locked_state(env.dir) as s:
        s["readiness"] = {"date": "2026-11-04", "verdict": "ease", "ask": True, "decision": None,
                          "hrv": 16, "base_hrv": 21, "rhr": 75, "base_rhr": 70}
    assert env.run(mode="day", ref="2026-11-04", value="eased") == 0
    s = env.state()
    wed = s["plan"][1]
    assert wed["eased"] and wed["title"] == "Pull-up focus (eased)" and wed["focus"] == "c"
    assert wed["original"]["title"] == "Pull-up focus" and "HRV 16 (your normal 21)" in wed["why"]
    assert s["readiness"]["decision"] == "eased" and env.calls == []
    assert env.run(mode="day", ref="2026-11-04", value="eased") == 0  # twice doesn't stack
    assert env.state()["plan"][1]["title"] == "Pull-up focus (eased)"


def test_keep_only_records_the_choice(env):
    with db.locked_state(env.dir) as s:
        s["readiness"] = {"date": "2026-11-04", "verdict": "ease", "ask": True, "decision": None}
    assert env.run(mode="day", ref="2026-11-04", value="kept") == 0
    s = env.state()
    assert s["readiness"]["decision"] == "kept" and s["plan"][1]["title"] == "Pull-up focus"


def test_sync_records_todays_readiness_once_and_asks_only_for_a_hard_day(env, monkeypatch):
    _sync_env(env, monkeypatch, [])
    verdict = {"date": "2026-11-04", "verdict": "ease", "rhr": 75, "hrv": 16, "base_rhr": 70, "base_hrv": 21}
    seen = []
    monkeypatch.setattr(cc, "update_store", lambda *a: seen.append(1) or {})
    monkeypatch.setattr(cc, "assess", lambda store, today: dict(verdict))
    assert env.run(mode="sync") == 0
    r = env.state()["readiness"]
    assert r["ask"] is True and r["session"] == "Pull-up focus" and r["suggestion"] == "c" and r["decision"] is None
    assert env.run(mode="sync") == 0
    assert len(seen) == 1  # today's verdict is final
