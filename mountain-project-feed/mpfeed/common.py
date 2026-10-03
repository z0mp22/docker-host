from __future__ import annotations

import re

EXCERPT_MAX = 200
# Comments on photos are titled by the photo caption, which can be a paragraph.
PHOTO_TITLE_MAX = 60
BAD_ITEM_RATIO = 0.2

_WS = re.compile(r"\s+")
_GRADE = re.compile(r"^(.*?)\s*\(([^()]*)\)\s*$")
_OBJ = re.compile(r"/(route|area|photo)/(\d+)")


class StructureError(Exception):
    """The source answered, but not in the shape we know how to read."""


def clean(text: str | None) -> str:
    return _WS.sub(" ", text or "").strip()


def excerpt(text: str | None, limit: int = EXCERPT_MAX) -> str:
    text = clean(text)
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,.;:-")
    return f"{cut}…"


def split_grade(text: str) -> tuple[str, str | None]:
    text = clean(text)
    m = _GRADE.match(text)
    if not m:
        return text, None
    return m.group(1), clean(m.group(2)) or None


def object_ref(href: str | None) -> tuple[str, str] | None:
    m = _OBJ.search(href or "")
    return (m.group(1), m.group(2)) if m else None


def breadcrumb_below(anchors: list[tuple[str, str]], area_id: int) -> list[str]:
    """Breadcrumb names below the configured area (drops 'Colorado > Ft Collins')."""
    marker = f"/area/{area_id}/"
    for i, (_, href) in enumerate(anchors):
        if marker in href:
            return [t for t, _ in anchors[i + 1 :] if t]
    return [t for t, _ in anchors if t]


def check_bad_ratio(bad: int, total: int, what: str) -> None:
    if total and bad / total > BAD_ITEM_RATIO:
        raise StructureError(f"{bad} of {total} {what} didn't match the expected format")
