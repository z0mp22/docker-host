"""Fingerboard sessions from rules, with no Claude call (ADR 0012).

The board ramp was always a rulebook: the phase sets the hold, hang time,
rest and effort; lift_fingerboard.limits_for() sets the caps; the warm-up is
fixed. The coach was only choosing feet assist and set count, so that choice
is a ladder here. Each phase has a ladder of steps, easiest first, and every
step changes one thing (feet assist, rounds, hold, or added weight).

Where on the ladder today's session sits comes from the last saved
prescription (the `progression` block in fingerboard-session-*.meta.json)
and how the board days logged since then went:
- two easy sessions in a row at the same step -> one step up
- a hard or unfinished session -> one step back
- finger, elbow or wrist pain in the feedback log -> one step back
- more than 14 days off the board -> one step back
- otherwise (or not logged yet) -> the same step again

Hevy doesn't record RPE on timed sets, so "easy" is all sets done at full
time, with no logged RPE above 7 and no "hard" in the feedback for that day.

Today-only changes that never move the ladder (the session is saved as
`reduced` and doesn't count toward stepping up): a deload week halves the
rounds; a hard climb in the last 24 h, or a likely lunch climb later today
(Tue/Thu before 1 pm), drops to the phase's lowest rounds with heavier feet;
the shoulder flag makes the feet heavier.

The phase itself still moves only when the athlete confirms a gate
(lift_fingerboard.py); this module only says a gate looks met.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from .errors import LiftPlanError
from .lift_coach import ExercisePrescription, SessionPlanResponse
from .lift_fingerboard import PHASES, WARMUP_EXERCISE

RULES_VERSION = "rules-v1"

FEET = ("heavy", "light", "off")
HOLDS = {
    "middle_outside": ("BM1000 Middle Row Outside", "Middle Row Outside (#3)"),
    "bottom_outside": ("BM1000 Bottom Row Outside", "Bottom Row Outside (#7)"),
}
GRIPS = (("Half Crimp", "Half crimp, thumb off"), ("Open Hand", "Open hand, thumb off"))


@dataclass(frozen=True)
class Step:
    hold: str
    feet: str
    rounds: int
    weight_lb: float = 0.0


LADDERS = {
    # Tissue prep: ease the feet off, then add the third round.
    1: [
        Step("middle_outside", "heavy", 2),
        Step("middle_outside", "light", 2),
        Step("middle_outside", "light", 3),
        Step("middle_outside", "off", 2),
        Step("middle_outside", "off", 3),
    ],
    # Repeaters: Middle Row at bodyweight, then Bottom Row with the feet easing off.
    2: [
        Step("middle_outside", "off", 3),
        Step("middle_outside", "off", 4),
        Step("bottom_outside", "heavy", 3),
        Step("bottom_outside", "light", 3),
        Step("bottom_outside", "light", 4),
        Step("bottom_outside", "off", 3),
        Step("bottom_outside", "off", 4),
    ],
    # Strength: 4 then 5 hangs; past the top, only the weight goes up.
    3: [
        Step("bottom_outside", "off", 4),
        Step("bottom_outside", "off", 5),
    ],
}


@dataclass(frozen=True)
class Dose:
    seconds: int
    rest_seconds: int
    rir: float
    note: str | None = None


DOSE = {
    1: Dose(10, 20, 4.0),
    2: Dose(42, 180, 3.0, "Repeater: 6 × 7s on / 3s off"),
    3: Dose(10, 180, 3.0, "~5s left in reserve"),
}
WARMUP_SETS = 6
WARMUP_SECONDS = 10
ROUND_REST = "2 min rest after every 6th set"

EASY_MAX_RPE = 7.0
HOLD_MAX_RPE = 8.0
LONG_GAP_DAYS = 14
EASY_SESSIONS_TO_STEP_UP = 2
# Phase 1 gate: 6 weeks in phase, no finger/elbow soreness, 5 x 10s at full bodyweight.
PHASE_1_GATE_DAYS = 42
WEIGHT_STEP_LB = 2.5

PAIN_PARTS = re.compile(r"\b(finger|fingers|pulley|elbow|elbows|wrist|wrists|forearm|forearms|tendon|knuckle)", re.I)
PAIN_WORDS = re.compile(r"\b(pain|painful|sore|soreness|hurt|hurts|ache|aches|achy|tweak|tweaked|twinge|swollen|sharp|pop|popped|strain)", re.I)
HARD_WORDS = re.compile(r"\b(hard|tough|brutal|struggled|struggle|couldn'?t|failed|too much|cut short)\b", re.I)

CLIMB_TYPES = ("climb", "boulder")
HARD_CLIMB_MINUTES = 90
HARD_CLIMB_TE = 3.0
LUNCH_CLIMB_DAYS = (1, 3)  # Tue, Thu
LUNCH_CLIMB_BEFORE_HOUR = 13

ANTAGONIST = ("Reverse Wrist Curl (Dumbbell)", 2, 15, 5.0, 60, "Palms down, slow lowering")


# --- Saved prescriptions -------------------------------------------------------


def load_board_prescriptions(report_dir: Path) -> list[dict[str, Any]]:
    """[{"date", "progression"}] from every saved fingerboard session that
    was planned by these rules, oldest first."""
    out = []
    for path in sorted(report_dir.glob("fingerboard-session-*.meta.json")):
        try:
            meta = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if isinstance(meta.get("progression"), dict) and meta.get("session_date"):
            out.append({"date": meta["session_date"][:10], "progression": meta["progression"]})
    out.sort(key=lambda p: p["date"])
    return out


# --- Reading what happened -----------------------------------------------------


def _local_date(stamp: str, tz: ZoneInfo) -> date | None:
    try:
        dt = datetime.fromisoformat(str(stamp))
    except ValueError:
        return None
    return (dt.astimezone(tz) if dt.tzinfo else dt).date()


def _feedback_by_day(feedback: list[dict[str, Any]], tz: ZoneInfo) -> list[tuple[date, str]]:
    out = []
    for entry in feedback:
        day = _local_date(entry.get("date", ""), tz)
        if day:
            out.append((day, str(entry.get("note") or "")))
    return out


def _is_pain(text: str) -> bool:
    return bool(PAIN_PARTS.search(text) and PAIN_WORDS.search(text))


def board_days(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Logged working board sets grouped by day, oldest first."""
    days: dict[str, dict[str, Any]] = {}
    for r in history:
        if not r.get("date") or r.get("set_type") == "warmup":
            continue
        d = days.setdefault(r["date"], {"date": r["date"], "sets": 0, "seconds": [], "rpe": [], "holds": set(), "weight_lb": 0.0})
        d["sets"] += 1
        d["seconds"].append(r.get("duration_seconds") or 0)
        if r.get("rpe") is not None:
            d["rpe"].append(float(r["rpe"]))
        d["holds"].add(r.get("hold"))
        d["weight_lb"] = max(d["weight_lb"], r.get("added_weight_lb") or 0.0)
    return [days[k] for k in sorted(days)]


