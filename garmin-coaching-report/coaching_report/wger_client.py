"""Minimal wger REST API client (self-hosted instance).

Hand-rolled to match nutrition.py's style -- the API surface used here is
small enough that vendoring an SDK isn't worth it. Every response is checked
for a 2xx status before being trusted; nothing here assumes a well-formed
response just because a request was sent.

Field names for the Routine/Day/Slot/SlotEntry write path come from wger's
documented behavior (wger.readthedocs.io/en/latest/api/routines.html), which
describes the relationships in prose rather than a full schema. They were
verified against the live self-hosted instance during initial deployment
(see the implementation plan's Stage 1) before this client was ever used for
a real write -- if you're touching this file later and something 400s,
check field names against that instance's own OPTIONS response first.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Any

import requests

from .errors import WgerError

if TYPE_CHECKING:
    from .lift_coach import ExercisePrescription, SessionPlanResponse

# Confirmed live against wger.de's /api/v2/exercisecategory/ (2026-09):
# Abs, Arms, Back, Calves, Cardio, Chest, Legs, Shoulders. Deliberately
# excludes Cardio -- not assumed, checked.
STRENGTH_CATEGORY_NAMES = {"Abs", "Arms", "Back", "Calves", "Chest", "Legs", "Shoulders"}


class WgerClient:
    def __init__(self, base_url: str, api_token: str) -> None:
        if not base_url or not api_token:
            raise WgerError("WGER_URL and WGER_API_TOKEN are both required")
        self._base = base_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update(
            {"Authorization": f"Token {api_token}", "Accept": "application/json"}
        )

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        resp = self._session.get(f"{self._base}{path}", params=params, timeout=30)
        if resp.status_code != 200:
            raise WgerError(f"GET {path} failed: HTTP {resp.status_code} {resp.text[:300]}")
        return resp.json()

    def _get_all(self, path: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Follow DRF's `next` pagination link until exhausted."""
        results: list[dict[str, Any]] = []
        url: str | None = f"{self._base}{path}"
        p: dict[str, Any] | None = dict(params or {})
        while url:
            resp = self._session.get(url, params=p, timeout=30)
            if resp.status_code != 200:
                raise WgerError(f"GET {path} failed: HTTP {resp.status_code} {resp.text[:300]}")
            data = resp.json()
            if "results" not in data:
                raise WgerError(f"GET {path} returned an unexpected (non-paginated) shape")
            results.extend(data["results"])
            url = data.get("next")
            p = None  # `next` already carries the full query string
        return results

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._session.post(f"{self._base}{path}", json=payload, timeout=30)
        if resp.status_code not in (200, 201):
            raise WgerError(f"POST {path} failed: HTTP {resp.status_code} {resp.text[:300]}")
        return resp.json()

    def get_exercise_catalog(self) -> list[dict[str, Any]]:
        """Strength-relevant exercises only (Cardio dropped), English names
        only. This is the allowlist handed to Claude and to lift_safety.py's
        denylist resolution -- any exercise_id it writes must come from here.
        """
        languages = self._get_all("/api/v2/language/")
        en = next((lang for lang in languages if lang.get("short_name") == "en"), None)
        if en is None:
            raise WgerError("Could not resolve the English language id from /api/v2/language/")
        en_id = en["id"]

        raw = self._get_all("/api/v2/exerciseinfo/", params={"limit": 100})
        catalog: list[dict[str, Any]] = []
        for ex in raw:
            category = (ex.get("category") or {}).get("name")
            if category not in STRENGTH_CATEGORY_NAMES:
                continue
            translations = ex.get("translations") or []
            en_t = next((t for t in translations if t.get("language") == en_id), None)
            name = (en_t or {}).get("name")
            if not name:
                continue
            catalog.append({"id": ex["id"], "name": name, "category": category})
        if not catalog:
            raise WgerError("Exercise catalog came back empty -- has the startup sync run yet?")
        return catalog

    def get_recent_sessions(self, limit: int) -> list[dict[str, Any]]:
        """Most recent logged sessions, each with its WorkoutLog entries
        (actual weight/reps/rir vs. the originally prescribed targets)."""
        sessions = self._get_all(
            "/api/v2/workoutsession/", params={"ordering": "-date", "limit": limit}
        )[:limit]
        out = []
        for sess in sessions:
            logs = self._get_all("/api/v2/workoutlog/", params={"session": sess["id"]})
            out.append({**sess, "logs": logs})
        return out

    def get_bodyweight_history(self, since: date) -> list[dict[str, Any]]:
        return self._get_all(
            "/api/v2/weightentry/",
            params={"date__gte": since.isoformat(), "ordering": "date"},
        )

    def get_workout_history(self, since: date) -> list[dict[str, Any]]:
        """Logged sessions with a `datetime_start` on/after `since`, each with
        its WorkoutLog entries (actual weight/reps/rir), most recent last.

        Deliberately does not reuse get_recent_sessions()'s `ordering: -date`
        param -- /api/v2/workoutsession/ has no `date` field (only
        `datetime_start`/`datetime_end`), confirmed live; that ordering is a
        silent no-op there. Sorted client-side instead.
        """
        sessions = self._get_all("/api/v2/workoutsession/")
        sessions.sort(key=lambda s: s.get("datetime_start") or "")
        out = []
        for sess in sessions:
            start = sess.get("datetime_start")
            if not start or date.fromisoformat(start[:10]) < since:
                continue
            logs = self._get_all("/api/v2/workoutlog/", params={"session": sess["id"]})
            out.append({**sess, "logs": logs})
        return out

    def get_unit_labels(self) -> tuple[dict[int, str], dict[int, str]]:
        """Live id->name maps for weight units (kg/lb/...) and repetition
        units (reps/until failure/...) -- resolved live rather than
        hardcoded, matching get_exercise_catalog()'s live language-id lookup.
        """
        weight_units = {
            u["id"]: u["name"] for u in self._get_all("/api/v2/setting-weightunit/")
        }
        rep_units = {
            u["id"]: u["name"] for u in self._get_all("/api/v2/setting-repetitionunit/")
        }
        return weight_units, rep_units

    def _write_config(self, path: str, slot_entry_id: int, value: Any) -> None:
        self._post(
            path,
            {
                "slot_entry": slot_entry_id,
                "iteration": 1,
                "value": value,
                "operation": "r",  # replace -- never wger's own +/- progression rules
                "step": "abs",
                "repeat": False,
            },
        )

    def create_session(self, plan: "SessionPlanResponse") -> int:
        """Write one session as a new, short Routine (one generation = one
        Routine = one Day) rather than appending to an ever-growing one --
        matches "no periodization skeleton, no fixed cadence". Exercises
        sharing a non-null superset_group land in one Slot as multiple
        SlotEntries; everything else gets its own Slot. Returns the created
        routine id.
        """
        stamp = plan.session_date
        routine = self._post(
            "/api/v2/routine/",
            {"name": f"Auto — {stamp}", "start": stamp, "end": stamp, "fit_in_week": False},
        )
        day = self._post(
            "/api/v2/day/",
            {"routine": routine["id"], "order": 1, "is_rest": False, "name": f"Lift {stamp}"},
        )

        groups: dict[Any, list["ExercisePrescription"]] = {}
        group_order: list[Any] = []
        for ex in plan.exercises:
            key = ("solo", id(ex)) if ex.superset_group is None else ("group", ex.superset_group)
            if key not in groups:
                groups[key] = []
                group_order.append(key)
            groups[key].append(ex)

        for slot_order, key in enumerate(group_order, start=1):
            slot = self._post("/api/v2/slot/", {"day": day["id"], "order": slot_order})
            for entry_order, ex in enumerate(groups[key], start=1):
                slot_entry = self._post(
                    "/api/v2/slot-entry/",
                    {
                        "slot": slot["id"],
                        "exercise": ex.exercise_id,
                        "order": entry_order,
                        "type": "normal",
                    },
                )
                se_id = slot_entry["id"]
                self._write_config("/api/v2/sets-config/", se_id, ex.sets)
                if ex.reps is not None:
                    self._write_config("/api/v2/repetitions-config/", se_id, ex.reps)
                if ex.weight_kg is not None:
                    self._write_config("/api/v2/weight-config/", se_id, ex.weight_kg)
                if ex.rir_target is not None:
                    self._write_config("/api/v2/rir-config/", se_id, ex.rir_target)
                if ex.rest_seconds is not None:
                    self._write_config("/api/v2/rest-config/", se_id, ex.rest_seconds)

        return routine["id"]
