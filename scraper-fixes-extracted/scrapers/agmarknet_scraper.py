"""
Agmarknet direct-scrape — best-effort, self-diagnosing secondary source.

IMPORTANT CONTEXT (read this before debugging a failure here):
  Agmarknet relaunched as "Agmarknet 2.0" in November 2025, replacing the
  entire site. The old ASP.NET form with element ids like cphBody_txtDate
  no longer exists — that is the literal cause of the "Cannot set
  properties of null" error in your original log. The new portal's exact
  DOM structure isn't mapped here yet: it's a JS-rendered page this
  assistant could not inspect directly (the live site blocks automated
  fetches, and the sandbox used to write this code has no network route to
  agmarknet.gov.in to test against).

  This matters less than it sounds: the data.gov.in API
  (see datagovin_client.py) is generated FROM Agmarknet's own backend data,
  so you already get Agmarknet-sourced mandi prices reliably through that
  official, stable JSON API. Treat this module as a free bonus cross-check,
  not a load-bearing source — its failure should never be treated as a
  pipeline-critical error.

  This scraper is written to be self-healing where possible (it searches
  for form fields by label/role/placeholder text instead of hardcoded
  element ids, so small markup tweaks won't break it) and self-diagnosing
  where it can't cope (it drops a screenshot + full HTML to
  data/debug/agmarknet/, uploaded as a GitHub Actions artifact on every
  run). If this keeps returning 0 records, grab the latest screenshot from
  the Actions tab and share it — that turns "guess the new selectors" into
  a two-minute fix.
"""

from __future__ import annotations
import logging
import re
import time
from datetime import date, datetime, timezone
from typing import Optional

from playwright.sync_api import Page, Locator
from bs4 import BeautifulSoup

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market
from debug_utils import dump_diagnostics

logger = logging.getLogger(__name__)

HOME_URL = "https://agmarknet.gov.in/"
LEGACY_URL = "https://agmarknet.gov.in/SearchCommodityDis.aspx"  # pre-relaunch URL; tried as a near-free first attempt

PRICE_LINK_PATTERNS = [
    re.compile(r"price.*search", re.I),
    re.compile(r"daily.*price", re.I),
    re.compile(r"commodity.*wise", re.I),
    re.compile(r"price\s*trend", re.I),
    re.compile(r"\bprice\b", re.I),
]


def _first_visible(locators: list[Locator]) -> Optional[Locator]:
    for loc in locators:
        try:
            if loc.count() > 0 and loc.first.is_visible():
                return loc.first
        except Exception:
            continue
    return None


def _parse_table(html: str, fetched_at: datetime, price_date: date) -> list[PriceRecord]:
    """Parse a results table. Tries the known table id/class first, then
    falls back to scanning all tables for one with price-like headers --
    useful if Agmarknet 2.0 kept a table-based results layout under a new
    id/class name."""
    soup = BeautifulSoup(html, "lxml")
    records: list[PriceRecord] = []

    table = soup.find("table", {"id": "cphBody_GridPriceData"}) or soup.find("table", class_="tableagmark_new")

    if not table:
        for t in soup.find_all("table"):
            header_text = t.get_text(" ", strip=True).lower()[:500]
            if "modal" in header_text and "price" in header_text and "commodity" in header_text:
                table = t
                break

    if not table:
        return records

    rows = table.find_all("tr")[1:]  # skip header
    for row in rows:
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cells) < 8:
            continue
        try:
            raw_state    = cells[0]
            raw_district = cells[1]
            raw_market   = cells[2]
            raw_commodity = cells[3]
            raw_variety  = cells[4] if len(cells) > 4 else ""
            min_price    = float(cells[6].replace(",", "") or 0)
            max_price    = float(cells[7].replace(",", "") or 0)
            modal_price  = float(cells[8].replace(",", "") or 0)
            arrivals_str = cells[9].replace(",", "") if len(cells) > 9 else ""
            arrivals     = float(arrivals_str) if arrivals_str else None

            commodity, _ = normalize_commodity(raw_commodity)
            market, district, state, _ = normalize_market(raw_market, raw_district, raw_state)

            record = PriceRecord(
                source="agmarknet",
                fetched_at=fetched_at,
                price_date=price_date,
                state=state,
                district=district,
                market=market,
                commodity=commodity,
                variety=raw_variety.strip(),
                min_price=max(min_price, 0.01),
                max_price=max(max_price, 0.01),
                modal_price=max(modal_price, 0.01),
                arrivals_tonnes=arrivals,
                raw_source_name=raw_commodity,
            )
            records.append(record)
        except Exception as exc:
            logger.debug("Skipping Agmarknet row %r: %s", cells, exc)

    return records


