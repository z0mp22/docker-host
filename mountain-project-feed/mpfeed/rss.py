"""Parse Mountain Project's per-area 'What's New' RSS feed (/rss/new?selectedIds=...)."""

from __future__ import annotations

import re
import warnings
from datetime import timezone
from email.utils import parsedate_to_datetime
from xml.etree.ElementTree import ParseError

from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
from defusedxml import DefusedXmlException
from defusedxml.ElementTree import fromstring

from .common import (
    PHOTO_TITLE_MAX,
    StructureError,
    breadcrumb_below,
    check_bad_ratio,
    clean,
    excerpt,
    object_ref,
    split_grade,
)

PREFIXES = {"Route": "route", "Area": "area", "Comment re": "comment"}
# Types MP can include that we deliberately don't show; skipped, not counted as malformed.
IGNORED_PREFIXES = {"Photo", "Tick"}

_GUID = re.compile(r"MPObject_(\d+)")
_BR = re.compile(r"<br\s*/?>", re.I)
_TRAILING_BR = re.compile(r"(?:\s|<br\s*/?>)+$", re.I)

_SKIP = object()


def _text(fragment: str) -> str:
    # Short bodies like "5.9+" trip bs4's "this looks like a filename" heuristic.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", MarkupResemblesLocatorWarning)
        return BeautifulSoup(fragment, "html.parser").get_text(" ")


def parse_rss(xml_text: str, area_id: int) -> list[dict]:
    try:
        root = fromstring(xml_text)
    except (ParseError, DefusedXmlException) as exc:
        raise StructureError(f"RSS isn't valid XML ({exc})") from exc
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise StructureError("RSS has no <channel>")

    raw = channel.findall("item")
    items: list[dict] = []
    bad = considered = 0
    for el in raw:
        item = _parse_item(el, area_id)
        if item is _SKIP:
            continue
        considered += 1
        if item is None:
            bad += 1
        else:
            items.append(item)
    check_bad_ratio(bad, considered, "RSS items")
    return items


def _parse_item(el, area_id: int):
    title = clean(el.findtext("title"))
    link = clean(el.findtext("link"))
    guid = clean(el.findtext("guid"))
    pub = clean(el.findtext("pubDate"))
    if not (title and link and guid and pub):
        return None

    prefix, _, rest = title.partition(": ")
    if prefix in IGNORED_PREFIXES:
        return _SKIP
    kind = PREFIXES.get(prefix)
    gm = _GUID.fullmatch(guid)
    if kind is None or not gm:
        return None
    try:
        published = parsedate_to_datetime(pub).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return None

    body_html, chain, author = _split_description(el.findtext("description") or "")
    body = excerpt(_text(body_html))
    item = {
        "id": gm.group(1),
        "type": kind,
        "title": rest,
        "grade": None,
        "route_type": None,
        "stars": None,
        "breadcrumb": [],
        "url": link,
        "published": published,
        "author": author,
        "excerpt": body,
    }

    if kind == "route":
        item["title"], item["grade"] = split_grade(rest)
        item["breadcrumb"] = breadcrumb_below(chain, area_id)
    elif kind == "area":
        item["breadcrumb"] = breadcrumb_below(chain, area_id)
    else:
        link_ref = object_ref(link)
        subject = chain[-1] if chain else None
        ref = object_ref(subject[1]) if subject else None
        if link_ref and link_ref[0] == "photo":
            # Photo comments carry the caption where a route/area name would be, and no breadcrumb.
            item["title"] = excerpt(rest.partition(": ")[0], PHOTO_TITLE_MAX)
            item["subject_type"] = "photo"
            areas = [c for c in chain if (object_ref(c[1]) or ("",))[0] != "photo"]
            item["breadcrumb"] = breadcrumb_below(areas, area_id)
        elif subject and ref:
            # The comment's subject (route or area) is the last link in the chain.
            item["title"], item["grade"] = split_grade(subject[0])
            item["subject_type"] = ref[0]
            item["breadcrumb"] = breadcrumb_below(chain[:-1], area_id)
        else:
            item["title"] = rest.partition(": ")[0]
            item["subject_type"] = link_ref[0] if link_ref else None
    if not item["title"]:
        return None
    return item


def _split_description(desc: str) -> tuple[str, list[tuple[str, str]], str | None]:
    """Description is 'BODY<br>[img<br>]A > B > C<br>Shared By: NAME'."""
    author = None
    head = desc
    i = desc.rfind("Shared By:")
    if i >= 0:
        author = clean(_text(desc[i + len("Shared By:") :])) or None
        head = desc[:i]
    head = _TRAILING_BR.sub("", head)
    brs = list(_BR.finditer(head))
    if brs:
        body_html, chain_html = head[: brs[-1].start()], head[brs[-1].end() :]
    else:
        body_html, chain_html = "", head
    chain = [
        (clean(a.get_text()), a.get("href", ""))
        for a in BeautifulSoup(chain_html, "html.parser").find_all("a")
    ]
    return body_html, chain, author
