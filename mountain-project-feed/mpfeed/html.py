"""Parse the server-rendered What's New tabs (/whats-new?type=routes|areas|comments).

Used to enrich RSS routes with type and stars, and as the fallback source if RSS breaks.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup

from .common import PHOTO_TITLE_MAX, StructureError, check_bad_ratio, clean, excerpt, object_ref

_COMMENT_ID = re.compile(r"#Comment-(\d+)")
_TRAILING_GRADE = re.compile(
    r"^(.*?)\s+((?:5\.\d+[a-d]?(?:[/+-][a-d]?)?|V\d+(?:[+-]\d*)?|WI\d\+?|M\d+|AI\d|A\d|C\d|5th|4th|3rd)"
    r"(?:\s+(?:PG13|R|X))?)$"
)


def parse_routes_tab(html: str) -> list[dict]:
    rows = _rows(html, "route-table.hidden-xs-down", "route-row")
    items, bad = [], 0
    for row in rows:
        item = _route_row(row)
        if item is None:
            bad += 1
        else:
            items.append(item)
    check_bad_ratio(bad, len(rows), "route rows")
    return items


def parse_areas_tab(html: str) -> list[dict]:
    rows = _rows(html, "area-table.hidden-sm-up", "area-row")
    items, bad = [], 0
    for row in rows:
        item = _area_row(row)
        if item is None:
            bad += 1
        else:
            items.append(item)
    check_bad_ratio(bad, len(rows), "area rows")
    return items


def parse_comments_tab(html: str) -> list[dict]:
    rows = _rows(html, "comment-table", "comment-row")
    items, bad = [], 0
    for row in rows:
        item = _comment_row(row)
        if item is None:
            bad += 1
        else:
            items.append(item)
    check_bad_ratio(bad, len(rows), "comment rows")
    return items


def route_details(html: str) -> dict[str, dict]:
    """route id -> {route_type, stars} for joining onto RSS items."""
    return {
        r["id"]: {"route_type": r["route_type"], "stars": r["stars"]} for r in parse_routes_tab(html)
    }


def _rows(html: str, table_cls: str, row_cls: str):
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one(f"#data-container table.{table_cls}")
    if table is None:
        raise StructureError(f"What's New page has no {table_cls.split('.')[0]}")
    return table.select(f"tr.{row_cls}")


def _published(row) -> str | None:
    el = row.select_one("span.new-indicator[data-older]")
    try:
        return datetime.fromtimestamp(int(el["data-older"]), timezone.utc).isoformat()
    except (TypeError, ValueError, KeyError):
        return None


def _crumbs(container) -> list[str]:
    if container is None:
        return []
    return [clean(a.get_text()) for a in container.find_all("a") if object_ref(a.get("href"))]


def _base(kind, id_, title, url, published) -> dict:
    return {
        "id": id_,
        "type": kind,
        "title": title,
        "grade": None,
        "route_type": None,
        "stars": None,
        "breadcrumb": [],
        "url": url,
        "published": published,
        "author": None,
        "excerpt": "",
    }


def _route_row(row) -> dict | None:
    tds = row.find_all("td", recursive=False)
    if len(tds) < 5:
        return None
    link = tds[0].find("a", href=re.compile(r"/route/\d+"))
    ref = object_ref(link.get("href")) if link else None
    published = _published(row)
    if not ref or not published:
        return None
    item = _base("route", ref[1], clean(link.get_text()), link["href"], published)
    item["breadcrumb"] = _crumbs(tds[1])

    stars = 0.0
    for img in tds[2].find_all("img"):
        src = img.get("src", "")
        if "starBlueHalf" in src:
            stars += 0.5
        elif "starBlue" in src:
            stars += 1
    item["stars"] = stars

    grade = tds[3].select_one("span.rateYDS")
    item["grade"] = clean(grade.get_text()) if grade else None
    meta = tds[3].select_one("span.small")
    if meta:
        kinds = [clean(s.get_text()) for s in meta.find_all("span", recursive=False) if not s.get("class")]
        item["route_type"] = next((k for k in kinds if k), None)

    age = tds[4].select_one("span.text-nowrap")
    if age:
        age.extract()
    item["author"] = clean(tds[4].get_text()) or None
    return item


def _area_row(row) -> dict | None:
    link = row.find("a", class_="area-row")
    ref = object_ref(link.get("href")) if link else None
    name = link.find("strong") if link else None
    published = _published(row)
    if not ref or not name or not published:
        return None
    item = _base("area", ref[1], clean(name.get_text()), link["href"], published)
    meta = link.select_one("div.small")
    if meta:
        item["breadcrumb"] = _crumbs(meta)
        m = re.search(r"\bby\s+(.+?)\s*$", clean(meta.find(string=True, recursive=False) or ""))
        item["author"] = m.group(1) if m else None
    return item


def _comment_row(row) -> dict | None:
    td = row.find("td")
    view = td.find("a", href=_COMMENT_ID) if td else None
    subject = td.select_one("div.mb-half strong a") if td else None
    published = _published(row)
    if not view or not subject or not published:
        return None
    ref = object_ref(subject.get("href"))
    name = clean(subject.get_text())
    grade = None
    if ref and ref[0] == "route":
        m = _TRAILING_GRADE.match(name)
        if m:
            name, grade = m.group(1), m.group(2)
    elif ref and ref[0] == "photo":
        name = excerpt(name, PHOTO_TITLE_MAX)
    item = _base("comment", _COMMENT_ID.search(view["href"]).group(1), name, view["href"], published)
    item["grade"] = grade
    item["subject_type"] = ref[0] if ref else None
    user = td.find("a", href=re.compile(r"/user/\d+"))
    item["author"] = clean(user.get_text()) if user else None
    item["breadcrumb"] = _crumbs(td.select_one("div.text-warm.mb-half"))
    body = td.select_one("div.row")
    if body:
        for el in body.find_all("a") + body.select("span.new-indicator"):
            el.extract()
        item["excerpt"] = excerpt(body.get_text(" "))
    return item
