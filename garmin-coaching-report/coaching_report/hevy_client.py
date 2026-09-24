"""Minimal Hevy public API client (api.hevyapp.com, Hevy Pro accounts only).

Hand-rolled to match nutrition.py's style -- the API surface used here is
small enough that vendoring an SDK isn't worth it. Every response is checked
for a 2xx status before being trusted; nothing here assumes a well-formed
response just because a request was sent.

Field names come from Hevy's own OpenAPI spec (api.hevyapp.com/docs.json),
checked 2026-09-24. Hevy labels the API "use at your own risk" and may
change it -- if something 400s later, diff the request against that spec
first.

Units: Hevy's API is kilograms-only on the wire (`weight_kg`), regardless of
the unit the app displays. The lift coach thinks in pounds, so conversion
happens here at the boundary and nowhere else.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Any

import requests

from .errors import HevyError

if TYPE_CHECKING:
    from .lift_coach import ExercisePrescription, SessionPlanResponse

HEVY_BASE_URL = "https://api.hevyapp.com"
LB_PER_KG = 2.20462

# Hevy exercise-template types that can't be prescribed as a lifting set
# (distance/floors/steps machines, sled pushes). `duration` is deliberately
# kept -- dead hangs, planks and holds matter for climbing and shoulder PT.
_EXCLUDED_TEMPLATE_TYPES = {
    "distance_duration",
    "floors_duration",
    "steps_duration",
    "short_distance_weight",
}
_EXCLUDED_MUSCLE_GROUPS = {"cardio"}

# RIR the coach prescribes -> the RPE step Hevy lets the athlete log.
# Hevy's RPE picker is 6, 7, 7.5, 8, 8.5, 9, 9.5, 10 -- so RIR 3.5 has no
# loggable equivalent, and lift_coach.VALID_RIR_TARGETS mirrors this map.
RIR_TO_RPE = {0.0: 10, 0.5: 9.5, 1.0: 9, 1.5: 8.5, 2.0: 8, 2.5: 7.5, 3.0: 7, 4.0: 6}


def lb_to_kg(lb: float) -> float:
    return round(lb / LB_PER_KG, 3)


def kg_to_lb(kg: float) -> float:
    return round(kg * LB_PER_KG, 1)


def rpe_to_rir(rpe: float | None) -> float | None:
    return None if rpe is None else round(10 - float(rpe), 1)


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class HevyClient:
    def __init__(self, api_key: str, base_url: str = HEVY_BASE_URL) -> None:
        if not api_key:
            raise HevyError("HEVY_API_KEY is required")
        self._base = base_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({"api-key": api_key, "Accept": "application/json"})

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        resp = self._session.request(
            method, f"{self._base}{path}", params=params, json=payload, timeout=30
        )
        if resp.status_code not in (200, 201):
            raise HevyError(f"{method} {path} failed: HTTP {resp.status_code} {resp.text[:300]}")
        return resp.json()

    def _paged(self, path: str, key: str, page_size: int) -> list[dict[str, Any]]:
        """Walk Hevy's page/page_count pagination until exhausted."""
        items: list[dict[str, Any]] = []
        page = 1
        while True:
            data = self._request("GET", path, params={"page": page, "pageSize": page_size})
            if key not in data:
                raise HevyError(f"GET {path} returned an unexpected shape (no {key!r})")
            items.extend(data[key])
            if page >= int(data.get("page_count") or 1):
                return items
            page += 1

    # --- Exercise catalog -------------------------------------------------

    def get_exercise_catalog(self) -> list[dict[str, Any]]:
        """Strength-relevant exercise templates (cardio and machine-distance
        types dropped). This is the allowlist handed to Claude and to
        lift_safety.py's denylist resolution -- any exercise_id it writes
        must come from here."""
        raw = self._paged("/v1/exercise_templates", "exercise_templates", page_size=100)
        catalog = [
            {
                "id": t["id"],
                "name": t["title"],
                "type": t.get("type"),
                "muscle": t.get("primary_muscle_group"),
                "equipment": t.get("equipment"),
            }
            for t in raw
            if t.get("type") not in _EXCLUDED_TEMPLATE_TYPES
            and t.get("primary_muscle_group") not in _EXCLUDED_MUSCLE_GROUPS
        ]
        if not catalog:
            raise HevyError("Exercise catalog came back empty")
        return catalog

    # --- Writing the session ----------------------------------------------

    def find_routine_id(self, title: str) -> str | None:
        for routine in self._paged("/v1/routines", "routines", page_size=10):
            if routine.get("title") == title:
                return routine["id"]
        return None

    @staticmethod
    def _exercise_payload(ex: "ExercisePrescription") -> dict[str, Any]:
        notes = [ex.notes] if ex.notes else []
        if ex.rir_target is not None:
            notes.append(f"Target RIR {ex.rir_target:g} (RPE {RIR_TO_RPE[ex.rir_target]:g})")
        weight_kg = lb_to_kg(ex.weight_lb) if ex.weight_lb is not None else None
        sets = [
            {
                "type": "normal",
                "weight_kg": weight_kg,
                "reps": ex.reps if ex.duration_seconds is None else None,
                "duration_seconds": ex.duration_seconds,
            }
            for _ in range(ex.sets)
        ]
        return {
            "exercise_template_id": ex.exercise_id,
            "superset_id": ex.superset_group,
            "rest_seconds": ex.rest_seconds,
            "notes": " · ".join(notes) or None,
            "sets": sets,
        }

    def routine_payload(
        self, plan: "SessionPlanResponse", title: str, session_type: str
    ) -> dict[str, Any]:
        exercises = sorted(plan.exercises, key=lambda e: e.slot_order)
        return {
            "routine": {
                "title": title,
                "notes": f"{plan.session_date} · {session_type}\n\n{plan.summary_text}",
                "exercises": [self._exercise_payload(ex) for ex in exercises],
            }
        }

    def upsert_session_routine(
        self, plan: "SessionPlanResponse", title: str, session_type: str
    ) -> str:
        """Write the session into ONE reused routine, found by exact title --
        overwritten (PUT) if it exists, created (POST) otherwise. Idempotent
        without any local state: losing the reports dir can't orphan it.
        Returns the routine id."""
        body = self.routine_payload(plan, title, session_type)
        routine_id = self.find_routine_id(title)
        if routine_id is None:
            created = self._request("POST", "/v1/routines", payload=body)
            return _routine_id_from(created)
        self._request("PUT", f"/v1/routines/{routine_id}", payload=body)
        return routine_id

    # --- Reading history --------------------------------------------------

    def get_workouts_since(self, since: date) -> list[dict[str, Any]]:
        """Logged workouts that started on/after `since`, oldest first.

        Hevy lists newest first, so paging stops at the first page that
        reaches past `since`. That order isn't a documented guarantee, so the
        result is still filtered and sorted client-side."""
        out: list[dict[str, Any]] = []
        page = 1
        while True:
            data = self._request("GET", "/v1/workouts", params={"page": page, "pageSize": 10})
            if "workouts" not in data:
                raise HevyError("GET /v1/workouts returned an unexpected shape")
            batch = data["workouts"]
            recent = [w for w in batch if workout_date(w) and workout_date(w) >= since]
            out.extend(recent)
            if len(recent) < len(batch) or page >= int(data.get("page_count") or 1):
                break
            page += 1
        out.sort(key=lambda w: w.get("start_time") or "")
        return out

    def get_recent_workouts(self, limit: int) -> list[dict[str, Any]]:
        """The `limit` most recent logged workouts, oldest first."""
        data = self._request("GET", "/v1/workouts", params={"page": 1, "pageSize": min(limit, 10)})
        if "workouts" not in data:
            raise HevyError("GET /v1/workouts returned an unexpected shape")
        workouts = sorted(data["workouts"], key=lambda w: w.get("start_time") or "")
        return workouts[-limit:]

    def get_bodyweight_history(self, since: date) -> list[dict[str, Any]]:
        rows = self._paged("/v1/body_measurements", "body_measurements", page_size=10)
        out = [
            {"date": r["date"], "weight_lb": kg_to_lb(r["weight_kg"])}
            for r in rows
            if r.get("date") and r.get("weight_kg") is not None
            and date.fromisoformat(r["date"][:10]) >= since
        ]
        return sorted(out, key=lambda r: r["date"])


def workout_date(workout: dict[str, Any]) -> date | None:
    ts = parse_ts(workout.get("start_time"))
    return ts.date() if ts else None


def _routine_id_from(created: dict[str, Any]) -> str:
    """POST /v1/routines is documented to return a Routine, but some clients
    report it wrapped as {"routine": [Routine]} -- accept either rather than
    assume."""
    if "id" in created:
        return created["id"]
    wrapped = created.get("routine")
    if isinstance(wrapped, list) and wrapped:
        wrapped = wrapped[0]
    if isinstance(wrapped, dict) and "id" in wrapped:
        return wrapped["id"]
    raise HevyError(f"POST /v1/routines returned no routine id: {str(created)[:300]}")
