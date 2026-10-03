import json
from datetime import datetime, timezone

import httpx
import pytest

from mpfeed import main as mpmain
from mpfeed.main import Config, run

from .conftest import make_fetcher

NOW = datetime(2026, 10, 3, 9, 30, tzinfo=timezone.utc)


@pytest.fixture
def cfg(tmp_path):
    return Config(state_dir=tmp_path)


def go(cfg, site):
    return run(cfg, make_fetcher(site), now=lambda: NOW)


def item(feed, id_):
    return next(i for i in feed["items"] if i["id"] == id_)


def test_happy_path(cfg, site):
    feed = go(cfg, site)
    assert (feed["status"], feed["source"], feed["error"], feed["warnings"]) == ("ok", "rss", None, [])
    assert feed["counts"] == {"route": 28, "area": 9, "comment": 24}
    assert site.hits == ["rss", "routes"]
    z = item(feed, "203924224")
    assert (z["route_type"], z["stars"]) == ("Sport", 1.5)
    assert feed["last_attempt"] == feed["last_success"] == NOW.isoformat()
    assert json.loads((cfg.state_dir / "feed.json").read_text()) == feed
    pubs = [i["published"] for i in feed["items"]]
    assert pubs == sorted(pubs, reverse=True)


def test_first_run_marks_nothing_new_then_tracks_new(cfg, site):
    assert go(cfg, site)["new_count"] == 0
    seen = json.loads((cfg.state_dir / "seen.json").read_text())
    seen.remove("203924224")
    (cfg.state_dir / "seen.json").write_text(json.dumps(seen))
    feed = go(cfg, site)
    assert feed["new_count"] == 1 and item(feed, "203924224")["new"] is True
    assert go(cfg, site)["new_count"] == 0


def test_enrichment_failure_is_only_a_warning(cfg, site):
    site.responses["routes"] = 500
    feed = go(cfg, site)
    assert feed["status"] == "ok"
    assert "Route type and stars unavailable" in feed["warnings"][0]
    assert item(feed, "203924224")["route_type"] is None


def test_rss_down_falls_back_to_pages(cfg, site):
    go(cfg, site)
    site.responses["rss"] = 503
    feed = go(cfg, site)
    assert (feed["status"], feed["source"]) == ("degraded", "html")
    assert "HTTP 503 after 3 tries" in feed["warnings"][0]
    assert item(feed, "203924224")["route_type"] == "Sport"
    assert item(feed, "203924224")["new"] is False
    assert all(i["published"] >= "2026-09-02" for i in feed["items"])


def test_rss_returning_html_falls_back(cfg, site):
    site.responses["rss"] = site.responses["routes"]
    feed = go(cfg, site)
    assert feed["status"] == "degraded"


def test_empty_rss_after_full_run_is_suspicious(cfg, site):
    go(cfg, site)
    site.responses["rss"] = '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>'
    feed = go(cfg, site)
    assert feed["status"] == "degraded" and "no items" in feed["warnings"][0]


def test_total_failure_keeps_last_good_data(cfg, site):
    good = go(cfg, site)
    for k in site.responses:
        site.responses[k] = httpx.ConnectError("no route to host")
    later = datetime(2026, 10, 4, 9, 30, tzinfo=timezone.utc)
    feed = run(cfg, make_fetcher(site), now=lambda: later)
    assert (feed["status"], feed["source"]) == ("error", "cache")
    assert feed["items"] == good["items"]
    assert feed["last_success"] == NOW.isoformat() and feed["last_attempt"] == later.isoformat()
    assert "RSS feed:" in feed["error"] and "Page scrape:" in feed["error"]


def test_partial_page_scrape_warns_about_missing_tab(cfg, site):
    site.responses["rss"] = 500
    site.responses["comments"] = "<html><body>maintenance</body></html>"
    feed = go(cfg, site)
    assert feed["status"] == "degraded" and feed["counts"]["comment"] == 0
    assert any(w.startswith("Missing comments") for w in feed["warnings"])


def test_parser_bug_is_contained(cfg, site, monkeypatch):
    def boom(*a, **k):
        raise AttributeError("'NoneType' object has no attribute 'text'")

    monkeypatch.setattr(mpmain, "parse_rss", boom)
    feed = go(cfg, site)
    assert feed["status"] == "degraded" and "unexpected AttributeError" in feed["warnings"][0]


def test_corrupt_previous_state_is_ignored(cfg, site):
    (cfg.state_dir / "feed.json").write_text("{not json")
    (cfg.state_dir / "seen.json").write_text("[")
    assert go(cfg, site)["status"] == "ok"


def test_writes_are_atomic(cfg, site):
    go(cfg, site)
    assert sorted(p.name for p in cfg.state_dir.iterdir()) == ["feed.json", "seen.json"]
