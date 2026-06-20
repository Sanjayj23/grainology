"""
IndiaDataPortal client — fetches agricultural price data from
ISB's IndiaDataPortal (indiadataportal.com).

Used as a cross-validation source and for historical depth.
Documentation: https://docs.indiadataportal.com
"""

from __future__ import annotations
import logging
import os
import time
from datetime import date, datetime, timezone
from typing import Optional

import requests
import cloudscraper
from dateutil import parser as dateutil_parser

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

IDP_BASE_URL = "https://indiadataportal.com/api/v1"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

# Known dataset IDs for agricultural market prices on IndiaDataPortal
AGRI_DATASET_ID = "agriculture-marketing"


def _get_idp_key() -> Optional[str]:
    """Optional API key — IDP has some public endpoints."""
    return os.environ.get("IDP_API_KEY", "")


def fetch_indiadataportal(
    target_date: Optional[date] = None,
    days_back: int = 7,
) -> list[PriceRecord]:
    """
    Fetch price data from IndiaDataPortal.
    Falls back gracefully if the API is unavailable.
    """
    if target_date is None:
        target_date = date.today()

    fetched_at = datetime.now(tz=timezone.utc)
    all_records: list[PriceRecord] = []
    api_key = _get_idp_key()

    logger.info("IndiaDataPortal: fetching data for last %d days ending %s", days_back, target_date)

    headers = {**HEADERS}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # Try the primary APMC/mandi price dataset
    endpoints = [
        f"{IDP_BASE_URL}/datasets/{AGRI_DATASET_ID}",
        f"{IDP_BASE_URL}/agri/mandi-prices",
        "https://indiadataportal.com/p/agriculture-marketing/api",
    ]

    session = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
    session.headers.update(headers)

    for endpoint in endpoints:
        try:
            params = {
                "limit": 5000,
                "format": "json",
            }
            resp = session.get(endpoint, params=params, timeout=30)
            if resp.status_code == 404:
                logger.debug("IDP: endpoint %s not found, trying next", endpoint)
                continue
            resp.raise_for_status()
            data = resp.json()

            raw_records = (
                data if isinstance(data, list) else
                data.get("data", []) or
                data.get("records", []) or
                []
            )

            logger.info("IndiaDataPortal: endpoint %s → %d raw records", endpoint, len(raw_records))

            for raw in raw_records:
                try:
                    raw_state     = raw.get("state", raw.get("State", ""))
                    raw_district  = raw.get("district", raw.get("District", ""))
                    raw_market    = raw.get("market", raw.get("Market", raw.get("mandi", "")))
                    raw_commodity = raw.get("commodity", raw.get("Commodity", ""))
                    raw_variety   = raw.get("variety", raw.get("Variety", ""))
                    min_p   = float(str(raw.get("min_price", raw.get("Min_Price", 0))).replace(",", "") or 0)
                    max_p   = float(str(raw.get("max_price", raw.get("Max_Price", 0))).replace(",", "") or 0)
                    modal_p = float(str(raw.get("modal_price", raw.get("Modal_Price", max_p))).replace(",", "") or 0)

                    date_str = raw.get("date", raw.get("arrival_date", raw.get("Date", "")))
                    try:
                        price_date = dateutil_parser.parse(date_str).date()
                    except Exception:
                        price_date = target_date

                    if not raw_commodity:
                        continue

                    commodity, _ = normalize_commodity(raw_commodity)
                    market, district, state, _ = normalize_market(raw_market, raw_district, raw_state)

                    record = PriceRecord(
                        source="indiadataportal",
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
                        arrivals_tonnes=None,
                        raw_source_name=raw_commodity,
                    )
                    all_records.append(record)
                except Exception as exc:
                    logger.debug("IDP: skipping row %r: %s", raw, exc)

            if all_records:
                break  # success

        except requests.RequestException as exc:
            logger.warning("IDP: endpoint %s failed: %s", endpoint, exc)
        except ValueError as exc:
            logger.warning("IDP: JSON parse error: %s", exc)

        time.sleep(0.5)

    if not all_records:
        logger.warning(
            "IndiaDataPortal: no data retrieved. "
            "Check https://indiadataportal.com/p/agriculture-marketing for current API docs."
        )

    logger.info("IndiaDataPortal: %d valid records", len(all_records))
    return all_records
