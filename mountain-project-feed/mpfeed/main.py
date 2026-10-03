"""Nightly run: fetch What's New for one area, write feed.json for Home Assistant.

Exit 0 whenever feed.json was written (its `status` says how the run went); exit 1 only
if the state couldn't be written, so the host wrapper can record that failure instead.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from . import html
from .common import StructureError
from .fetch import FetchError, Fetcher, make_client
from .rss import parse_rss

SCHEMA = 1
SEEN_CAP = 2000
WINDOW_DAYS = 31
# A whole month with nothing new in an area this busy means the source broke, not that it's quiet.
EMPTY_SUSPECT_MIN_PREVIOUS = 10
TYPES = ("route", "area", "comment")

log = logging.getLogger("mpfeed")


@dataclass
class Config:
    area_id: int = 105800315
    area_name: str = "Fort Collins"
    base_url: str = "https://www.mountainproject.com"
    state_dir: Path = Path("/state")
    rss_url: str | None = None
    min_interval: float = 60.0
    retry_delays: tuple[float, ...] = (60.0, 180.0)

    @classmethod
    def from_env(cls, env=os.environ) -> "Config":
        cfg = cls()
        cfg.area_id = int(env.get("AREA_ID", cfg.area_id))
        cfg.area_name = env.get("AREA_NAME", cfg.area_name)
        cfg.base_url = env.get("BASE_URL", cfg.base_url).rstrip("/")
        cfg.state_dir = Path(env.get("STATE_DIR", cfg.state_dir))
        cfg.rss_url = env.get("FEED_URL") or None
        if "REQUEST_INTERVAL" in env:
            cfg.min_interval = float(env["REQUEST_INTERVAL"])
        if "RETRY_DELAYS" in env:
            cfg.retry_delays = tuple(float(x) for x in env["RETRY_DELAYS"].split(",") if x.strip())
        return cfg

    @property
    def feed_url(self) -> str:
        return self.rss_url or (
            f"{self.base_url}/rss/new?selectedIds={self.area_id}&routes=on&areas=on&comments=on"
        )

    def tab_url(self, kind: str) -> str:
        return f"{self.base_url}/whats-new?type={kind}&locationId={self.area_id}&days=0"

    @property
    def page_url(self) -> str:
        return f"{self.base_url}/whats-new?locationId={self.area_id}"


@dataclass
class Outcome:
    status: str
    source: str
    items: list[dict]
    error: str | None = None
    warnings: list[str] = field(default_factory=list)


def run(cfg: Config, fetcher: Fetcher, now: Callable[[], datetime] = lambda: datetime.now(timezone.utc)) -> dict:
    cfg.state_dir.mkdir(parents=True, exist_ok=True)
    previous = _load_json(cfg.state_dir / "feed.json") or {}
    seen_path = cfg.state_dir / "seen.json"
    seen_list = _load_json(seen_path)
    first_run = seen_list is None
    seen_list = seen_list if isinstance(seen_list, list) else []
    prev_count = len(previous.get("items") or [])

    outcome = _collect(cfg, fetcher, prev_count, now())

    if outcome.status == "error":
        items = previous.get("items") or []
    else:
        seen = set(seen_list)
        items = outcome.items
        for it in items:
            it["new"] = not first_run and it["id"] not in seen
        fresh = [it["id"] for it in items if it["id"] not in seen]
        _write_json(seen_path, list(dict.fromkeys(seen_list + fresh))[-SEEN_CAP:])

    items.sort(key=lambda it: it.get("published") or "", reverse=True)
    stamp = now().isoformat()
    feed = {
        "schema": SCHEMA,
        "status": outcome.status,
        "source": outcome.source,
        "last_attempt": stamp,
        "last_success": stamp if outcome.status != "error" else previous.get("last_success"),
        "error": outcome.error,
        "warnings": outcome.warnings,
        "requests": fetcher.requests,
        "area": {"id": cfg.area_id, "name": cfg.area_name, "url": cfg.page_url},
        "counts": {t: sum(1 for it in items if it["type"] == t) for t in TYPES},
        "new_count": sum(1 for it in items if it.get("new")),
        "items": items,
    }
    _write_json(cfg.state_dir / "feed.json", feed)
    return feed


def _collect(cfg: Config, fetcher: Fetcher, prev_count: int, now: datetime) -> Outcome:
    try:
        items = parse_rss(fetcher.get(cfg.feed_url), cfg.area_id)
        _check_not_suspiciously_empty(items, prev_count, "RSS")
    except Exception as exc:
        rss_error = _describe(exc)
        log.warning("RSS feed failed: %s; trying the What's New pages instead", rss_error)
    else:
        warnings = []
        try:
            details = html.route_details(fetcher.get(cfg.tab_url("routes")))
            for it in items:
                if it["type"] == "route" and it["id"] in details:
                    it.update(details[it["id"]])
        except Exception as exc:
            log.warning("route details unavailable: %s", _describe(exc))
            warnings.append(f"Route type and stars unavailable ({_describe(exc)})")
        return Outcome("ok", "rss", items, warnings=warnings)

    try:
        items, warnings = _scrape_tabs(cfg, fetcher, now)
        _check_not_suspiciously_empty(items, prev_count, "page scrape")
    except Exception as exc:
        log.error("page scrape failed too: %s", _describe(exc))
        return Outcome("error", "cache", [], error=f"RSS feed: {rss_error}. Page scrape: {_describe(exc)}")
    return Outcome(
        "degraded", "html", items,
        warnings=[f"RSS feed failed ({rss_error}), so this came from the backup page scrape"] + warnings,
    )


def _scrape_tabs(cfg: Config, fetcher: Fetcher, now: datetime) -> tuple[list[dict], list[str]]:
    parsers = {
        "routes": html.parse_routes_tab,
        "areas": html.parse_areas_tab,
        "comments": html.parse_comments_tab,
    }
    cutoff = (now - timedelta(days=WINDOW_DAYS)).isoformat()
    items: list[dict] = []
    failures: list[str] = []
    for kind, parse in parsers.items():
        try:
            items += [it for it in parse(fetcher.get(cfg.tab_url(kind))) if it["published"] >= cutoff]
        except Exception as exc:
            failures.append(f"{kind}: {_describe(exc)}")
    if len(failures) == len(parsers):
        raise StructureError("; ".join(failures))
    return items, [f"Missing {f}" for f in failures]


def _describe(exc: Exception) -> str:
    if isinstance(exc, (FetchError, StructureError)):
        return str(exc)
    # Anything else is a parser bug tripped by changed markup; keep the type so it's diagnosable.
    return f"unexpected {type(exc).__name__}: {exc}"


def _check_not_suspiciously_empty(items: list[dict], prev_count: int, what: str) -> None:
    if not items and prev_count >= EMPTY_SUSPECT_MIN_PREVIOUS:
        raise StructureError(f"{what} returned no items (last run had {prev_count})")


def _load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as exc:
        log.warning("ignoring unreadable %s: %s", path, exc)
        return None


def _write_json(path: Path, data) -> None:
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = Config.from_env()
    with make_client() as client:
        fetcher = Fetcher(client, min_interval=cfg.min_interval, retry_delays=cfg.retry_delays)
        try:
            feed = run(cfg, fetcher)
        except Exception:
            log.exception("could not write feed state")
            return 1
    log.info(
        "status=%s source=%s items=%d new=%d requests=%d%s",
        feed["status"], feed["source"], len(feed["items"]), feed["new_count"], feed["requests"],
        f" error={feed['error']}" if feed["error"] else "",
    )
    for w in feed["warnings"]:
        log.warning("%s", w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
