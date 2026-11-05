"""Tests for debrief.py: the weekly coach's state file, plan-day matching
against Garmin and Hevy, plan changes, and what carries over to next week."""

import json
from datetime import date

from coaching_report import debrief as db
from coaching_report.report_context import previous_report

PLAN_DAYS = [
    {"date": "2026-11-03", "weekday": "Tuesday", "label": "Tue Nov 3"},
    {"date": "2026-11-04", "weekday": "Wednesday", "label": "Wed Nov 4"},
    {"date": "2026-11-05", "weekday": "Thursday", "label": "Thu Nov 5"},
]


def _debrief(**over):
    base = {
        "headline": "Sleep broke the week.",
        "push_line": "Sleep broke the week.",
        "baselines": "RHR about 70, HRV about 21.",
        "last_week": [],
        "insights": [{"goal": "climbing", "title": "Volume is there", "body": "Three sessions."}],
        "goals": [{"goal": g, "trend": "holding", "evidence": "x"} for g in ("climbing", "mtb", "snowboard", "physique")],
        "plan": [
            {"date": "2026-11-03", "kind": "climb", "lift_type": "heavy_1h", "title": "Gym climb", "focus": "f", "if_cooked": "c"},
            {"date": "2026-11-04", "kind": "lift", "lift_type": "heavy_1h", "title": "Pull-up focus", "focus": "f", "if_cooked": "c"},
        ],
        "leaves_out": "No second outdoor day.",
        "questions": [{"id": "Q 1!", "text": "What happened Sunday?", "context": "HRV low",
                       "answers": ["Halloween, one-off and a very long night", "Pattern", "Other", "Fourth"]}],
    }
    base.update(over)
    return db.question_ids_ok(db.DebriefSchema.model_validate(base))


def _state():
    return db.new_week_state(_debrief(), PLAN_DAYS, "2026-11-02", {"start": "2026-10-26", "end": "2026-11-01", "days": 7}, {"model": "m"})


def test_new_week_state_fills_every_plan_day_and_cleans_fields():
    s = _state()
    assert s["week_label"] == "Week of Tue Nov 3"
    assert [r["date"] for r in s["plan"]] == ["2026-11-03", "2026-11-04", "2026-11-05"]
    assert s["plan"][0]["lift_type"] is None  # only lifts keep a lift type
    assert s["plan"][1]["lift_type"] == "heavy_1h"
    assert s["plan"][2]["title"] == "Open day" and s["plan"][2]["kind"] == "light"
    assert all(r["status"] == "planned" for r in s["plan"])
    q = s["debrief"]["questions"][0]
    assert q["id"] == "q1"
    assert len(q["answers"]) == 3 and all(len(a) <= db.MAX_ANSWER_CHARS for a in q["answers"])
    assert "plan" not in s["debrief"]


def _act(day, type_key, minutes=45):
    return {"startTimeLocal": f"{day} 12:00:00", "activityType": {"typeKey": type_key}, "duration": minutes * 60}


def _row(kind):
    return {"date": "2026-11-03", "kind": kind, "label": "Tue Nov 3"}


def test_match_day_by_kind():
    assert db.match_day(_row("climb"), [_act("2026-11-03", "indoor_climbing", 52)], []) == ("done", "Indoor climbing 52 min")
    assert db.match_day(_row("climb"), [_act("2026-11-03", "mountain_biking")], [])[0] == "changed"
    assert db.match_day(_row("outdoor"), [_act("2026-11-03", "rock_climbing")], [])[0] == "done"
    assert db.match_day(_row("cardio"), [_act("2026-11-03", "indoor_cycling")], [])[0] == "done"
    lift = {"date": "2026-11-03", "logs": [{"exercise_name": "Pull Up (Band)"}]}
    board = {"date": "2026-11-03", "logs": [{"exercise_name": "BM1000 Warm-up"}]}
    assert db.match_day(_row("lift"), [], [lift]) == ("done", "Lift (Hevy)")
    assert db.match_day(_row("fingerboard"), [], [board])[0] == "done"
    assert db.match_day(_row("lift"), [], [board])[0] == "changed"
    assert db.match_day(_row("light"), [_act("2026-11-03", "walking")], [])[0] == "done"


