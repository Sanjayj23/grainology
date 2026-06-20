"""
eNAM scraper — fetches live T-0 price data from the eNAM (National
Agriculture Market) platform.

Endpoint discovered via DevTools network inspection of enam.gov.in.
Provides real-time min/max prices for 1,000+ mandis across 18+ states.
"""

from __future__ import annotations
import logging
import time
from datetime import date, datetime, timezone
from typing import Optional

import requests
import cloudscraper

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

# Primary endpoint (JSON feed observed from enam.gov.in price dashboard)
ENAM_TRADE_URL = "https://enam.gov.in/web/ajax_ctrl/trade_data"
ENAM_PRICE_URL = "https://enam.gov.in/web/ajax_ctrl/commodity_arrivals_list"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": "https://enam.gov.in/web/dashboard/trade-data",
}


def _parse_enam_record(raw: dict, fetched_at: datetime, price_date: date) -> Optional[PriceRecord]:
    """Parse a single eNAM JSON record into a PriceRecord."""
    try:
        # eNAM field names (may vary — update if endpoint shape changes)
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
    commodity_id: str = "",  # empty = all
    state_id: str = "",      # empty = all
) -> list[PriceRecord]:
    """
    Fetch eNAM live price data.
    Falls back gracefully if the endpoint is unavailable.
    """
    if target_date is None:
        target_date = date.today()

    fetched_at = datetime.now(tz=timezone.utc)
    all_records: list[PriceRecord] = []

    logger.info("eNAM: starting scrape for %s", target_date)

    # Try the trade data endpoint first
    endpoints_to_try = [
        {
            "url": ENAM_TRADE_URL,
            "params": {
                "language": "en",
                "start_date": target_date.strftime("%d-%b-%Y"),
                "end_date": target_date.strftime("%d-%b-%Y"),
                "state_name": state_id,
                "commodity_id": commodity_id,
            }
        },
        {
            "url": ENAM_PRICE_URL,
            "params": {
                "date": target_date.strftime("%Y-%m-%d"),
                "language": "en",
            }
        }
    ]

    session = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
    session.headers.update(HEADERS)

    for attempt in endpoints_to_try:
        try:
            resp = session.get(
                attempt["url"],
                params=attempt["params"],
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()

            # Handle different response shapes
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
                break  # success — don't try fallback

            time.sleep(1)

        except requests.RequestException as exc:
            logger.warning("eNAM: endpoint %s failed: %s", attempt["url"], exc)
        except ValueError as exc:
            logger.warning("eNAM: JSON parse error at %s: %s", attempt["url"], exc)

    if not all_records:
        logger.warning(
            "eNAM: all endpoints failed or returned no data for %s. "
            "Manually verify network endpoints at https://enam.gov.in/web/dashboard/trade-data "
            "using browser DevTools → Network tab → XHR filter.",
            target_date
        )

    logger.info("eNAM: %d valid records for %s", len(all_records), target_date)
    return all_records
