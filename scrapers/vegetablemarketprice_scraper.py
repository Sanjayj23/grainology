"""
vegetablemarketprice.com scraper — scrapes live daily vegetable prices
across all Indian states. No API key required, no Cloudflare blocks.

Data: wholesale + retail prices for ~50 commodities across 20+ states.
Updated daily by the source website.
"""

from __future__ import annotations
import logging
import time
import urllib.request
from datetime import date, datetime, timezone
from typing import Optional

from bs4 import BeautifulSoup

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market

logger = logging.getLogger(__name__)

STATES = [
    "andhra-pradesh", "assam", "bihar", "chhattisgarh", "delhi",
    "gujarat", "haryana", "himachal-pradesh", "jharkhand", "karnataka",
    "kerala", "madhya-pradesh", "maharashtra", "manipur", "meghalaya",
    "odisha", "punjab", "rajasthan", "tamil-nadu", "telangana",
    "tripura", "uttar-pradesh", "uttarakhand", "west-bengal",
]

BASE_URL = "https://vegetablemarketprice.com/market/{state}/today"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def _state_slug_to_name(slug: str) -> str:
    return slug.replace("-", " ").title()


def _scrape_state(state_slug: str, fetched_at: datetime, price_date: date) -> list[PriceRecord]:
    url = BASE_URL.format(state=state_slug)
    state_name = _state_slug_to_name(state_slug)
    records: list[PriceRecord] = []

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        html = urllib.request.urlopen(req, timeout=12).read().decode("utf-8", errors="ignore")
    except Exception as exc:
        logger.warning("VMP: failed to fetch %s: %s", state_slug, exc)
        return records

    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")

    for table in tables:
        rows = table.find_all("tr")[1:]  # skip header
        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            # html.parser: cells[0]=Vegetable, cells[1]=Price, cells[2]=Retail Price
            if len(cells) < 3:
                continue
            try:
                # First cell is an image thumbnail — vegetable name is cells[1]
                raw_commodity = cells[1] if len(cells) > 1 else cells[0]
                if not raw_commodity or raw_commodity.isdigit():
                    continue

                price_str = cells[2].replace("\u20b9", "").replace(",", "").strip()
                retail_str = cells[3].replace("\u20b9", "").replace(",", "").strip() if len(cells) > 3 else ""
                unit = cells[4].lower().replace(" ", "") if len(cells) > 4 else "1kg"

                # Handle range like "25 - 40" or just "30"
                if " - " in price_str:
                    parts = price_str.split(" - ")
                    min_p = float(parts[0].strip() or 0)
                    max_p = float(parts[1].strip() or 0)
                else:
                    val = float(price_str or 0)
                    min_p = val * 0.9
                    max_p = val * 1.1

                # Source prices are usually per 1kg. The dashboard schema
                # compares sources in rupees/quintal, so normalize kg to quintal.
                if "kg" in unit:
                    min_p *= 100
                    max_p *= 100

                modal_p = (min_p + max_p) / 2

                if modal_p <= 0:
                    continue

                commodity, _ = normalize_commodity(raw_commodity)
                market, district, state_norm, _ = normalize_market("", "", state_name)

                record = PriceRecord(
                    source="vegetablemarketprice",
                    fetched_at=fetched_at,
                    price_date=price_date,
                    state=state_norm or state_name,
                    district=district or "",
                    market=market or f"{state_name} Market",
                    commodity=commodity,
                    variety="",
                    min_price=max(min_p, 0.01),
                    max_price=max(max_p, 0.01),
                    modal_price=max(modal_p, 0.01),
                    arrivals_tonnes=None,
                    raw_source_name=raw_commodity,
                )
                records.append(record)
            except Exception as exc:
                logger.debug("VMP: skipping row %r in %s: %s", cells, state_slug, exc)

    return records


def scrape_vegetablemarketprice(
    target_date: Optional[date] = None,
    states: Optional[list[str]] = None,
    page=None,  # Playwright page, not needed — kept for interface compatibility
) -> list[PriceRecord]:
    """
    Scrape live vegetable prices from vegetablemarketprice.com across all states.
    No API key or Playwright required.
    """
    if target_date is None:
        target_date = date.today()
    if states is None:
        states = STATES

    fetched_at = datetime.now(tz=timezone.utc)
    all_records: list[PriceRecord] = []

    logger.info("VMP: starting scrape for %d states", len(states))

    for i, state in enumerate(states):
        records = _scrape_state(state, fetched_at, target_date)
        all_records.extend(records)
        logger.info("VMP: %s -> %d records (total: %d)", state, len(records), len(all_records))
        if i < len(states) - 1:
            time.sleep(0.5)  # polite delay

    logger.info("VMP: finished — %d total records", len(all_records))
    return all_records
