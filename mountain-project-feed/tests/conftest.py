from pathlib import Path

import httpx
import pytest

from mpfeed.fetch import Fetcher

FIXTURES = Path(__file__).parent / "fixtures"
AREA_ID = 105800315


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text()


class FakeTime:
    def __init__(self):
        self.t = 1000.0
        self.sleeps: list[float] = []

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.t += seconds

    def clock(self) -> float:
        return self.t


@pytest.fixture
def fake_time():
    return FakeTime()


def make_fetcher(handler, fake_time=None, **kw) -> Fetcher:
    ft = fake_time or FakeTime()
    client = httpx.Client(transport=httpx.MockTransport(handler))
    kw.setdefault("min_interval", 0)
    kw.setdefault("retry_delays", (0, 0))
    return Fetcher(client, sleep=ft.sleep, clock=ft.clock, **kw)


class Site:
    """Fake mountainproject.com: per-endpoint responses, overridable per test."""

    def __init__(self):
        self.responses = {
            "rss": fixture_text("rss.xml"),
            "routes": fixture_text("whats_new_routes.html"),
            "areas": fixture_text("whats_new_areas.html"),
            "comments": fixture_text("whats_new_comments.html"),
        }
        self.hits: list[str] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        key = "rss" if request.url.path.startswith("/rss/") else request.url.params.get("type")
        self.hits.append(key)
        resp = self.responses.get(key)
        if isinstance(resp, Exception):
            raise resp
        if isinstance(resp, int):
            return httpx.Response(resp, text="error")
        return httpx.Response(200, text=resp)


@pytest.fixture
def site():
    return Site()
