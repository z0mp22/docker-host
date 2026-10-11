"""The mountain report hands the model every weekday instead of letting it
compute them: from 2026-09-05 to 2026-10-05 it used a calendar a year off
("Mon Oct 6" for Tue 2026-10-06) and put the Tue/Thu gym climbs on the
wrong days."""

from datetime import date

from coaching_report.coach import _prepare_user_content, _split_user_content
from coaching_report.collector import plan_days
from coaching_report.compression import _compress_daily_health


def test_plan_days_start_the_day_after_the_report_with_real_weekdays():
    days = plan_days(date(2026, 10, 5))  # a Monday
    assert [d["date"] for d in days] == [f"2026-10-{n:02d}" for n in range(6, 13)]
    assert days[0] == {"date": "2026-10-06", "weekday": "Tuesday", "label": "Tue Oct 6"}
    assert days[-1]["weekday"] == "Monday"


def test_plan_days_cross_a_month_boundary():
    days = plan_days(date(2026, 9, 28))
    assert days[2] == {"date": "2026-10-01", "weekday": "Thursday", "label": "Thu Oct 1"}


def test_compact_daily_health_keeps_the_weekday():
    out = _compress_daily_health({"date": "2026-10-09", "weekday": "Friday"}, "compact", "America/Denver")
    assert out["weekday"] == "Friday"


def test_weekdays_reach_the_model_in_the_dynamic_block():
    payload = {
        "report_date": "2026-10-12",
        "report_weekday": "Monday",
        "plan_days": plan_days(date(2026, 10, 12)),
        "athlete_context": {"timezone": "America/Denver"},
        "week_full": {"range": {}, "activity_details": [], "daily_health": []},
        "history_summaries": [],
        "history_range": {},
    }
    _, dynamic = _split_user_content(_prepare_user_content(payload, "stripped", "compact"))
    assert dynamic["report_weekday"] == "Monday"
    assert dynamic["plan_days"][0]["label"] == "Tue Oct 13"
