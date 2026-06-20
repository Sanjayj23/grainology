"""
eNAM scraper — fetches live T-0 price data from the eNAM (National
Agriculture Market) platform using Playwright's API context to bypass WAFs.
"""

from __future__ import annotations
import logging
import time
from datetime import date, datetime, timezone
from typing import Optional

from playwright.sync_api import Page

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

# Primary endpoint (JSON feed observed from enam.gov.in price dashboard)
ENAM_TRADE_URL = "https://enam.gov.in/web/ajax_ctrl/trade_data"
ENAM_PRICE_URL = "https://enam.gov.in/web/ajax_ctrl/commodity_arrivals_list"

def _parse_enam_record(raw: dict, fetched_at: datetime, price_date: date) -> Optional[PriceRecord]:
    """Parse a single eNAM JSON record into a PriceRecord."""
    try:
        raw_state     = raw.get("stateName", raw.get("state", ""))
        raw_district  = raw.get("districtName", raw.get("district", ""))
        raw_market    = raw.get("apmc", raw.get("mandiName", raw.get("market", "")))
        raw_commodity = raw.get("commodity", raw.get("commodityName", ""))
        raw_variety   = raw.get("variety", raw.get("varietyName", ""))

        min_p   = float(str(raw.get("minPrice", raw.get("min_price", 0))).replace(",", "") or 0)
        max_p   = float(str(raw.get("maxPrice", raw.get("max_price", 0))).replace(",", "") or 0)
        modal_p = float(str(raw.get("modalPrice", raw.get("modal_price", max_p))).replace(",", "") or 0)
        arrivals = raw.get("arrivals", raw.get("totalArrival", None))
        arrivals_f = float(str(arrivals).replace(",", "")) if arrivals else None

        if not raw_commodity or not raw_state:
            return None

        commodity, _ = normalize_commodity(raw_commodity)
        market, district, state, _ = normalize_market(raw_market, raw_district, raw_state)

        return PriceRecord(
            source="enam",
            fetched_at=fetched_at,
            price_date=price_date,
            state=state,
            district=district,
            market=market,
            commodity=commodity,
            variety=raw_variety.strip(),
            min_price=max(min_p, 0.01),
            max_price=max(max_p, 0.01),
            modal_price=max(modal_p, 0.01),
            arrivals_tonnes=arrivals_f,
            raw_source_name=raw_commodity,
        )
    except Exception as exc:
        logger.debug("eNAM: skipping row %r: %s", raw, exc)
        return None


def scrape_enam(
    target_date: Optional[date] = None,
    page: Page = None,
    commodity_id: str = "",  # empty = all
    state_id: str = "",      # empty = all
) -> list[PriceRecord]:
    """
    Fetch eNAM live price data using Playwright to bypass WAFs.
    """
    if target_date is None:
        target_date = date.today()

    fetched_at = datetime.now(tz=timezone.utc)
    all_records: list[PriceRecord] = []

    logger.info("eNAM: starting scrape for %s", target_date)

    endpoints_to_try = [
        {
            "url": f"{ENAM_TRADE_URL}?language=en&start_date={target_date.strftime('%d-%b-%Y')}&end_date={target_date.strftime('%d-%b-%Y')}&state_name={state_id}&commodity_id={commodity_id}"
        },
        {
            "url": f"{ENAM_PRICE_URL}?language=en&date={target_date.strftime('%Y-%m-%d')}"
        }
    ]

    # First navigate to the homepage to get the WAF cookies/session
    try:
        page.goto("https://enam.gov.in/web/", wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)
    except Exception as exc:
        logger.warning("eNAM: could not load homepage to get cookies: %s", exc)

    for attempt in endpoints_to_try:
        try:
            # Use page.request to fetch the JSON API while inheriting the browser cookies
            resp = page.request.get(attempt["url"], headers={"X-Requested-With": "XMLHttpRequest"})
            
            if not resp.ok:
                logger.warning("eNAM: endpoint %s failed: HTTP %s", attempt["url"], resp.status)
                continue
                
            data = resp.json()

            if isinstance(data, list):
                raw_records = data
            elif isinstance(data, dict):
                raw_records = (
                    data.get("data", []) or
                    data.get("records", []) or
                    data.get("result", []) or
                    []
                )
            else:
                raw_records = []

            logger.info("eNAM: endpoint %s → %d raw records", attempt["url"], len(raw_records))

            for raw in raw_records:
                record = _parse_enam_record(raw, fetched_at, target_date)
                if record:
                    all_records.append(record)

            if all_records:
                break

            time.sleep(1)

        except Exception as exc:
            logger.warning("eNAM: endpoint %s failed: %s", attempt["url"], exc)

    if not all_records:
        logger.warning("eNAM: all endpoints failed or returned no data.")

    logger.info("eNAM: %d valid records for %s", len(all_records), target_date)
    return all_records