def _prescription_for(day: str, prescriptions: list[dict[str, Any]]) -> dict[str, Any] | None:
    return next((p for p in reversed(prescriptions) if p["date"] <= day), None)


def judge_day(day: dict[str, Any], progression: dict[str, Any], notes: list[str]) -> str:
    """'easy', 'ok' (hold), 'hard' (back off) or 'pain'. `notes` is the
    feedback written on that day or the next."""
    if any(_is_pain(n) for n in notes):
        return "pain"
    done = day["sets"] >= progression["board_sets"] and min(day["seconds"], default=0) >= progression["seconds"] - 1
    top_rpe = max(day["rpe"], default=None)
    if not done or (top_rpe is not None and top_rpe > HOLD_MAX_RPE) or any(HARD_WORDS.search(n) for n in notes):
        return "hard"
    if top_rpe is not None and top_rpe > EASY_MAX_RPE:
        return "ok"
    return "easy"


def last_climb(activities: list[dict[str, Any]]) -> dict[str, Any] | None:
    climbs = []
    for a in activities:
        type_key = ((a.get("activityType") or {}).get("typeKey") or "").lower()
        if not any(t in type_key for t in CLIMB_TYPES):
            continue
        try:
            start = datetime.fromisoformat(str(a.get("startTimeLocal")))
        except ValueError:
            continue
        climbs.append((start, a, type_key))
    if not climbs:
        return None
    start, a, type_key = max(climbs, key=lambda c: c[0])
    minutes = round(float(a.get("duration") or 0) / 60)
    te = a.get("aerobicTrainingEffect")
    hard = (
        minutes >= HARD_CLIMB_MINUTES
        or (te is not None and float(te) >= HARD_CLIMB_TE)
        or type_key == "rock_climbing"  # outdoor climbs, logged by hand
    )
    return {"type": type_key, "minutes": minutes, "hard": hard}