def _try_legacy_flow(page: Page, target_date: date, fetched_at: datetime) -> list[PriceRecord]:
    """Cheap first attempt: the pre-relaunch ASP.NET flow. Costs only a few
    seconds if it fails, and costs nothing to keep around in case a legacy
    mirror or redirect still serves it."""
    try:
        page.goto(LEGACY_URL, wait_until="domcontentloaded", timeout=20000)
        date_str = target_date.strftime("%d-%b-%Y")
        page.evaluate(f"document.getElementById('cphBody_txtDate').value = '{date_str}';")
        page.locator("#cphBody_ddlCommodity").select_option(value="0")
        page.locator("#cphBody_ddlState").select_option(value="0")
        page.locator("#cphBody_btnGo").click()
        page.wait_for_selector("#cphBody_GridPriceData, #cphBody_lblMessage", timeout=15000)
        html = page.content()
        records = _parse_table(html, fetched_at, target_date)
        if records:
            logger.info("Agmarknet: legacy flow succeeded -- %d records", len(records))
        return records
    except Exception as exc:
        logger.info("Agmarknet: legacy flow unavailable (expected post Agmarknet-2.0 relaunch): %s", exc)
        return []


def _try_flexible_flow(page: Page, target_date: date, fetched_at: datetime) -> list[PriceRecord]:
    """Self-healing attempt against the current (Agmarknet 2.0) site: locate
    the homepage's price-search entry point and the form fields by visible
    text/role rather than hardcoded ids, since the new ids are unknown."""
    try:
        page.goto(HOME_URL, wait_until="domcontentloaded", timeout=30000)
        time.sleep(1)
    except Exception as exc:
        logger.error("Agmarknet: could not load homepage %s: %s", HOME_URL, exc)
        dump_diagnostics(page, "agmarknet", "homepage_load_failed")
        return []

    # Step 1: find a nav link to a price-search-like page and follow it
    nav_link = None
    for pattern in PRICE_LINK_PATTERNS:
        candidate = page.get_by_role("link", name=pattern)
        try:
            if candidate.count() > 0:
                nav_link = candidate.first
                break
        except Exception:
            continue

    if nav_link is not None:
        try:
            nav_link.click(timeout=10000)
            page.wait_for_load_state("domcontentloaded", timeout=20000)
            time.sleep(1)
        except Exception as exc:
            logger.warning("Agmarknet: found a price-search link but couldn't navigate to it: %s", exc)

    # Step 2: try to locate date / commodity / state / submit controls flexibly
    date_field = _first_visible([
        page.get_by_label(re.compile(r"date", re.I)),
        page.get_by_placeholder(re.compile(r"date", re.I)),
        page.locator("input[type='date']"),
    ])
    commodity_field = _first_visible([
        page.get_by_label(re.compile(r"commodity", re.I)),
        page.get_by_role("combobox", name=re.compile(r"commodity", re.I)),
    ])
    state_field = _first_visible([
        page.get_by_label(re.compile(r"^state", re.I)),
        page.get_by_role("combobox", name=re.compile(r"^state", re.I)),
    ])
    submit_btn = _first_visible([
        page.get_by_role("button", name=re.compile(r"search|submit|go|view|show", re.I)),
        page.locator("button[type='submit']"),
        page.locator("input[type='submit']"),
    ])

    if date_field is None or submit_btn is None:
        logger.warning(
            "Agmarknet: could not locate the price-search form on the new site "
            "(date_field=%s, commodity_field=%s, state_field=%s, submit_btn=%s)",
            date_field is not None, commodity_field is not None,
            state_field is not None, submit_btn is not None,
        )
        dump_diagnostics(page, "agmarknet", "form_fields_not_found")
        return []

    try:
        try:
            input_type = date_field.get_attribute("type")
        except Exception:
            input_type = None
        if input_type == "date":
            date_field.fill(target_date.strftime("%Y-%m-%d"))
        else:
            date_field.fill(target_date.strftime("%d-%b-%Y"))

        if commodity_field is not None:
            try:
                commodity_field.select_option(label=re.compile(r"all", re.I))
            except Exception:
                logger.debug("Agmarknet: commodity field is not a plain <select>, leaving default")
        if state_field is not None:
            try:
                state_field.select_option(label=re.compile(r"all", re.I))
            except Exception:
                logger.debug("Agmarknet: state field is not a plain <select>, leaving default")

        submit_btn.click(timeout=10000)
        page.wait_for_load_state("networkidle", timeout=20000)
        time.sleep(1)
    except Exception as exc:
        logger.error("Agmarknet: failed to fill/submit the form on the new site: %s", exc)
        dump_diagnostics(page, "agmarknet", "form_submit_failed")
        return []

    html = page.content()
    records = _parse_table(html, fetched_at, target_date)
    if not records:
        logger.warning("Agmarknet: form submitted but no recognizable results table was found")
        dump_diagnostics(page, "agmarknet", "no_results_table")

    return records


def scrape_agmarknet(target_date: date, page: Page) -> list[PriceRecord]:
    """
    Best-effort Agmarknet scrape. Tries the legacy flow first (free,
    near-instant if it fails), then a self-healing flow against the
    relaunched Agmarknet 2.0 site. Returns [] (never raises) if both fail --
    data.gov.in already covers this same underlying data reliably, so a
    failure here should never be treated as a pipeline-critical error.
    """
    fetched_at = datetime.now(tz=timezone.utc)
    logger.info("Agmarknet: starting scrape for %s", target_date)

    records = _try_legacy_flow(page, target_date, fetched_at)
    if records:
        logger.info("Agmarknet: finished -- %d total records for %s", len(records), target_date)
        return records

    records = _try_flexible_flow(page, target_date, fetched_at)
    logger.info("Agmarknet: finished -- %d total records for %s", len(records), target_date)
    return records
