"""The weekly debrief as data, and the week's conversation around it.

Since 2026-11-04 the weekly report isn't an email. Claude returns a
structured debrief (DebriefSchema), and it is kept with the week's plan, your
answers and the thread with the coach in one state file,
REPORT_OUTPUT_DIR/weekly_coach.json. run-report.sh and run-coach.sh copy that
file to Home Assistant, where the Coach panel shows it and the phone pushes
come from.

The file changes in three ways:
- the Monday report replaces it with a new week (and archives the old one);
- coach_chat.py adds your messages and the coach's replies, and may change
  plan days that haven't happened yet;
- the nightly day check marks past plan days done, changed or unknown from
  Garmin and Hevy.

All of them change it under one lock, re-reading the file first, so a reply
that took 20 seconds never overwrites a check that finished meanwhile.
"""

from __future__ import annotations

import fcntl
import json
import re
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator, Literal

from pydantic import BaseModel, Field, field_validator

STATE_FILE = "weekly_coach.json"
LOCK_FILE = "weekly_coach.lock"
FEEDBACK_LOG = "lift_feedback_log.jsonl"
MAX_ANSWER_CHARS = 26
# Days before the new plan kept from last week's plan (the panel shows yesterday and today).
CARRY_DAYS = 3

Kind = Literal["climb", "outdoor", "lift", "fingerboard", "cardio", "light", "rest"]
LiftType = Literal["heavy_1h", "light_30m", "shoulder_pt"]
GoalName = Literal["climbing", "mtb", "snowboard", "physique"]
Trend = Literal["up", "holding", "slipping", "no_signal"]
Verdict = Literal["done", "changed", "skipped", "unknown"]


# --- What Claude returns ------------------------------------------------------


class LastWeekItem(BaseModel):
    item: str = Field(description="What you asked for, a few words")
    verdict: Verdict
    note: str = Field(description="What happened and what it showed, under 30 words")


class Insight(BaseModel):
    goal: Literal["climbing", "mtb", "snowboard", "physique", "recovery"]
    title: str = Field(description="The insight in under 10 words")
    body: str = Field(description="Under 60 words")


class GoalCheck(BaseModel):
    goal: GoalName
    trend: Trend
    evidence: str = Field(description="Under 15 words")


KIND_HELP = (
    "light for the optional 5th easy day; rest for a day with no session. Keep rest days to what the "
    "weekly structure leaves, and never justify one with the desk job"
)
FOCUS_HELP = (
    "What the session is for and how hard, under 30 words, with the weather reason if it decided the day. "
    "For lift and fingerboard days, never list exercises: the lift coach picks them."
)


class PlanDay(BaseModel):
    date: str = Field(description="Copied from plan_days")
    kind: Kind = Field(description=KIND_HELP)
    lift_type: LiftType | None = Field(None, description="Only when kind is lift")
    title: str = Field(description="The session in 2-4 words, e.g. 'Gym climb, quality'")
    focus: str = Field(description=FOCUS_HELP)
    if_cooked: str = Field(description="The easier version, under 15 words")


class Question(BaseModel):
    id: str = Field(description="q1, q2")
    text: str = Field(description="The question, under 15 words")
    context: str = Field(description="Why you ask, under 20 words")
    answers: list[str] = Field(description="2-3 likely answers he can tap, each under 26 characters")

    @field_validator("answers")
    @classmethod
    def _short_answers(cls, v: list[str]) -> list[str]:
        v = [a.strip()[:MAX_ANSWER_CHARS] for a in v if a.strip()]
        return v[:3]


class DebriefSchema(BaseModel):
    headline: str = Field(description="The one thing: two or three sentences, under 50 words")
    push_line: str = Field(description="The headline for a phone notification, under 120 characters")
    baselines: str = Field(description="His normal RHR, HRV and Body Battery in one line")
    last_week: list[LastWeekItem] = Field(default_factory=list)
    insights: list[Insight]
    goals: list[GoalCheck]
    plan: list[PlanDay]
    leaves_out: str = Field(description="What this week deliberately leaves out, one sentence")
    questions: list[Question]


