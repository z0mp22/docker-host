#!/usr/bin/env python3
"""Fetch the prices behind the HVAC cost model (homeassistant/config/packages/hvac_cost.yaml).

Fort Collins ToD electric rates -> input_number.fc_rate_* / fc_rates_year
Xcel marginal residential gas $/therm -> input_number.hvac_gas_usd_per_therm

Writes $STATE_DIR/prices.json; scripts/run-prices.sh publishes it to HA's config dir, where
sensor.hvac_prices_feed reads it and an automation applies the prices. Both sites need a real
browser (Akamai bot wall; Salesforce file viewer), hence Chromium in the image.
"""
import html
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

STATE_DIR = Path(os.environ.get("STATE_DIR", "/state"))
CHROMIUM = os.environ.get("CHROMIUM", "/usr/bin/chromium")
FC_URL = "https://www.fortcollins.gov/Services/Utilities/Pay-My-Bill/Rates"
XCEL_RATE_BOOKS = "https://www.xcelenergy.com/company/rates_and_regulations/rates/rate_books"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

# Charged on top of Xcel's per-therm rates; effective values from the Sep 2026 bill.
FRANCHISE_FEE = 0.0107
SALES_TAX = 0.0424
# fc_tod.jinja hardcodes the peak windows and holidays, so a change there needs a code change.
PEAK_PM = {"summer": (2, 7), "winter": (5, 9)}
HOLIDAYS = "New Year's Day, Memorial Day, Fourth of July, Labor Day, Thanksgiving and Christmas (as observed)"
BOUNDS = {"on_peak": (0.10, 0.80), "off_peak": (0.03, 0.40), "gas": (0.30, 3.00)}


class PriceError(Exception):
    pass


def fetch_fc(page):
    page.goto(FC_URL, wait_until="networkidle", timeout=90000)
    text = re.sub(r"\s+", " ", page.evaluate("document.body.textContent")).replace("’", "'")
    year = re.search(r"The (20\d\d) rates are listed below", text)
    table = re.search(
        r"Time-of-Day Season Times Rate "
        r"Summer May-September On-peak: Monday-Friday, (\d+)-(\d+) p\.m\. ([\d.]+)¢ / kWh "
        r"Summer May-September Off-peak: [^¢]*?([\d.]+)¢ / kWh "
        r"Non-summer October-April On-peak: Monday-Friday, (\d+)-(\d+) p\.m\. ([\d.]+)¢ / kWh "
        r"Non-summer October-April Off-peak: [^¢]*?([\d.]+)¢ / kWh \*([^*]+?\(as observed\))",
        text,
    )
    if not year or not table:
        raise PriceError("Fort Collins rates page layout changed; couldn't find the 'Time-of-Day' table")
    g = table.groups()
    if (int(g[0]), int(g[1])) != PEAK_PM["summer"] or (int(g[4]), int(g[5])) != PEAK_PM["winter"]:
        raise PriceError(f"Fort Collins peak hours changed (summer {g[0]}-{g[1]}, winter {g[4]}-{g[5]} p.m.); update fc_tod.jinja")
    if g[8].strip() != HOLIDAYS:
        raise PriceError(f"Fort Collins off-peak holidays changed ({g[8].strip()}); update fc_tod.jinja")
    rates = {
        "summer_on_peak": round(float(g[2]) / 100, 5),
        "summer_off_peak": round(float(g[3]) / 100, 5),
        "winter_on_peak": round(float(g[6]) / 100, 5),
        "winter_off_peak": round(float(g[7]) / 100, 5),
    }
    for k, v in rates.items():
        lo, hi = BOUNDS["on_peak" if k.endswith("on_peak") else "off_peak"]
        if not lo <= v <= hi:
            raise PriceError(f"Fort Collins {k} rate {v} is outside {lo}-{hi} $/kWh; not applying")
    return {"year": int(year.group(1)), **rates}


def latest_gas_summary_link():
    req = urllib.request.Request(XCEL_RATE_BOOKS, headers={"User-Agent": UA})
    page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    found = []
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page, re.I | re.S):
        label = html.unescape(re.sub(r"<[^>]+>", "", label))
        m = re.search(r"Gas Rates as of (\d{1,2})-(\d{1,2})-(\d{2,4})", label)
        if m:
            mo, dy, yr = (int(x) for x in m.groups())
            found.append((date(yr + 2000 if yr < 100 else yr, mo, dy), html.unescape(href)))
    current = [f for f in found if f[0] <= date.today()]
    if not current:
        raise PriceError("no 'Summary of Gas Rates' links found on Xcel's rate books page")
    return max(current)


