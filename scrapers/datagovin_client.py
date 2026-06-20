"""
data.gov.in API client — fetches Agmarknet price data via the official
REST API endpoint (no HTML scraping required).

API endpoint:
  https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070

Requires DATAGOVIN_API_KEY environment variable.
Register for a free key at https://data.gov.in
"""

from __future__ import annotations
import logging
import os
import time
from datetime import date, datetime, timezone
from typing import Optional

import requests

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

API_BASE = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
PAGE_LIMIT = 1000  # max records per request


def _get_api_key() -> str:
    key = os.environ.get("DATAGOVIN_API_KEY", "")
    if not key:
        raise EnvironmentError(
            "DATAGOVIN_API_KEY environment variable not set. "
            "Register at https://data.gov.in to get a free key."
        )
    return key


def fetch_datagovin(
    target_date: Optional[date] = None,
    state: Optional[str] = None,
    commodity: Optional[str] = None,
) -> list[PriceRecord]:
    """
    Fetch price data from data.gov.in API.
    Paginates automatically until all records are retrieved.

    Args:
        target_date: Filter by arrival date (default: today)
        state: Filter by state name (default: all states)
        commodity: Filter by commodity name (default: all commodities)

    Returns:
        List of normalized PriceRecord objects.
    """
    api_key = _get_api_key()
    fetched_at = datetime.now(tz=timezone.utc)
    if target_date is None:
        target_date = date.today()

    date_str = target_date.strftime("%d/%m/%Y")
    all_records: list[PriceRecord] = []
    offset = 0

    logger.info("data.gov.in: fetching for %s", target_date)

    while True:
        params: dict = {
            "api-key": api_key,
            "format": "json",
            "limit": PAGE_LIMIT,
            "offset": offset,
            "filters[Arrival_Date]": date_str,
        }
        if state:
            params["filters[State]"] = state
        if commodity:
            params["filters[Commodity]"] = commodity

        try:
            resp = requests.get(API_BASE, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            logger.error("data.gov.in: request failed at offset %d: %s", offset, exc)
            break
        except ValueError as exc:
            logger.error("data.gov.in: JSON parse error at offset %d: %s", offset, exc)
            break

        records_data = data.get("records", [])
        total = data.get("total", 0)

        logger.info(
            "data.gov.in: offset=%d, got=%d, total=%d",
            offset, len(records_data), total
        )

        for raw in records_data:
            try:
                raw_state     = raw.get("State", "")
                raw_district  = raw.get("District", "")
                raw_market    = raw.get("Market", "")
                raw_commodity = raw.get("Commodity", "")
                raw_variety   = raw.get("Variety", "")
                min_p  = float(str(raw.get("Min_x0020_Price", "0")).replace(",", "") or 0)
                max_p  = float(str(raw.get("Max_x0020_Price", "0")).replace(",", "") or 0)
                modal_p = float(str(raw.get("Modal_x0020_Price", "0")).replace(",", "") or 0)

                arrival_str = str(raw.get("Arrival_Date", "")).strip()
                try:
                    from dateutil import parser as dateutil_parser
                    price_date = dateutil_parser.parse(arrival_str).date()
                except Exception:
                    price_date = target_date

                commodity, _ = normalize_commodity(raw_commodity)
                market, district, state_norm, _ = normalize_market(raw_market, raw_district, raw_state)

                record = PriceRecord(
                    source="datagovin",
                    fetched_at=fetched_at,
                    price_date=price_date,
                    state=state_norm,
                    district=district,
                    market=market,
                    commodity=commodity,
                    variety=raw_variety.strip(),
                    min_price=max(min_p, 0.01),
                    max_price=max(max_p, 0.01),
                    modal_price=max(modal_p, 0.01),
                    arrivals_tonnes=None,  # not provided by this endpoint
                    raw_source_name=raw_commodity,
                )
                all_records.append(record)
            except Exception as exc:
                logger.debug("data.gov.in: skipping row %r: %s", raw, exc)

        offset += len(records_data)
        if offset >= total or not records_data:
            break

        time.sleep(0.5)  # polite delay between pages

    logger.info("data.gov.in: total %d records fetched for %s", len(all_records), target_date)
    return all_records