# --- Choosing the step ----------------------------------------------------------


def _phase_start_progression(phase: int, history: list[dict[str, Any]]) -> dict[str, Any]:
    weight = 0.0
    if phase == 3:
        top = LADDERS[3][0].hold
        weight = max((r.get("added_weight_lb") or 0.0 for r in history if r.get("hold") == top and r.get("set_type") != "warmup"), default=0.0)
    return {"phase": phase, "level": 0, "weight_lb": weight}


def _step(phase: int, level: int, weight_lb: float) -> Step:
    ladder = LADDERS[phase]
    return replace(ladder[min(level, len(ladder) - 1)], weight_lb=weight_lb if phase == 3 else 0.0)


def _fmt_day(day: str | date) -> str:
    d = date.fromisoformat(day) if isinstance(day, str) else day
    return f"{d:%b} {d.day}"


def choose_step(
    fb: dict[str, Any],
    prescriptions: list[dict[str, Any]],
    feedback: list[tuple[date, str]],
    session_date: date,
) -> tuple[dict[str, Any], str, str, list[str]]:
    """(progression for today, why in one sentence, move, flags); move is
    "start", "up", "same" or "back"."""
    phase = fb["phase"]
    history = fb["history"]
    days = board_days(history)
    flags: list[str] = []
    last = prescriptions[-1] if prescriptions else None

    if last is None or last["progression"].get("phase") != phase:
        start = _phase_start_progression(phase, history)
        why = "First session planned by the ramp rules, so it starts at the bottom of the phase"
        if last is not None:
            why = f"First session of phase {phase}, so it starts at the bottom of the phase"
        return start, why, "start", flags

    cur = {k: last["progression"][k] for k in ("phase", "level", "weight_lb")}
    top = len(LADDERS[phase]) - 1
    since = [d for d in days if d["date"] >= last["date"]]

    if days and (session_date - date.fromisoformat(days[-1]["date"])).days > LONG_GAP_DAYS:
        gap = (session_date - date.fromisoformat(days[-1]["date"])).days
        flags.append(f"Last board day {_fmt_day(days[-1]['date'])}, {gap} days ago")
        return {**cur, "level": max(0, cur["level"] - 1)}, f"It's been {gap} days since the last board session, so this steps back one", "back", flags

    if not since:
        return cur, f"The {_fmt_day(last['date'])} session isn't logged in Hevy yet, so it's the same session again", "same", flags

    # Judge every logged day under its own prescription, newest last.
    judged = []
    for d in days:
        p = _prescription_for(d["date"], prescriptions)
        if p is None:
            continue
        day = date.fromisoformat(d["date"])
        notes = [n for fd, n in feedback if day <= fd <= day + timedelta(days=1)]
        judged.append((d, p["progression"], judge_day(d, p["progression"], notes)))
    d, prog, verdict = judged[-1]
    when = _fmt_day(d["date"])

    if verdict == "pain":
        flags.append(f"Finger/elbow/wrist complaint in feedback after {when}")
        return {**cur, "level": max(0, cur["level"] - 1)}, f"Feedback after {when} mentions finger, elbow or wrist pain, so this steps back one", "back", flags
    if verdict == "hard":
        return {**cur, "level": max(0, cur["level"] - 1)}, f"{when} was hard or cut short, so this steps back one", "back", flags
    if verdict == "ok":
        return cur, f"{when} was a solid effort, so it's the same session again", "same", flags

    easy_streak = 0
    for _, p, v in reversed(judged):
        if v != "easy" or p.get("reduced") or p.get("level") != cur["level"] or p.get("phase") != phase:
            break
        easy_streak += 1
    if fb.get("deload_week"):
        return cur, f"{when} went fine; no step up on a deload week", "same", flags
    if easy_streak < EASY_SESSIONS_TO_STEP_UP:
        if prog.get("reduced"):
            return cur, f"{when} was a cut-down day, so it doesn't count toward stepping up", "same", flags
        return cur, f"{when} felt easy; one more easy session here and it steps up", "same", flags
    if cur["level"] < top:
        return {**cur, "level": cur["level"] + 1}, f"{easy_streak} easy sessions in a row, so it steps up one", "up", flags
    if phase == 3:
        cap = fb["limits"]["max_added_weight_lb"].get(LADDERS[3][-1].hold, 0.0)
        weight = min(cur["weight_lb"] + WEIGHT_STEP_LB, cap)
        if weight > cur["weight_lb"]:
            return {**cur, "weight_lb": weight}, f"{easy_streak} easy sessions in a row, so it adds {WEIGHT_STEP_LB:g} lb", "up", flags
    return cur, f"{when} felt easy; this is the top of phase {phase}", "same", flags