def fetch_xcel(ctx):
    as_of, link = latest_gas_summary_link()
    page = ctx.new_page()
    renditions = []
    page.on("request", lambda r: renditions.append(r.url) if "renditionDownload" in r.url else None)
    page.goto(link, wait_until="networkidle", timeout=90000)
    page.close()
    if not renditions:
        raise PriceError("Xcel's Salesforce file viewer changed; no document version found")
    url = urllib.parse.urlparse(renditions[0])
    q = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}
    download = (
        f"https://{url.netloc}/sfc/dist/version/download/?oid={q['oid']}&ids={q['versionId']}"
        f"&d={urllib.parse.quote(q['d'])}&operationContext=DELIVERY"
    )
    pdf = ctx.request.get(download, timeout=90000).body()
    if not pdf.startswith(b"%PDF-"):
        raise PriceError("Xcel gas summary download didn't return a PDF")
    text = subprocess.run(["pdftotext", "-layout", "-", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    effective = re.search(r"Effective (\w+ \d{1,2}, \d{4})", text)
    residential = text[text.find("Residential"):]
    row = re.search(
        r"Usage Charge per Therm\s+\$([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s+\$([\d.]+)\s+\$([\d.]+)\s+\$([\d.]+)",
        residential,
    )
    if "Residential" not in text or not row or not effective:
        raise PriceError("Xcel gas summary layout changed; couldn't read the Residential usage row")
    usage, grsa, dsm, egcrr, gca, total = (float(x) for x in row.groups())
    # GRSA and DSMCA are percentages of the base usage charge; the PDF's own total must agree.
    computed = usage * (1 + grsa / 100 + dsm / 100) + egcrr + gca
    if abs(computed - total) > 0.0006:
        raise PriceError(f"Xcel gas components don't add up ({computed:.4f} vs total {total:.4f}); not applying")
    marginal = round(total * (1 + FRANCHISE_FEE) * (1 + SALES_TAX), 4)
    lo, hi = BOUNDS["gas"]
    if not lo <= marginal <= hi:
        raise PriceError(f"Xcel gas price {marginal} is outside {lo}-{hi} $/therm; not applying")
    eff = datetime.strptime(effective.group(1), "%B %d, %Y").date()
    return {"effective": eff, "summary_as_of": as_of, "per_therm_before_tax": total, "gca": gca, "marginal": marginal}


def main():
    out = STATE_DIR / "prices.json"
    try:
        previous = json.loads(out.read_text())
    except (OSError, ValueError):
        previous = {}

    errors, prices, notes, details = [], {}, [], {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(user_agent=UA)
        try:
            fc = fetch_fc(ctx.new_page())
            details["fc"] = fc
            if fc["year"] > date.today().year:
                notes.append(f"FC {fc['year']} rates published, applying in January")
            else:
                prices.update({f"input_number.fc_rate_{k}": v for k, v in fc.items() if k != "year"})
                prices["input_number.fc_rates_year"] = fc["year"]
                notes.append(f"FC {fc['year']} rates")
        except Exception as e:
            errors.append(f"FC: {e}")
        try:
            gas = fetch_xcel(ctx)
            details["xcel"] = {k: str(v) if isinstance(v, date) else v for k, v in gas.items()}
            prices["input_number.hvac_gas_usd_per_therm"] = gas["marginal"]
            notes.insert(0, f"Xcel {gas['effective']:%b %-d %Y} ${gas['marginal']:.3f}/therm")
        except Exception as e:
            errors.append(f"Xcel: {e}")
        browser.close()

    now = datetime.now().astimezone().isoformat(timespec="seconds")
    feed = {
        "schema": 1,
        "status": "error" if errors else "ok",
        "last_attempt": now,
        "last_success": now if not errors else previous.get("last_success"),
        "summary": " · ".join(notes),
        "errors": errors,
        "prices": prices,
        "details": details,
    }
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(feed, indent=1))
    tmp.replace(out)
    print(json.dumps(feed, indent=1))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
