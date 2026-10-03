import pytest

from mpfeed import html
from mpfeed.common import StructureError, excerpt, split_grade
from mpfeed.rss import parse_rss

from .conftest import AREA_ID, fixture_text


@pytest.fixture(scope="module")
def rss_items():
    return {i["id"]: i for i in parse_rss(fixture_text("rss.xml"), AREA_ID)}


def test_rss_counts(rss_items):
    kinds = [i["type"] for i in rss_items.values()]
    assert (kinds.count("route"), kinds.count("area"), kinds.count("comment")) == (28, 9, 24)


def test_rss_route(rss_items):
    z = rss_items["203924224"]
    assert z["title"] == "Zebra" and z["grade"] == "5.12a"
    assert z["breadcrumb"] == ["Poudre Canyon", "W of Rustic", "Poudre Falls", "E Side Crags", "Jungle Wall Sport"]
    assert z["author"] == "Harry Harpham"
    assert z["published"] == "2026-09-30T15:38:57+00:00"
    assert z["url"] == "https://www.mountainproject.com/route/203924224/zebra"
    assert z["excerpt"].startswith("Zebra is a section of rock")


def test_rss_area(rss_items):
    a = rss_items["203911115"]
    assert a["type"] == "area" and a["title"] == "West Face"
    assert a["breadcrumb"][0] == "Red Feather Lakes" and a["breadcrumb"][-1] == "Dome with a View"
    assert len(a["excerpt"]) <= 201 and a["excerpt"].endswith("…")


def test_rss_comment_on_route_uses_subject(rss_items):
    c = rss_items["203932663"]
    assert (c["title"], c["grade"], c["subject_type"]) == ("Alpha Omega", "5.13b", "route")
    assert c["breadcrumb"][-1] == "S Wall"
    assert c["excerpt"].startswith("Added a permadraw")
    assert c["author"] == "Briana Arlene"


def test_rss_comment_on_area(rss_items):
    c = rss_items["203925069"]
    assert c["subject_type"] == "area" and c["grade"] is None


def test_photo_comments_get_a_short_title(rss_items):
    c = rss_items["203919575"]
    assert c["subject_type"] == "photo"
    assert c["title"].startswith("In the early '70s") and len(c["title"]) <= 61
    assert c["breadcrumb"] and not any(b.startswith("In the early") for b in c["breadcrumb"])
    rows = {r["id"]: r for r in html.parse_comments_tab(fixture_text("whats_new_comments.html"))}
    assert rows["203919575"]["subject_type"] == "photo" and len(rows["203919575"]["title"]) <= 61


def test_rss_invalid_xml():
    with pytest.raises(StructureError, match="valid XML"):
        parse_rss(fixture_text("rss.xml")[:5000], AREA_ID)


def test_rss_html_instead_of_xml():
    with pytest.raises(StructureError):
        parse_rss(fixture_text("whats_new_routes.html"), AREA_ID)


def test_rss_no_channel():
    with pytest.raises(StructureError, match="channel"):
        parse_rss("<rss version='2.0'></rss>", AREA_ID)


def test_rss_rejects_mostly_unknown_items():
    xml = fixture_text("rss.xml").replace("<title>Route: ", "<title>Climb: ")
    with pytest.raises(StructureError, match="expected format"):
        parse_rss(xml, AREA_ID)


def test_rss_tolerates_a_few_bad_items():
    xml = fixture_text("rss.xml").replace("<title>Area: ", "<title>Crag: ", 2)
    assert len(parse_rss(xml, AREA_ID)) == 59


def test_rss_skips_photos_without_counting_them_bad():
    xml = fixture_text("rss.xml").replace("<title>Route: ", "<title>Photo: ")
    items = parse_rss(xml, AREA_ID)
    assert {i["type"] for i in items} == {"area", "comment"}


def test_routes_tab():
    rows = {r["id"]: r for r in html.parse_routes_tab(fixture_text("whats_new_routes.html"))}
    z = rows["203924224"]
    assert (z["title"], z["grade"], z["route_type"], z["stars"]) == ("Zebra", "5.12a", "Sport", 1.5)
    assert z["author"] == "Harry Harpham"
    assert z["published"] == "2026-09-30T15:38:57+00:00"
    assert any(r["grade"].startswith("V") and r["route_type"].startswith("Boulder") for r in rows.values())


def test_areas_tab():
    rows = {r["id"]: r for r in html.parse_areas_tab(fixture_text("whats_new_areas.html"))}
    w = rows["203911115"]
    assert (w["title"], w["author"]) == ("West Face", "Erica Exline")
    assert w["breadcrumb"][-1] == "Dome with a View"


def test_comments_tab():
    rows = {r["id"]: r for r in html.parse_comments_tab(fixture_text("whats_new_comments.html"))}
    c = rows["203932663"]
    assert (c["title"], c["grade"], c["author"]) == ("Alpha Omega", "5.13b", "Briana Arlene")
    assert c["breadcrumb"] == ["Poudre Canyon", "W of Rustic", "Poudre Falls", "W Side Crags", "S Wall"]
    assert c["excerpt"].startswith("Added a permadraw") and "View Comment" not in c["excerpt"]
    assert c["published"] == "2026-10-02T13:35:19+00:00"


def test_html_ids_and_dates_match_rss(rss_items):
    tabs = (
        html.parse_routes_tab(fixture_text("whats_new_routes.html"))
        + html.parse_areas_tab(fixture_text("whats_new_areas.html"))
        + html.parse_comments_tab(fixture_text("whats_new_comments.html"))
    )
    shared = [t for t in tabs if t["id"] in rss_items]
    assert len(shared) >= 55
    assert all(t["published"] == rss_items[t["id"]]["published"] for t in shared)
    assert all(t["type"] == rss_items[t["id"]]["type"] for t in shared)


def test_html_missing_table():
    with pytest.raises(StructureError, match="route-table"):
        html.parse_routes_tab("<html><body><div id='data-container'></div></body></html>")


def test_split_grade_and_excerpt():
    assert split_grade("Alpha Omega            (5.13b)") == ("Alpha Omega", "5.13b")
    assert split_grade("Low Tide Roof (V3 PG13)") == ("Low Tide Roof", "V3 PG13")
    assert split_grade("North Quarry") == ("North Quarry", None)
    assert excerpt("word " * 100).endswith("…")
