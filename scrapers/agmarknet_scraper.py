"""
Agmarknet scraper — hits the ASP.NET form portal at agmarknet.gov.in.
Uses Playwright to physically navigate the page, bypassing WAFs.
"""

from __future__ import annotations
import logging
import time
from datetime import date, datetime, timezone
from typing import Optional

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

BASE_URL = "https://agmarknet.gov.in/SearchCommodityDis.aspx"


def _parse_table(html: str, fetched_at: datetime, price_date: date) -> list[PriceRecord]:
    """Parse the results table from a response page."""
    soup = BeautifulSoup(html, "lxml")
    records: list[PriceRecord] = []
    table = soup.find("table", {"id": "cphBody_GridPriceData"})
    if not table:
        table = soup.find("table", class_="tableagmark_new")
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


def scrape_agmarknet(
    target_date: date,
    page: Page,
    state_code: str = "0",  # "0" = All States
    commodity_code: str = "0",  # "0" = All Commodities
    max_pages: int = 50,
) -> list[PriceRecord]:
    """
    Scrape Agmarknet for a given date using Playwright.
    """
    fetched_at = datetime.now(tz=timezone.utc)
    all_records: list[PriceRecord] = []

    logger.info("Agmarknet: starting scrape for %s", target_date)

    try:
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
    except Exception as exc:
        logger.error("Agmarknet: failed to load page: %s", exc)
        return []

    try:
        # Fill the form
        date_str = target_date.strftime("%d-%b-%Y")
        
        # We might need to use JS to set the date if it's readonly
        page.wait_for_selector('#cphBody_txtDate', state='attached', timeout=15000)
        page.evaluate(f"document.getElementById('cphBody_txtDate').value = '{date_str}';")
        
        page.locator("#cphBody_ddlCommodity").select_option(value=commodity_code)
        page.locator("#cphBody_ddlState").select_option(value=state_code)
        
        # Click submit and wait for navigation or table load
        page.locator("#cphBody_btnGo").click()
        
        # Wait for the table to appear, or a message saying no data
        try:
            page.wait_for_selector("#cphBody_GridPriceData, #cphBody_lblMessage", timeout=30000)
        except PlaywrightTimeoutError:
            logger.warning("Agmarknet: Table never loaded after submit.")
            return []

    except Exception as exc:
        logger.error("Agmarknet: failed to submit form: %s", exc)
        return []

    # Check if there's a "No Data Found" message
    msg = page.locator("#cphBody_lblMessage")
    if msg.count() > 0 and "No Data Found" in msg.inner_text():
        logger.info("Agmarknet: No Data Found for %s", target_date)
        return []

    for page_num in range(1, max_pages + 1):
        # Allow table to fully render
        time.sleep(1)
        
        html = page.content()
        page_records = _parse_table(html, fetched_at, target_date)
        all_records.extend(page_records)
        logger.info("Agmarknet: page %d → %d records (total: %d)", page_num, len(page_records), len(all_records))

        if not page_records:
            break

        # Check for next page button
        next_btn = page.locator("input#cphBody_lnkbtnNextPage")
        if next_btn.count() == 0:
            logger.info("Agmarknet: no more pages at page %d", page_num)
            break
            
        # Click next and wait for table to update
        # We can wait for a request or just do a hard sleep since ASP.NET partial postbacks are tricky to intercept
        next_btn.click()
        time.sleep(3) # Wait for postback to complete

    logger.info("Agmarknet: finished — %d total records for %s", len(all_records), target_date)
    return all_records
