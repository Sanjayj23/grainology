"""
data.gov.in API client — fetches Agmarknet-sourced mandi price data via the
official REST API (no HTML scraping, no WAF/bot-detection involved).

API endpoint:
  https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
  "Current Daily Price of Various Commodities from Various Markets (Mandi)"
  Source: Directorate of Marketing & Inspection (DMI). This dataset is
  generated directly from the AGMARKNET portal's backend — so this client
  IS your "Agmarknet" data, delivered through a stable JSON API instead of
  a scraped, frequently-redesigned HTML page.

Requires DATAGOVIN_API_KEY environment variable (already in your GH secrets).

Reliability notes (read before touching the retry/backoff knobs below):
  - api.data.gov.in is frequently slow (5-25s) and occasionally times out or
    returns 5xx under load. A single 30s timeout with zero retries (the old
    behaviour) fails far more often than the API is actually "down".
  - Mandis report with a lag — "today's" Arrival_Date often has 0 records
    until later in the day, and many mandis don't report at all on Sundays/
    holidays. Asking only for today's date can legitimately return 0 records
    even when the API and the client are both working correctly. We scan
    backwards a few days and use the most recent date that has data, rather
    than treating that as a failure.
"""

from __future__ import annotations
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

API_BASE = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
PAGE_LIMIT = 500          # smaller pages -> lower per-request timeout risk
REQUEST_TIMEOUT = 45      # seconds -- data.gov.in is slow; 30s was too tight
MAX_ATTEMPTS = 4          # attempts per page before giving up on that page
BACKOFF_BASE = 3          # seconds; attempt N waits BACKOFF_BASE * 2**(N-1)
MAX_DAYS_BACK = 4         # how many days to scan back if a date has 0 records


def _get_api_key() -> str:
    key = os.environ.get("DATAGOVIN_API_KEY", "")
    if not key:
        raise EnvironmentError(
            "DATAGOVIN_API_KEY environment variable not set. "
            "Register at https://data.gov.in to get a free key."
        )
    return key


def _build_session() -> requests.Session:
    """Session-level retries for low-level connection errors / 5xx."""
    session = requests.Session()
    retry = Retry(
        total=2,
        connect=2,
        backoff_factor=1.5,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


def _fetch_page(
    session: requests.Session,
    api_key: str,
    date_str: str,
    offset: int,
    state: Optional[str],
    commodity: Optional[str],
) -> Optional[dict]:
    """Fetch a single page, retrying on timeout/error with growing backoff.
    Returns the parsed JSON dict, or None if every attempt failed."""
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

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            resp = session.get(API_BASE, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt == MAX_ATTEMPTS:
                logger.error(
                    "data.gov.in: giving up on offset %d for %s after %d attempts: %s",
                    offset, date_str, MAX_ATTEMPTS, exc,
                )
                return None
            wait = BACKOFF_BASE * (2 ** (attempt - 1))
            logger.warning(
                "data.gov.in: attempt %d/%d failed at offset %d (%s): %s -- retrying in %ds",
                attempt, MAX_ATTEMPTS, offset, date_str, exc, wait,
            )
            time.sleep(wait)
        except ValueError as exc:  # JSON parse error -- retrying won't help
            logger.error("data.gov.in: JSON parse error at offset %d: %s", offset, exc)
            return None
    return None


def _parse_records(
    records_data: list[dict], fetched_at: datetime, fallback_date: date
) -> list[PriceRecord]:
    out: list[PriceRecord] = []
    for raw in records_data:
        try:
            raw_state     = raw.get("State", "")
            raw_district  = raw.get("District", "")
            raw_market    = raw.get("Market", "")
            raw_commodity = raw.get("Commodity", "")
            raw_variety   = raw.get("Variety", "")
            min_p   = float(str(raw.get("Min_x0020_Price", "0")).replace(",", "") or 0)
            max_p   = float(str(raw.get("Max_x0020_Price", "0")).replace(",", "") or 0)
            modal_p = float(str(raw.get("Modal_x0020_Price", "0")).replace(",", "") or 0)

            arrival_str = str(raw.get("Arrival_Date", "")).strip()
            try:
                from dateutil import parser as dateutil_parser
                price_date = dateutil_parser.parse(arrival_str).date()
            except Exception:
                price_date = fallback_date

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
            out.append(record)
        except Exception as exc:
            logger.debug("data.gov.in: skipping row %r: %s", raw, exc)
    return out


def _fetch_for_date(
    session: requests.Session,
    api_key: str,
    target_date: date,
    state: Optional[str],
    commodity: Optional[str],
    fetched_at: datetime,
) -> list[PriceRecord]:
    date_str = target_date.strftime("%d/%m/%Y")
    all_records: list[PriceRecord] = []
    offset = 0

    while True:
        data = _fetch_page(session, api_key, date_str, offset, state, commodity)
        if data is None:
            break  # exhausted retries for this page -- stop paginating this date

        records_data = data.get("records", [])
        total = data.get("total", 0)
        logger.info(
            "data.gov.in: %s offset=%d got=%d total=%d",
            date_str, offset, len(records_data), total,
        )

        all_records.extend(_parse_records(records_data, fetched_at, target_date))

        offset += len(records_data)
        if offset >= total or not records_data:
            break
        time.sleep(0.5)  # polite delay between pages

    return all_records


def fetch_datagovin(
    target_date: Optional[date] = None,
    state: Optional[str] = None,
    commodity: Optional[str] = None,
) -> list[PriceRecord]:
    """
    Fetch price data from data.gov.in API. Paginates automatically. If
    target_date comes back with zero records, scans backwards day by day
    (up to MAX_DAYS_BACK) and returns the most recent date that has data --
    each record still carries its own correct price_date.

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

    session = _build_session()

    for days_back in range(0, MAX_DAYS_BACK + 1):
        try_date = target_date - timedelta(days=days_back)
        logger.info("data.gov.in: fetching for %s (days_back=%d)", try_date, days_back)
        records = _fetch_for_date(session, api_key, try_date, state, commodity, fetched_at)

        if records:
            if days_back > 0:
                logger.warning(
                    "data.gov.in: no data published for %s yet -- using most "
                    "recent available date %s instead (%d day(s) back)",
                    target_date, try_date, days_back,
                )
            logger.info("data.gov.in: total %d records fetched (price_date=%s)", len(records), try_date)
            return records

        logger.warning("data.gov.in: 0 records for %s", try_date)

    logger.error(
        "data.gov.in: no records found for %s or the %d preceding day(s)",
        target_date, MAX_DAYS_BACK,
    )
    return []