def gate_flag(
    fb: dict[str, Any],
    prescriptions: list[dict[str, Any]],
    feedback: list[tuple[date, str]],
    session_date: date,
) -> str | None:
    phase = fb["phase"]
    if phase not in (1, 2):
        return None
    judged = []
    for d in board_days(fb["history"]):
        p = _prescription_for(d["date"], prescriptions)
        if p is None or p["progression"].get("phase") != phase:
            continue
        day = date.fromisoformat(d["date"])
        notes = [n for fd, n in feedback if day <= fd <= day + timedelta(days=1)]
        judged.append((d, p["progression"], judge_day(d, p["progression"], notes)))
    if phase == 1:
        started = date.fromisoformat(fb["phase_started"]) if fb.get("phase_started") else None
        if not started or (session_date - started).days < PHASE_1_GATE_DAYS:
            return None
        if any(_is_pain(n) for fd, n in feedback if fd >= started):
            return None
        met = any(p.get("feet") == "off" and d["sets"] >= 5 and v == "easy" for d, p, v in judged)
    else:
        last_two = judged[-2:]
        met = len(last_two) == 2 and all(
            p.get("hold") == "bottom_outside" and p.get("feet") == "off" and v == "easy" for _, p, v in last_two
        )
    return f"Fingerboard: phase {phase} gate looks met, confirm to advance" if met else None


# --- Today's adjustments ---------------------------------------------------------


def _heavier(feet: str) -> str:
    return FEET[max(0, FEET.index(feet) - 1)]


def todays_step(
    step: Step, fb: dict[str, Any], climb: dict[str, Any] | None, shoulder_flag: bool, now: datetime
) -> tuple[Step, list[str]]:
    """Today-only changes. A non-empty reason list means a reduced session."""
    phase = fb["phase"]
    lowest = min(s.rounds for s in LADDERS[phase])
    reasons = []
    rounds, feet = step.rounds, step.feet
    hours = fb.get("hours_since_last_climb")
    if climb and climb["hard"] and hours is not None and hours < 24:
        rounds, feet = lowest, _heavier(feet)
        reasons.append(f"hard climb {hours:g} h ago ({climb['minutes']} min), so it's the short version with heavier feet")
    elif now.weekday() in LUNCH_CLIMB_DAYS and now.hour < LUNCH_CLIMB_BEFORE_HOUR:
        rounds = lowest
        reasons.append(f"you likely climb at lunch today ({now:%A}), so it's the short version")
    if fb.get("deload_week"):
        rounds = max(1, math.ceil(rounds / 2))
        reasons.append("deload week, so half the rounds")
    if shoulder_flag and feet != "heavy":
        feet = _heavier(feet)
        reasons.append("shoulder flag is on, so more weight stays on the feet")
    rounds = min(rounds, fb["limits"]["max_rounds"])
    return replace(step, rounds=rounds, feet=feet), reasons


