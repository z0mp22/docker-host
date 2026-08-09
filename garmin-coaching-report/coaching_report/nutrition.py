"""FatSecret nutrition integration (optional).

Pulls the athlete's own food-diary totals via the FatSecret Platform API
(OAuth 1.0, 3-legged). Nutrition is optional: if credentials or an authorized
token are missing, callers fall back to a report without fueling data.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import requests
from requests_oauthlib import OAuth1, OAuth1Session

API_URL = "https://platform.fatsecret.com/rest/server.api"
REQUEST_TOKEN_URL = "https://authentication.fatsecret.com/oauth/request_token"
AUTHORIZE_URL = "https://authentication.fatsecret.com/oauth/authorize"
ACCESS_TOKEN_URL = "https://authentication.fatsecret.com/oauth/access_token"

_EPOCH = date(1970, 1, 1)

# FatSecret food_entry fields (strings) -> our normalized output keys/units.
_MACRO_FIELDS = {
    "calories": "calories",
    "protein": "protein_g",
    "carbohydrate": "carbs_g",
    "fat": "fat_g",
    "fiber": "fiber_g",
    "sugar": "sugar_g",
    "sodium": "sodium_mg",
}


def _date_int(d: date) -> int:
    return (d - _EPOCH).days


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class FatSecretClient:
    """Minimal FatSecret food-diary reader."""

    def __init__(
        self,
        consumer_key: str,
        consumer_secret: str,
        oauth_token: str,
        oauth_token_secret: str,
    ) -> None:
        self._auth = OAuth1(
            consumer_key,
            client_secret=consumer_secret,
            resource_owner_key=oauth_token,
            resource_owner_secret=oauth_token_secret,
            signature_type="query",
        )

    def daily_totals(self, day: date) -> dict[str, Any] | None:
        """Sum all food-diary entries for a day into macro totals, or None."""
        params = {
            "method": "food_entries.get.v2",
            "date": _date_int(day),
            "format": "json",
        }
        resp = requests.get(API_URL, params=params, auth=self._auth, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        container = data.get("food_entries") if isinstance(data, dict) else None
        if not container:
            return None
        entries = container.get("food_entry") if isinstance(container, dict) else None
        if entries is None:
            return None
        if isinstance(entries, dict):
            entries = [entries]

        totals: dict[str, float] = defaultdict(float)
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            for src, dst in _MACRO_FIELDS.items():
                if entry.get(src) is not None:
                    totals[dst] += _to_float(entry[src])

        if not totals:
            return None

        return {
            "calories": round(totals.get("calories", 0.0)),
            "protein_g": round(totals.get("protein_g", 0.0), 1),
            "carbs_g": round(totals.get("carbs_g", 0.0), 1),
            "fat_g": round(totals.get("fat_g", 0.0), 1),
            "fiber_g": round(totals.get("fiber_g", 0.0), 1),
            "sugar_g": round(totals.get("sugar_g", 0.0), 1),
            "sodium_mg": round(totals.get("sodium_mg", 0.0)),
            "entries": len(entries),
        }


def load_tokens(token_path: str) -> dict[str, str] | None:
    path = Path(token_path)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if data.get("oauth_token") and data.get("oauth_token_secret"):
        return data
    return None


def connect(config: Any) -> FatSecretClient | None:
    """Build a client if creds + an authorized token exist, else None."""
    key = getattr(config, "fatsecret_consumer_key", "")
    secret = getattr(config, "fatsecret_consumer_secret", "")
    if not key or not secret:
        return None
    tokens = load_tokens(config.fatsecret_token_path)
    if not tokens:
        return None
    return FatSecretClient(
        key, secret, tokens["oauth_token"], tokens["oauth_token_secret"]
    )


def collect_week_nutrition(client: FatSecretClient, days: list[date]) -> dict[str, Any]:
    """Map ISO date string -> daily totals (or None) for the given days."""
    out: dict[str, Any] = {}
    for d in days:
        try:
            out[d.isoformat()] = client.daily_totals(d)
        except Exception:
            out[d.isoformat()] = None
    return out


def weekly_aggregates(
    client: FatSecretClient, start: date, end: date
) -> list[dict[str, Any]]:
    """Per-ISO-week average intake across logged days in [start, end]."""
    buckets: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "calories": 0.0,
            "protein_g": 0.0,
            "carbs_g": 0.0,
            "fat_g": 0.0,
            "fiber_g": 0.0,
            "days": 0.0,
        }
    )

    day = start
    while day <= end:
        try:
            totals = client.daily_totals(day)
        except Exception:
            totals = None
        if totals:
            iso = day.isocalendar()
            wk = f"{iso.year}-W{iso.week:02d}"
            b = buckets[wk]
            for k in ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g"):
                b[k] += totals.get(k) or 0
            b["days"] += 1
        day += timedelta(days=1)

    result = []
    for wk, b in sorted(buckets.items()):
        days = b["days"] or 1
        result.append(
            {
                "week": wk,
                "logged_days": int(b["days"]),
                "avg_calories": round(b["calories"] / days),
                "avg_protein_g": round(b["protein_g"] / days, 1),
                "avg_carbs_g": round(b["carbs_g"] / days, 1),
                "avg_fat_g": round(b["fat_g"] / days, 1),
                "avg_fiber_g": round(b["fiber_g"] / days, 1),
            }
        )
    return result


def authorize_interactive(
    consumer_key: str, consumer_secret: str, token_path: str
) -> None:
    """One-time 3-legged OAuth: print authorize URL, take PIN, save tokens."""
    oauth = OAuth1Session(
        consumer_key, client_secret=consumer_secret, callback_uri="oob"
    )
    request_token = oauth.fetch_request_token(REQUEST_TOKEN_URL)
    rt = request_token["oauth_token"]
    rts = request_token["oauth_token_secret"]

    print("\n1. Open this URL in a browser and approve access:\n")
    print(f"   {AUTHORIZE_URL}?oauth_token={rt}\n")
    verifier = input("2. Enter the PIN shown by FatSecret: ").strip()

    oauth = OAuth1Session(
        consumer_key,
        client_secret=consumer_secret,
        resource_owner_key=rt,
        resource_owner_secret=rts,
        verifier=verifier,
    )
    access = oauth.fetch_access_token(ACCESS_TOKEN_URL)

    path = Path(token_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "oauth_token": access["oauth_token"],
                "oauth_token_secret": access["oauth_token_secret"],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nSaved FatSecret tokens to {token_path}")
