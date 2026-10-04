#!/usr/bin/env python3
"""Refresh the HVAC cost prices in Home Assistant (homeassistant/config/packages/hvac_cost.yaml).

Fort Collins ToD electric rates -> input_number.fc_rate_* / fc_rates_year
Xcel marginal residential gas $/therm -> input_number.hvac_gas_usd_per_therm
Result line -> input_text.hvac_prices_status (shown on the /hvac panel)

Both sites need a real browser (Akamai bot wall; Salesforce file viewer), so this runs on
a machine with Playwright + Chromium, from the systemd user timer next to this file.
Usage: update_hvac_prices.py [--dry-run]
"""
import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

HA_URL = os.environ.get("HA_URL", "http://10.0.0.4:8123")
TOKEN_FILE = Path(os.environ.get("HA_TOKEN_FILE", "~/.config/hvac-prices/ha_token")).expanduser()
CHROMIUM = os.environ.get("CHROMIUM", "/snap/bin/chromium")
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


def ha(token, method, path, body=None):
    req = urllib.request.Request(
        f"{HA_URL}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or "null")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, don't write to Home Assistant")
    args = ap.parse_args()
    token = os.environ.get("HA_TOKEN") or TOKEN_FILE.read_text().strip()

    errors, targets, notes = [], {}, []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox"])
        ctx = browser.new_context(user_agent=UA)
        try:
            fc = fetch_fc(ctx.new_page())
            if fc["year"] > date.today().year:
                notes.append(f"FC {fc['year']} rates published, applying in January")
            else:
                targets.update({f"input_number.fc_rate_{k}": v for k, v in fc.items() if k != "year"})
                targets["input_number.fc_rates_year"] = fc["year"]
                notes.append(f"FC {fc['year']} rates")
            print("Fort Collins:", fc)
        except Exception as e:
            errors.append(f"FC: {e}")
        try:
            gas = fetch_xcel(ctx)
            targets["input_number.hvac_gas_usd_per_therm"] = gas["marginal"]
            notes.insert(0, f"Xcel {gas['effective']:%b %-d %Y} ${gas['marginal']:.3f}/therm")
            print("Xcel:", gas)
        except Exception as e:
            errors.append(f"Xcel: {e}")
        browser.close()

    changes = []
    for entity, new in list(targets.items()):
        try:
            old = ha(token, "GET", f"/api/states/{entity}")["state"]
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
            errors.append(f"{entity} doesn't exist in HA; deploy packages/hvac_cost.yaml")
            continue
        try:
            changed = abs(float(old) - float(new)) > 1e-6
        except ValueError:
            changed = True
        if changed:
            changes.append((entity, old, new))
    stamp = datetime.now().astimezone().isoformat(timespec="minutes")
    status = f"{stamp} {'error · ' + ' | '.join(errors) if errors else 'ok'} · {' · '.join(notes)}"[:255]
    print("changes:", changes or "none")
    print("status:", status)
    if args.dry_run:
        return 1 if errors else 0

    for entity, _, new in changes:
        ha(token, "POST", "/api/services/input_number/set_value", {"entity_id": entity, "value": new})
    ha(token, "POST", "/api/services/input_text/set_value", {"entity_id": "input_text.hvac_prices_status", "value": status})
    if changes or errors:
        lines = [f"- {e.split('.', 1)[1]}: {o} → {n}" for e, o, n in changes] + [f"- ⚠ {e}" for e in errors]
        ha(token, "POST", "/api/services/persistent_notification/create", {
            "notification_id": "hvac_prices",
            "title": "HVAC price update failed" if errors else "HVAC prices updated",
            "message": "\n".join(lines),
        })
    return 1 if errors else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PriceError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
