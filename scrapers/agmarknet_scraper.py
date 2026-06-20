"""
Agmarknet scraper — hits the ASP.NET form portal at agmarknet.gov.in.
Handles __VIEWSTATE / __EVENTVALIDATION token handshake and pagination.

Usage:
    records = scrape_agmarknet(date.today())
"""

from __future__ import annotations
import logging
import time
import random
from datetime import date, datetime, timezone
from typing import Optional

import requests
import cloudscraper
from bs4 import BeautifulSoup

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

BASE_URL = "https://agmarknet.gov.in/SearchCommodityDis.aspx"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": "https://agmarknet.gov.in/",
}


def _get_viewstate(session: requests.Session) -> dict[str, str]:
    """Fetch the landing page and extract ASP.NET hidden form tokens."""
    resp = session.get(BASE_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    def _val(name: str) -> str:
        el = soup.find("input", {"name": name})
        return el["value"] if el else ""

    return {
        "__VIEWSTATE": _val("__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": _val("__VIEWSTATEGENERATOR"),
        "__EVENTVALIDATION": _val("__EVENTVALIDATION"),
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
    }


def _parse_table(soup: BeautifulSoup, fetched_at: datetime, price_date: date) -> list[PriceRecord]:
    """Parse the results table from a response page."""
    records: list[PriceRecord] = []
    table = soup.find("table", {"id": "cphBody_GridPriceData"})
    if not table:
        # Try alternate table IDs used in some responses
        table = soup.find("table", class_="tableagmark_new")
    if not table:
        logger.warning("No data table found in Agmarknet response")
        return records

    rows = table.find_all("tr")[1:]  # skip header
    for row in rows:
        cells = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cells) < 8:
            continue
        try:
            # Column order: State, District, Market, Commodity, Variety, Grade, Min, Max, Modal, Arrivals
            # (column order can vary; index by known header positions)
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


def scrape_agmarknet(
    target_date: date,
    state_code: str = "0",  # "0" = All States
    commodity_code: str = "0",  # "0" = All Commodities
    max_pages: int = 50,
) -> list[PriceRecord]:
    """
    Scrape Agmarknet for a given date.
    Returns list of normalized PriceRecord objects.
    """
    session = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
    fetched_at = datetime.now(tz=timezone.utc)
    all_records: list[PriceRecord] = []

    logger.info("Agmarknet: starting scrape for %s", target_date)

    try:
        viewstate = _get_viewstate(session)
    except Exception as exc:
        logger.error("Agmarknet: failed to get initial viewstate: %s", exc)
        return []

    form_data = {
        **viewstate,
        "ctl00$cphBody$ddlCommodity": commodity_code,
        "ctl00$cphBody$ddlState": state_code,
        "ctl00$cphBody$ddlDistrict": "0",
        "ctl00$cphBody$ddlMarket": "0",
        "ctl00$cphBody$txtDate": target_date.strftime("%d-%b-%Y"),
        "ctl00$cphBody$btnGo": "Submit",
    }

    for page_num in range(1, max_pages + 1):
        try:
            resp = session.post(BASE_URL, data=form_data, headers=HEADERS, timeout=45)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Agmarknet: request failed on page %d: %s", page_num, exc)
            break

        soup = BeautifulSoup(resp.text, "lxml")
        page_records = _parse_table(soup, fetched_at, target_date)
        all_records.extend(page_records)
        logger.info("Agmarknet: page %d → %d records (total: %d)", page_num, len(page_records), len(all_records))

        # Check for next page button
        next_btn = soup.find("input", {"id": "cphBody_lnkbtnNextPage"}) or \
                   soup.find("a", string=lambda t: t and "Next" in t)
        if not next_btn or not page_records:
            logger.info("Agmarknet: no more pages at page %d", page_num)
            break

        # Update viewstate for next page
        viewstate = {
            "__VIEWSTATE": soup.find("input", {"name": "__VIEWSTATE"})["value"] if soup.find("input", {"name": "__VIEWSTATE"}) else "",
            "__VIEWSTATEGENERATOR": soup.find("input", {"name": "__VIEWSTATEGENERATOR"})["value"] if soup.find("input", {"name": "__VIEWSTATEGENERATOR"}) else "",
            "__EVENTVALIDATION": soup.find("input", {"name": "__EVENTVALIDATION"})["value"] if soup.find("input", {"name": "__EVENTVALIDATION"}) else "",
            "__EVENTTARGET": "ctl00$cphBody$lnkbtnNextPage",
            "__EVENTARGUMENT": "",
        }
        form_data.update(viewstate)
        # Remove submit button from subsequent page requests
        form_data.pop("ctl00$cphBody$btnGo", None)

        # Polite delay
        time.sleep(random.uniform(1.0, 2.5))

    logger.info("Agmarknet: finished — %d total records for %s", len(all_records), target_date)
    return all_records
