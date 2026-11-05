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
        db.PlanChange(date="2026-11-20", kind="rest", title="Rest", focus="f", if_cooked="c"),  # too far out
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


def test_new_week_carries_the_last_days_of_the_previous_week():
    prev = _state()  # plan Tue Nov 3 - Thu Nov 5
    prev["plan"][2].update({"status": "done", "logged": "Indoor climbing 40 min"})
    days = [{"date": "2026-11-06", "weekday": "Friday", "label": "Fri Nov 6"}]
    new = db.new_week_state(_debrief(plan=[]), days, "2026-11-05", {}, {}, previous=prev)
    assert [r["date"] for r in new["plan"]] == ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]
    assert new["plan"][2]["carried"] is True and new["plan"][2]["status"] == "done"
    assert "carried" not in new["plan"][3]
    assert new["week_label"] == "Week of Fri Nov 6"


def test_a_reply_can_add_a_day_the_plan_doesnt_have_yet():
    s = _state()
    added = db.apply_plan_changes(
        s, [db.PlanChange(date="2026-11-07", kind="outdoor", title="Lumpy Ridge", focus="Multi-pitch", if_cooked="Single pitch")],
        date(2026, 11, 4),
    )
    assert added == ["Sat Nov 7"]
    assert [r["date"] for r in s["plan"]][-1] == "2026-11-07"
    sat = s["plan"][-1]
    assert (sat["weekday"], sat["status"], sat["title"]) == ("Saturday", "planned", "Lumpy Ridge")


def test_today_is_marked_once_something_is_logged_but_never_unknown():
    s = _state()
    today = date(2026, 11, 4)  # Wed is today; Tue is past
    assert db.check_days(s, [], [], today, include_today=True) == ["Tue Nov 3"]
    assert s["plan"][1]["status"] == "planned"  # nothing logged yet today
    lift = {"date": "2026-11-04", "logs": [{"exercise_name": "Pull Up (Band)"}]}
    assert db.check_days(s, [], [lift], today, include_today=True) == ["Wed Nov 4"]
    assert s["plan"][1]["status"] == "done"


def test_logged_days_cover_unplanned_days_with_a_short_label():
    acts = [_act("2026-11-03", "indoor_climbing", 53), _act("2026-11-03", "bouldering", 3), _act("2026-11-04", "e_bike_fitness", 60)]
    logged = db.logged_days(acts, [], date(2026, 11, 2), date(2026, 11, 4))
    assert set(logged) == {"2026-11-03", "2026-11-04"}
    assert logged["2026-11-03"]["summary"] == "Indoor climbing 53 min, Bouldering 3 min"
    assert logged["2026-11-03"]["short"] == "Climb" and logged["2026-11-04"]["short"] == "Cardio"
    assert logged["2026-11-04"]["hard"] is False
    assert db.logged_days([_act("2026-11-04", "mountain_biking", 50)], [], date(2026, 11, 4), date(2026, 11, 4))["2026-11-04"]["hard"] is True


def test_events_only_for_changes_and_hard_efforts_on_easy_days_once():
    s = _state()  # Tue climb, Wed lift, Thu open light day
    today = date(2026, 11, 5)
    acts = [_act("2026-11-04", "e_bike_fitness", 60), _act("2026-11-05", "mountain_biking", 120)]
    db.check_days(s, acts, [], today, include_today=True)
    logged = db.logged_days(acts, [], date(2026, 11, 3), today)
    events = db.find_events(s, logged, today)
    assert [(e["date"], e["why"]) for e in events] == [
        ("2026-11-04", "did something other than the plan"),
        ("2026-11-05", "a hard effort on an easy, rest or unplanned day"),
    ]
    assert events[0]["planned"] == {"kind": "lift", "title": "Pull-up focus"}
    s["noticed"] = [e["key"] for e in events]
    assert db.find_events(s, logged, today) == []
    # A day that went to plan is not an event.
    s2 = _state()
    acts2 = [_act("2026-11-04", "strength_training", 60)]
    db.check_days(s2, acts2, [], today, include_today=True)
    assert db.find_events(s2, db.logged_days(acts2, [], date(2026, 11, 3), today), today) == []


def test_plan_days_keep_how_why_and_goals():
    d = _debrief(plan=[{"date": "2026-11-04", "kind": "lift", "lift_type": "heavy_1h", "title": "Pull-up test",
                        "focus": "f", "how": ["Warm up 10 min", "Pull-ups first"], "why": "Fresh before Lumpy.",
                        "goals": ["physique", "climbing"], "if_cooked": "c"}], week_shape="Two climbs, one lift.")
    s = db.new_week_state(d, PLAN_DAYS, "2026-11-02", {}, {})
    wed = s["plan"][1]
    assert (wed["how"], wed["why"], wed["goals"]) == (["Warm up 10 min", "Pull-ups first"], "Fresh before Lumpy.", ["physique", "climbing"])
    assert s["week_note"] == "Two climbs, one lift."


def test_week_balance_counts_goals_and_flags_missing_ones():
    s = _state()  # Tue climb, Wed lift, Thu open light day
    s["plan"][0].update({"status": "done", "logged": "Indoor climbing 53 min"})
    s["plan"].append({"date": "2026-11-06", "weekday": "Friday", "label": "Fri Nov 6", "kind": "outdoor",
                      "title": "MTB, trail ride", "focus": "Punchy climbs", "status": "planned"})
    s["logged_days"] = {"2026-11-03": {"summary": "Indoor climbing 53 min", "kinds": ["climb", "light"]}}
    b = db.week_balance(s, date(2026, 11, 4))
    assert b["goals"]["climbing"] == {"done": 1, "planned": 1}  # Tue done, Wed lift planned
    assert b["goals"]["physique"] == {"done": 0, "planned": 1}
    assert b["goals"]["mtb"] == {"done": 0, "planned": 1} and b["goals"]["snowboard"]["planned"] == 1
    assert b["easy_or_rest_days"] == 1
    assert db.day_goals({"kind": "outdoor", "title": "Lumpy Ridge, multi-pitch", "focus": "", "status": "planned"}) == ["climbing"]
    assert db.day_goals(None, {"summary": "E-bike 60 min", "kinds": ["cardio", "light"]}) == ["mtb", "snowboard"]
