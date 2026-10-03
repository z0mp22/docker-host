import httpx
import pytest

from mpfeed.fetch import USER_AGENT, FetchError, make_client

from .conftest import make_fetcher


def sequence(*responses):
    calls = []

    def handler(request):
        calls.append(request)
        r = responses[len(calls) - 1]
        if isinstance(r, Exception):
            raise r
        return r

    handler.calls = calls
    return handler


def test_retries_5xx_with_backoff(fake_time):
    h = sequence(httpx.Response(503), httpx.Response(502), httpx.Response(200, text="ok"))
    f = make_fetcher(h, fake_time, min_interval=60, retry_delays=(60, 180))
    assert f.get("https://x/") == "ok"
    assert fake_time.sleeps == [60, 180]
    assert f.requests == 3


def test_honors_retry_after_on_429(fake_time):
    h = sequence(httpx.Response(429, headers={"Retry-After": "300"}), httpx.Response(200, text="ok"))
    f = make_fetcher(h, fake_time, min_interval=60, retry_delays=(60, 180))
    assert f.get("https://x/") == "ok"
    assert fake_time.sleeps == [300]


def test_retry_after_is_capped(fake_time):
    h = sequence(httpx.Response(429, headers={"Retry-After": "86400"}), httpx.Response(200, text="ok"))
    make_fetcher(h, fake_time, retry_delays=(60,)).get("https://x/")
    assert fake_time.sleeps == [600]


def test_client_error_fails_fast(fake_time):
    h = sequence(httpx.Response(404))
    f = make_fetcher(h, fake_time, retry_delays=(60, 180))
    with pytest.raises(FetchError, match="HTTP 404"):
        f.get("https://x/")
    assert len(h.calls) == 1 and fake_time.sleeps == []


def test_gives_up_after_all_attempts(fake_time):
    h = sequence(httpx.Response(503), httpx.Response(503), httpx.Response(503))
    with pytest.raises(FetchError, match="HTTP 503 after 3 tries"):
        make_fetcher(h, fake_time, retry_delays=(60, 180)).get("https://x/")


def test_network_errors_are_retried(fake_time):
    h = sequence(httpx.ConnectError("refused"), httpx.Response(200, text="ok"))
    assert make_fetcher(h, fake_time, retry_delays=(60,)).get("https://x/") == "ok"


def test_spaces_requests_by_crawl_delay(fake_time):
    h = sequence(httpx.Response(200, text="a"), httpx.Response(200, text="b"))
    f = make_fetcher(h, fake_time, min_interval=60)
    f.get("https://x/1")
    fake_time.t += 5
    f.get("https://x/2")
    assert fake_time.sleeps == [55]


def test_client_identifies_itself():
    with make_client() as c:
        assert c.headers["User-Agent"] == USER_AGENT