def test_nothing_logged_asks_unless_optional_or_rest():
    assert db.match_day(_row("climb"), [], []) == ("unknown", None)
    assert db.match_day(_row("light"), [], []) == ("skipped", None)
    assert db.match_day(_row("rest"), [], [])[0] == "done"


def test_check_days_marks_only_past_days_you_didnt_mark():
    s = _state()
    s["plan"][1].update({"status": "skipped", "status_source": "athlete"})
    changed = db.check_days(s, [_act("2026-11-03", "indoor_climbing")], [], date(2026, 11, 5))
    assert changed == ["Tue Nov 3"]
    assert s["plan"][0]["status"] == "done" and s["plan"][0]["status_source"] == "logs"
    assert s["plan"][1]["status"] == "skipped"  # yours wins
    assert s["plan"][2]["status"] == "planned"  # today isn't checked
    assert db.check_days(s, [_act("2026-11-03", "indoor_climbing")], [], date(2026, 11, 5)) == []


def test_plan_changes_only_from_today_on():
    s = _state()
    changes = [
        db.PlanChange(date="2026-11-03", kind="rest", title="Rest", focus="f", if_cooked="c"),  # past
        db.PlanChange(date="2026-11-05", kind="outdoor", lift_type="heavy_1h", title="MTB ride", focus="Dry and 60°F", if_cooked="e-bike"),
        db.PlanChange(date="2026-11-20", kind="rest", title="Rest", focus="f", if_cooked="c"),  # not this week
    ]
    assert db.apply_plan_changes(s, changes, date(2026, 11, 4)) == ["Thu Nov 5"]
    thu = s["plan"][2]
    assert (thu["kind"], thu["title"], thu["lift_type"]) == ("outdoor", "MTB ride", None)
    assert thu["changed_at"] and s["plan"][0]["kind"] == "climb"


def test_locked_state_round_trip_and_replace_archives(tmp_path):
    with db.locked_state(tmp_path) as st:
        assert st is None  # nothing yet, nothing written
    assert not db.state_path(tmp_path).exists()
    db.replace_state(tmp_path, _state())
    with db.locked_state(tmp_path) as st:
        st["thread"].append({"role": "athlete", "text": "hi"})
    assert db.load_state(tmp_path)["thread"][0]["text"] == "hi"
    nxt = {**_state(), "report_date": "2026-11-09"}
    db.replace_state(tmp_path, nxt)
    assert db.load_state(tmp_path)["report_date"] == "2026-11-09"
    archived = json.loads((tmp_path / "weekly_coach-2026-11-02.json").read_text())
    assert archived["thread"][0]["text"] == "hi"


def test_markdown_archive_has_the_sections():
    md = db.render_markdown(_state())
    for part in ("# Week of Tue Nov 3", "## The one thing", "## What the week showed", "## Goals check",
                 "## This week", "| Wed Nov 4 | Pull-up focus |", "## Questions for you", "What happened Sunday?"):
        assert part in md


def test_previous_report_prefers_the_state_with_statuses_answers_and_thread(tmp_path):
    s = _state()
    s["plan"][0].update({"status": "done", "logged": "Indoor climbing 52 min"})
    s["answers"] = {"q1": {"text": "Halloween, one-off"}}
    s["thread"] = [{"role": "athlete", "text": "Saturday's out", "at": "x", "cid": "c1"}, {"role": "coach", "text": "Moved it", "at": "y"}]
    db.write_state(tmp_path, s)
    prev = previous_report(tmp_path, date(2026, 11, 9))
    assert prev["report_date"] == "2026-11-02"
    assert prev["plan"][0] == {"label": "Tue Nov 3", "kind": "climb", "title": "Gym climb", "status": "done",
                               "logged": "Indoor climbing 52 min", "status_note": None}
    assert prev["questions_and_answers"] == [{"question": "What happened Sunday?", "answer": "Halloween, one-off"}]
    assert [m["text"] for m in prev["conversation"]] == ["Saturday's out", "Moved it"]
    # Rerunning the same Monday doesn't treat this week as last week.
    assert previous_report(tmp_path, date(2026, 11, 2)) is None


def test_feedback_note_is_marked_for_the_weekly_report(tmp_path):
    db.append_feedback_note(tmp_path, "Knee a bit sore")
    entry = json.loads((tmp_path / db.FEEDBACK_LOG).read_text().splitlines()[0])
    assert entry["note"] == "Knee a bit sore" and entry["source"] == "coach_chat"