# --- Building the session ---------------------------------------------------------


def _split_rounds(rounds: int, available: list[str]) -> list[tuple[str, int]]:
    """Half crimp gets the extra round and goes first."""
    if len(available) == 1:
        return [(available[0], rounds)]
    first = math.ceil(rounds / 2)
    return [(g, n) for g, n in ((available[0], first), (available[1], rounds - first)) if n]


def _change(old: Step | None, new: Step, phase: int) -> str | None:
    if old is None or old == new:
        return None
    if old.hold != new.hold:
        return f"moves to {HOLDS[new.hold][1]}"
    if old.feet != new.feet:
        return f"feet {old.feet} → {new.feet}"
    if old.rounds != new.rounds:
        return f"{old.rounds} → {new.rounds} {'rounds' if PHASES[phase].sets_per_round > 1 else 'sets'}"
    if old.weight_lb != new.weight_lb:
        return f"added weight {old.weight_lb:g} → {new.weight_lb:g} lb"
    return None


def plan_fingerboard_session(
    payload: dict[str, Any],
    prescriptions: list[dict[str, Any]],
    now: datetime,
) -> tuple[SessionPlanResponse, dict[str, Any]]:
    """The session plus the `progression` block to save with it."""
    fb = payload["fingerboard"]
    phase = fb["phase"]
    rule = PHASES[phase]
    dose = DOSE[phase]
    session_date = date.fromisoformat(payload["session_date"])
    tz = ZoneInfo((payload.get("athlete_context") or {}).get("timezone") or "America/Denver")
    feedback = _feedback_by_day(payload.get("recent_feedback") or [], tz)
    catalog = {ex["name"]: ex for ex in payload["exercise_catalog"]}

    prog, why_step, move, flags = choose_step(fb, prescriptions, feedback, session_date)
    base = _step(phase, prog["level"], prog["weight_lb"])
    climb = last_climb(payload.get("recent_mountain_activity") or [])
    shoulder_flag = bool((payload.get("flags") or {}).get("shoulder_flag_active"))
    step, reasons = todays_step(base, fb, climb, shoulder_flag, now)

    title, location = HOLDS[step.hold]
    grips = [g for g in GRIPS if f"{title} - {g[0]}" in catalog]
    if not grips:
        raise LiftPlanError(f"No {title} exercises in the Hevy catalog")
    if WARMUP_EXERCISE not in catalog:
        raise LiftPlanError(f"{WARMUP_EXERCISE!r} is missing from the Hevy catalog")

    exercises: list[ExercisePrescription] = []
    lines = []

    def add(name, sets, *, seconds=None, reps=None, weight=None, rir=None, rest, note, goal, why):
        exercises.append(
            ExercisePrescription(
                exercise_id=catalog[name]["id"], exercise_name=name, slot_order=len(exercises) + 1,
                superset_group=None, sets=sets, reps=reps, duration_seconds=seconds, weight_lb=weight,
                rir_target=rir, rest_seconds=rest, notes=note, goal=goal, why=why,
            )
        )

    add(WARMUP_EXERCISE, WARMUP_SETS, seconds=WARMUP_SECONDS, rest=20, goal="warmup",
        note=f"Sets 1-4 top-corner jugs, feet on chair · 5-6 easy pulls on {location} · active shoulders",
        why="Same warm-up every board day: jugs first, then light pulls on today's hold.")
    lines.append(f"1. Warm-up — {WARMUP_SETS} × {WARMUP_SECONDS}s, rest 20s")

    previous = _step(phase, prescriptions[-1]["progression"]["level"], prescriptions[-1]["progression"]["weight_lb"]) \
        if prescriptions and prescriptions[-1]["progression"].get("phase") == phase else None
    change = _change(previous, base, phase)
    splits = _split_rounds(step.rounds, [g for g, _ in grips])
    cues = dict(grips)
    for i, (grip, rounds) in enumerate(splits):
        sets = rounds * rule.sets_per_round
        parts = [cues[grip], f"feet: {step.feet}"]
        if dose.note:
            parts.append(dose.note)
        parts.append("active shoulders")
        if rule.sets_per_round > 1 and (sets > rule.sets_per_round or i < len(splits) - 1):
            parts.append(ROUND_REST)
        weight = step.weight_lb or None
        add(f"{title} - {grip}", sets, seconds=dose.seconds, weight=weight, rir=dose.rir, rest=dose.rest_seconds,
            note=" · ".join(parts), goal="climbing",
            why=f"Phase {phase} {rule.name.lower()} on {location}" + (f"; {change} since last time." if change else "."))
        spec = f"{sets} × {dose.seconds}s"
        if rule.sets_per_round > 1 and rounds > 1:
            spec += f" ({rounds} rounds of {rule.sets_per_round})"
        if weight:
            spec += f" @ +{weight:g} lb"
        rest = f"{dose.rest_seconds}s" if dose.rest_seconds < 60 else f"{dose.rest_seconds // 60} min"
        lines.append(f"{len(lines) + 1}. {grip} — {spec}, rest {rest}")

    if not reasons and not fb.get("deload_week") and ANTAGONIST[0] in catalog and move != "back":
        name, sets, reps, weight, rest, note = ANTAGONIST
        add(name, sets, reps=reps, weight=weight, rir=4.0, rest=rest, note=note, goal="climbing",
            why="Wrist extensors balance all the gripping.")
        lines.append(f"{len(lines) + 1}. {name.split(' (')[0]} — {sets} × {reps} @ {weight:g} lb, rest {rest}s")

    week = f" · week {fb['weeks_in_phase']}" if fb.get("weeks_in_phase") else ""
    load = f", +{step.weight_lb:g} lb" if step.weight_lb else ""
    summary = "\n".join([f"**Phase {phase}{week} · {location}, feet {step.feet}{load}**", *lines])

    ramp = f", ramp week {fb['ramp_week']}" if fb.get("ramp_week") else ""
    rationale = f"Phase {phase} ({rule.name.lower()}){ramp}. {why_step}."
    if reasons:
        rationale += " Today only: " + "; ".join(reasons) + "."

    complaints = [n for fd, n in feedback if _is_pain(n) and fd >= session_date - timedelta(days=7)]
    if not complaints:
        flags.append("No finger, elbow or wrist complaints in the last week of feedback")
    if climb:
        flags.append(f"Last climb: {climb['type'].replace('_', ' ')} {climb['minutes']} min, {fb.get('hours_since_last_climb')} h ago")
    flags += [f"Reduced: {r}" for r in reasons]
    gate = gate_flag(fb, prescriptions, feedback, session_date)
    if gate:
        flags.append(gate)

    board_sets = sum(ex.sets for ex in exercises if ex.goal != "warmup" and ex.exercise_name.startswith("BM1000"))
    progression = {
        **prog, "hold": step.hold, "feet": step.feet, "rounds": step.rounds, "weight_lb": prog["weight_lb"],
        "board_sets": board_sets, "seconds": dose.seconds, "reduced": bool(reasons),
    }
    plan = SessionPlanResponse(
        session_date=session_date.isoformat(),
        rationale=rationale,
        summary_text=summary,
        flags_considered=flags,
        exercises=exercises,
        priorities=[f"climbing: phase {phase} {rule.name.lower()}{week.replace(' · ', ', ')}"],
    )
    return plan, progression
