# ADR 0004: Mountain Project "What's New" feed: RSS first, page scrape as fallback

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Cody
- **Tags:** mountain-project-feed, home-assistant, climbing-panel, scraping

## Context

Cody wants Mountain Project's "What's New" for the Fort Collins area (new routes, areas and
comments; no photos or ticks) on a Home Assistant panel. It should be refreshed nightly by a
container on this host, cope with the source failing, and show on the dashboard when it fails.

Mountain Project has no public API. It does have two server-rendered sources for the same data:

- **Per-area RSS** (`/rss/new?selectedIds=<area>&routes=on&areas=on&comments=on`), linked from
  the What's New page. It's XML with a stable `guid` (`MPObject_<id>`), `pubDate`, a typed title
  (`Route:` / `Area:` / `Comment re:`), the grade, the area breadcrumb and the author, covering
  about 30 days.
- **The What's New HTML tabs** (`/whats-new?type=routes|areas|comments&locationId=<area>`).
  They carry the same ids and identical timestamps (`data-older`), plus route type
  (Sport/Trad/Boulder) and stars, which the RSS lacks.

robots.txt asks for `Crawl-delay: 60` and disallows `/ajax*` and `/data*`, which rules out the
"Show more" endpoint.

## Decision

1. **RSS is the primary source.** It's a supported format that changes far less often than page
   markup, and one request covers all three types.
2. **The routes tab enriches RSS** with type and stars. If that fails, it's only a warning.
3. **The HTML tabs are the fallback** when RSS fails after retries or fails validation (bad
   XML, >20 % unrecognised items, or empty after a populated run). The fallback produces the
   same ids and dates, so it doesn't create false "new" badges.
4. **When everything fails, the last good list is kept.** `status: error` and the error are
   recorded, and `last_success` is left alone.
5. **Being polite:** an honest User-Agent, one request per 60 s (retries included), 3 attempts
   with 60 s / 180 s backoff and `Retry-After` honoured, 4xx (except 429) fails fast. That's 2
   requests a night normally and 5 in fallback.
6. **Failures surface on the dashboard only**, as Cody chose: no push and no persistent
   notification. The panel separates *can't read the data* (no file), *the update failed*
   (both sources down, or the container died, in which case the host wrapper records it),
   *it stopped running* (no attempt in 26 h) and *partial* (fallback or missing details).
7. **The container only mounts its own state dir.** It runs read-only, with no capabilities, as
   uid 1000. The wrapper copies `feed.json` into the HA config dir, so the container never sees
   `secrets.yaml`.

## Consequences

- If Mountain Project changes both the RSS and the page markup, the panel shows *Update failed*
  with the parser's error, and the fixtures in `mountain-project-feed/tests/fixtures/` need
  recapturing.
- The "new" badge means new since the previous successful night, not since you last opened
  the panel.
- Breadcrumb names are MP's short forms (e.g. "Horsetooth Rese…", "W Side Crags").