class PlanChange(BaseModel):
    date: str
    kind: Kind = Field(description=KIND_HELP)
    lift_type: LiftType | None = None
    title: str
    focus: str = Field(description=FOCUS_HELP)
    if_cooked: str


class AnsweredQuestion(BaseModel):
    id: str = Field(description="The question's id from week.debrief.questions")
    answer: str = Field(description="His answer in a few words, as he'd put it")


class CoachReplySchema(BaseModel):
    reply: str = Field(description="Your reply, under 90 words")
    plan_changes: list[PlanChange] = Field(default_factory=list)
    answered: list[AnsweredQuestion] = Field(
        default_factory=list,
        description="Your open debrief questions that the conversation has now answered, so you stop asking them",
    )


# --- State file ----------------------------------------------------------------


def state_path(reports_dir: Path) -> Path:
    return reports_dir / STATE_FILE


def load_state(reports_dir: Path) -> dict[str, Any] | None:
    try:
        return json.loads(state_path(reports_dir).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


@contextmanager
def locked_state(reports_dir: Path) -> Iterator[dict[str, Any] | None]:
    """Yields the current state under the lock; whatever it holds when the
    block ends (the same dict, mutated) is written back. Yields None when
    there is no state yet, and then writes nothing."""
    reports_dir.mkdir(parents=True, exist_ok=True)
    with (reports_dir / LOCK_FILE).open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = load_state(reports_dir)
        yield state
        if state is not None:
            write_state(reports_dir, state)


def write_state(reports_dir: Path, state: dict[str, Any]) -> None:
    tmp = state_path(reports_dir).with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(state_path(reports_dir))


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def new_week_state(
    debrief: DebriefSchema,
    plan_days: list[dict[str, str]],
    report_date: str,
    window: dict[str, Any],
    model_meta: dict[str, Any],
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The state for a fresh week. Plan rows are matched to plan_days by
    date; a day Claude left out becomes an open day rather than vanishing.
    The last CARRY_DAYS days of the previous week's plan (statuses and all)
    come along, so the panel's rolling day strip always has yesterday and
    today even when the week was planned starting tomorrow."""
    by_date = {p.date: p for p in debrief.plan}
    plan = []
    for d in plan_days:
        p = by_date.get(d["date"])
        row = p.model_dump() if p else {
            "date": d["date"], "kind": "light", "lift_type": None, "title": "Open day",
            "focus": "Nothing planned; easy movement if you feel like it.", "if_cooked": "Rest",
        }
        if row["kind"] != "lift":
            row["lift_type"] = None
        plan.append({**row, "weekday": d["weekday"], "label": d["label"], "status": "planned",
                     "logged": None, "status_source": None})
    if previous and plan:
        first = date.fromisoformat(plan[0]["date"])
        start = (first - timedelta(days=CARRY_DAYS)).isoformat()
        plan = [
            {**r, "carried": True}
            for r in previous.get("plan", [])
            if start <= r["date"] < plan[0]["date"]
        ] + plan
    data = debrief.model_dump()
    data.pop("plan")
    return {
        "version": 1,
        "report_date": report_date,
        "generated_at": now_iso(),
        "week_label": f"Week of {plan_days[0]['label']}" if plan_days else "This week",
        "window": window,
        "debrief": data,
        "plan": plan,
        "answers": {},
        "thread": [],
        "updated_at": now_iso(),
        "last_coach_at": None,
        **{k: model_meta.get(k) for k in ("model", "input_tokens", "output_tokens")},
    }


def replace_state(reports_dir: Path, state: dict[str, Any]) -> None:
    """A new week replaces the old one, thread and all. The old one is kept
    next to its report as weekly_coach-<date>.json."""
    reports_dir.mkdir(parents=True, exist_ok=True)
    with (reports_dir / LOCK_FILE).open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        old = load_state(reports_dir)
        if old and old.get("report_date"):
            (reports_dir / f"weekly_coach-{old['report_date']}.json").write_text(
                json.dumps(old, indent=2, ensure_ascii=False), encoding="utf-8"
            )
        write_state(reports_dir, state)


# How far ahead a reply may add a day the plan doesn't have yet (the panel strip shows 5 ahead).
ADD_DAYS_AHEAD = 8


def apply_plan_changes(state: dict[str, Any], changes: list[PlanChange], today: date) -> list[str]:
    """Replace plan days from today on, or add one the plan doesn't have yet
    (up to ADD_DAYS_AHEAD days out). Returns the labels changed; past days
    and dates further out are ignored."""
    changed = []
    rows = {r["date"]: r for r in state["plan"]}
    for c in changes:
        try:
            day = date.fromisoformat(c.date)
        except ValueError:
            continue
        if day < today or (c.date not in rows and (day - today).days > ADD_DAYS_AHEAD):
            continue
        row = rows.get(c.date)
        if row is None:
            row = {"date": c.date, "weekday": day.strftime("%A"), "label": f"{day:%a %b} {day.day}",
                   "status": "planned", "logged": None, "status_source": None}
            rows[c.date] = row
            state["plan"].append(row)
        row.update({k: v for k, v in c.model_dump().items() if k != "date"})
        if row["kind"] != "lift":
            row["lift_type"] = None
        row["changed_at"] = now_iso()
        changed.append(row["label"])
    state["plan"].sort(key=lambda r: r["date"])
    return changed


def append_feedback_note(reports_dir: Path, text: str) -> None:
    """Your messages to the weekly coach also go in the feedback log the lift
    coach reads, marked so the weekly report doesn't count them twice."""
    entry = {"date": now_iso(), "note": text, "source": "coach_chat"}
    with (reports_dir / FEEDBACK_LOG).open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


# --- Matching plan days to what was logged ---------------------------------------

OUTDOOR = ("mountain_biking", "rock_climbing", "hiking", "backcountry", "resort_ski", "snowboard",
           "trail_running", "skate_ski", "cross_country", "mountaineering")
CARDIO = ("cycling", "biking", "virtual_ride", "running", "rowing", "elliptical", "e_bike", "spin")


def _type_key(activity: dict[str, Any]) -> str:
    return ((activity.get("activityType") or {}).get("typeKey") or "").lower()


def _kind_of(activity: dict[str, Any]) -> set[str]:
    t = _type_key(activity)
    kinds = {"light"}
    if "climb" in t or "boulder" in t:
        kinds.add("outdoor" if t == "rock_climbing" else "climb")
    if any(k in t for k in OUTDOOR):
        kinds.add("outdoor")
    if any(k in t for k in CARDIO):
        kinds.add("cardio")
    if "strength" in t:
        kinds.add("lift")
    return kinds


def _describe(activity: dict[str, Any]) -> str:
    minutes = round(float(activity.get("duration") or 0) / 60)
    label = _type_key(activity).replace("_", " ") or "activity"
    return f"{label[:1].upper()}{label[1:]} {minutes} min" if minutes else label.capitalize()


def match_day(
    row: dict[str, Any], activities: list[dict[str, Any]], workouts: list[dict[str, Any]]
) -> tuple[str, str | None]:
    """(status, what was logged) for one past plan day. `activities` are
    Garmin summaries and `workouts` Hevy sessions, both already that day's."""
    logged: list[str] = []
    kinds: set[str] = set()
    for a in activities:
        kinds |= _kind_of(a)
        logged.append(_describe(a))
    for w in workouts:
        names = [lg.get("exercise_name") or "" for lg in w.get("logs") or []]
        if any(n.startswith("BM1000") for n in names):
            kinds |= {"fingerboard", "light"}
            logged.append("Fingerboard (Hevy)")
        if any(n and not n.startswith("BM1000") for n in names):
            kinds |= {"lift", "light"}
            logged.append("Lift (Hevy)")
    summary = ", ".join(dict.fromkeys(logged)) or None
    kind = row["kind"]
    if kind == "rest":
        return "done", summary
    if kind in kinds:
        return "done", summary
    if kinds:
        return "changed", summary
    # Nothing logged. An optional light day is just skipped; anything else, ask.
    return ("skipped" if kind == "light" else "unknown"), None


def check_days(
    state: dict[str, Any], activities: list[dict[str, Any]], workouts: list[dict[str, Any]], today: date
) -> list[str]:
    """Mark every past plan day that you haven't marked yourself. Returns the
    labels whose status changed."""
    by_day_acts: dict[str, list[dict[str, Any]]] = {}
    for a in activities:
        by_day_acts.setdefault(str(a.get("startTimeLocal") or "")[:10], []).append(a)
    by_day_lifts: dict[str, list[dict[str, Any]]] = {}
    for w in workouts:
        by_day_lifts.setdefault(str(w.get("date") or "")[:10], []).append(w)
    changed = []
    for row in state["plan"]:
        if date.fromisoformat(row["date"]) >= today or row.get("status_source") == "athlete":
            continue
        status, logged = match_day(row, by_day_acts.get(row["date"], []), by_day_lifts.get(row["date"], []))
        if (status, logged) != (row.get("status"), row.get("logged")):
            row.update({"status": status, "logged": logged, "status_source": "logs"})
            changed.append(row["label"])
    return changed


# --- Markdown archive ----------------------------------------------------------


_TREND = {"up": "up", "holding": "holding", "slipping": "slipping", "no_signal": "no signal this week"}


def render_markdown(state: dict[str, Any]) -> str:
    """The week as markdown, kept as mountain-sports-coaching-<date>.md so the
    archive and SINCE=last keep working."""
    d = state["debrief"]
    out = [f"# {state['week_label']}", "", "## The one thing", d["headline"], ""]
    if d.get("last_week"):
        out += ["## Last week's plan"] + [f"- **{x['item']}:** {x['verdict']}. {x['note']}" for x in d["last_week"]] + [""]
    out += ["## What the week showed"] + [f"**{i['title']}** {i['body']}\n" for i in d["insights"]]
    out += [f"*{d['baselines']}*", "", "## Goals check"]
    out += [f"- **{g['goal'].capitalize()}:** {_TREND[g['trend']]}. {g['evidence']}" for g in d["goals"]] + [""]
    out += ["## This week", "", "| Day | Session | Focus | If you're cooked |", "|---|---|---|---|"]
    out += [f"| {r['label']} | {r['title']} | {r['focus']} | {r['if_cooked']} |" for r in state["plan"]]
    out += ["", d["leaves_out"], "", "## Questions for you"]
    out += [f"{n}. {q['text']} ({q['context']})" for n, q in enumerate(d["questions"], 1)]
    return "\n".join(out) + "\n"


def previous_week(state: dict[str, Any] | None) -> dict[str, Any] | None:
    """What next week's report needs from this week: what was planned and
    what actually happened, your answers, and the conversation."""
    if not state:
        return None
    d = state.get("debrief") or {}
    questions = d.get("questions") or []
    return {
        "report_date": state.get("report_date"),
        "headline": d.get("headline"),
        "plan": [{k: r.get(k) for k in ("label", "kind", "title", "status", "logged", "status_note")} for r in state.get("plan", [])],
        "questions_and_answers": [
            {"question": q["text"], "answer": (state.get("answers") or {}).get(q["id"], {}).get("text")} for q in questions
        ],
        "conversation": [{k: m.get(k) for k in ("role", "text", "at")} for m in state.get("thread", [])][-30:],
    }


_SLUG = re.compile(r"[^a-z0-9]+")


def question_ids_ok(debrief: DebriefSchema) -> DebriefSchema:
    """Question ids are used in push action names; keep them short and unique."""
    seen = set()
    for n, q in enumerate(debrief.questions, 1):
        qid = _SLUG.sub("", q.id.lower())[:8] or f"q{n}"
        if qid in seen:
            qid = f"q{n}"
        seen.add(qid)
        q.id = qid
    debrief.questions = debrief.questions[:2]
    return debrief
