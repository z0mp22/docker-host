"""Polite HTTP fetching: one request per crawl-delay window, retries with backoff."""

from __future__ import annotations

import time
from typing import Callable, Sequence

import httpx

USER_AGENT = "docker-host-mp-feed/1.0 (personal Home Assistant dashboard; nightly)"
MAX_RETRY_AFTER = 600


class FetchError(Exception):
    pass


def make_client(timeout: float = 30.0) -> httpx.Client:
    return httpx.Client(timeout=timeout, follow_redirects=True, headers={"User-Agent": USER_AGENT})


class Fetcher:
    def __init__(
        self,
        client: httpx.Client,
        *,
        min_interval: float = 60.0,
        retry_delays: Sequence[float] = (60.0, 180.0),
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.client = client
        self.min_interval = min_interval
        self.retry_delays = list(retry_delays)
        self.sleep = sleep
        self.clock = clock
        self._last_request: float | None = None
        self.requests = 0

    def _wait_turn(self) -> None:
        # robots.txt asks for Crawl-delay: 60, so every request (including retries) waits its turn.
        if self._last_request is not None:
            wait = self.min_interval - (self.clock() - self._last_request)
            if wait > 0:
                self.sleep(wait)
        self._last_request = self.clock()

    def get(self, url: str) -> str:
        attempts = len(self.retry_delays) + 1
        last_error = "no attempt made"
        for attempt in range(attempts):
            self._wait_turn()
            self.requests += 1
            retry_after = 0.0
            try:
                resp = self.client.get(url)
            except httpx.HTTPError as exc:
                last_error = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
            else:
                if resp.status_code == 200:
                    return resp.text
                last_error = f"HTTP {resp.status_code}"
                if resp.status_code != 429 and resp.status_code < 500:
                    raise FetchError(last_error)
                retry_after = _retry_after_seconds(resp.headers.get("Retry-After"))
            if attempt < attempts - 1:
                self.sleep(max(self.retry_delays[attempt], retry_after))
        raise FetchError(f"{last_error} after {attempts} tries")


def _retry_after_seconds(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return min(float(value), MAX_RETRY_AFTER)
    except ValueError:
        return 0.0
